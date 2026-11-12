import concurrent.futures
import json
import secrets
import sys
import urllib.error
import urllib.request

BASE = sys.argv[1].rstrip('/')


def request(path, method='GET', data=None, session=None, expected=200, raw=None, filename=None):
    headers = {'User-Agent': 'ProofPay-Integration-Check/1.0', 'Accept': 'application/json'}
    if session:
        headers['Authorization'] = 'Bearer ' + session
    payload = None
    if data is not None:
        payload = json.dumps(data).encode()
        headers['Content-Type'] = 'application/json'
    if raw is not None:
        payload = raw
        headers['X-Filename'] = filename
    req = urllib.request.Request(BASE + path, data=payload, headers=headers, method=method)
    try:
        response = urllib.request.urlopen(req, timeout=30)
        status = response.status
        content = response.read()
    except urllib.error.HTTPError as error:
        status = error.code
        content = error.read()
    if status != expected:
        raise AssertionError(f'{method} {path}: expected {expected}, got {status}: {content.decode(errors="replace")}')
    if raw is not None or '/files/' in path:
        return content
    return json.loads(content)


def account(role):
    email = f'proofpay-check-{role}-{secrets.token_hex(6)}@example.invalid'
    password = secrets.token_urlsafe(24)
    request('/api/auth/signup', 'POST', {'name': 'Verification ' + role, 'email': email, 'password': password})
    return request('/api/auth/login', 'POST', {'email': email, 'password': password})


health = request('/api/health')
assert health['ok'] and health['payments'] == 'not_connected'
request('/api/projects', expected=401)
owner, client, outsider = account('freelancer'), account('client'), account('outsider')
a, b, c = owner['token'], client['token'], outsider['token']
created = request('/api/projects', 'POST', {
    'name': 'Deployment verification project', 'client_name': 'Verification client',
    'description': 'An isolated automated check of agreement, revision, and file privacy.',
    'amount_cents': 125000, 'criteria': ['Deliver the agreed text evidence', 'Client verifies the content']
}, a, 201)
p = '/api/projects/' + created['id']
request(p, session=c, expected=404)
request(p, session=b, expected=404)
request(p + '/approve', 'POST', session=a, expected=403)
request(p + '/files', 'POST', session=a, expected=403, raw=b'Private evidence', filename='delivery.txt')
code = request(p + '/invite', 'POST', session=a)['code']
request('/api/join', 'POST', {'code': code}, a, 400)
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
    def claim():
        try:
            return request('/api/join', 'POST', {'code': code}, b)['id']
        except AssertionError as error:
            assert 'got 400' in str(error)
            return None
    claims = list(pool.map(lambda _: claim(), range(2)))
assert claims.count(created['id']) == 1 and claims.count(None) == 1
request('/api/join', 'POST', {'code': code}, c, 400)
request(p + '/accept', 'POST', session=a, expected=403)
request(p + '/accept', 'POST', session=b)
request(p + '/files', 'POST', session=b, expected=403, raw=b'Private evidence', filename='delivery.txt')
request(p + '/files', 'POST', session=a, expected=400, raw=b'not a PNG', filename='fake.png')
evidence = b'Private evidence for deployment verification.\n'
request(p + '/files', 'POST', session=a, expected=201, raw=evidence, filename='delivery.txt')
detail = request(p, session=a)
file_id = detail['deliveries'][0]['id']
assert request(p + '/files/' + file_id, session=b) == evidence
request(p + '/files/' + file_id, session=c, expected=404)
request(p + '/files/' + file_id, expected=401)
request(p + '/submit', 'POST', session=a)
request(p + '/approve', 'POST', session=b, expected=409)
request(p + '/criteria/' + detail['criteria'][0]['id'], 'PATCH', {'status': 'met'}, a, 403)
request(p + '/revision', 'POST', {'message': 'Please add the revised evidence.'}, b)
request(p + '/files', 'POST', session=a, expected=201, raw=b'Revised private evidence.\n', filename='revision.txt')
request(p + '/submit', 'POST', session=a)
detail = request(p, session=b)
assert all(item['status'] == 'uncertain' for item in detail['criteria'])
for item in detail['criteria']:
    request(p + '/criteria/' + item['id'], 'PATCH', {'status': 'met'}, b)
request(p + '/approve', 'POST', session=b)
request(p + '/approve', 'POST', session=b, expected=409)
request(p + '/files', 'POST', session=a, expected=403, raw=b'Late upload', filename='late.txt')
assert request(p, session=a)['project']['status'] == 'approved'
assert any(project['id'] == created['id'] for project in request('/api/projects', session=a)['projects'])
assert all(project['id'] != created['id'] for project in request('/api/projects', session=c)['projects'])
assert any(event['title'] == 'Client joined the project' for event in request(p, session=b)['activity'])
for session in [a, b, c]:
    request('/api/auth/logout', 'POST', session=session)
    request('/api/auth/me', session=session, expected=401)
print('PASS: signup, login, atomic invite claim, private project isolation, agreement acceptance, validated R2 uploads, authorized downloads, revision/resubmission, client-only approval, saved data, and session revocation.')
