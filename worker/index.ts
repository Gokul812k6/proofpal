import { authenticate, authRoute, body, Env, hash, HttpError, json, text, token, User } from './auth';

import { paypalClientId, paypalOrder, verifyOrder } from './paypal';
import { draftCriteria, draftRevision, evidenceCheck } from './ai';

interface Project {
  id: string; owner_id: string; client_id: string | null; name: string; client_name: string;
  description: string; amount_cents: number; currency: string; status: string; created_at: string;
}
const currencies = ['USD', 'INR', 'EUR', 'GBP', 'CAD', 'AUD', 'SGD'];
const projectColumns = 'id, owner_id, client_id, name, client_name, description, amount_cents, currency, status, created_at';
function event(env: Env, project: string, actor: string, title: string, detail = '') {
  return env.DB.prepare('INSERT INTO activity (id, project_id, actor_id, title, detail) VALUES (?, ?, ?, ?, ?)').bind(crypto.randomUUID(), project, actor, title, detail);
}
async function projectFor(env: Env, id: string, user: User) {
  const project = await env.DB.prepare(`SELECT ${projectColumns} FROM projects WHERE id = ? AND (owner_id = ? OR client_id = ?)`).bind(id, user.id, user.id).first<Project>();
  if (!project) throw new HttpError(404, 'Project not found.');
  return project;
}
async function transition(env: Env, project: Project, actor: User, from: string[], to: string, title: string, detail = '', condition = '') {
  const result = await env.DB.batch([
    env.DB.prepare(`UPDATE projects SET status = ? WHERE id = ? AND status IN (${from.map(() => '?').join(',')}) ${condition}`).bind(to, project.id, ...from),
    env.DB.prepare('INSERT INTO activity (id, project_id, actor_id, title, detail) SELECT ?, ?, ?, ?, ? WHERE changes() > 0').bind(crypto.randomUUID(), project.id, actor.id, title, detail),
    ...(to === 'review' ? [env.DB.prepare("UPDATE criteria SET status = 'uncertain' WHERE project_id = ? AND changes() > 0").bind(project.id)] : []),
  ]);
  if (!result[0].meta.changes) throw new HttpError(409, 'This project changed or is not ready for that action. Refresh and try again.');
  return json({ ok: true });
}
async function fileBytes(req: Request) {
  const max = 10 * 1024 * 1024;
  if (Number(req.headers.get('Content-Length') || 0) > max) throw new HttpError(413, 'Files must be 10 MB or smaller.');
  if (!req.body) throw new HttpError(400, 'Choose a file to upload.');
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const item = await reader.read();
    if (item.done) break;
    size += item.value.byteLength;
    if (size > max) { await reader.cancel(); throw new HttpError(413, 'Files must be 10 MB or smaller.'); }
    chunks.push(item.value);
  }
  if (!size) throw new HttpError(400, 'Empty files cannot be uploaded.');
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes;
}
function fileType(bytes: Uint8Array, name: string) {
  const starts = (signature: number[]) => signature.every((n, i) => bytes[i] === n);
  if (starts([137, 80, 78, 71, 13, 10, 26, 10]) && /\.png$/i.test(name)) return 'image/png';
  if (starts([255, 216, 255]) && /\.jpe?g$/i.test(name)) return 'image/jpeg';
  if (starts([37, 80, 68, 70, 45]) && /\.pdf$/i.test(name)) return 'application/pdf';
  if (/\.txt$/i.test(name)) {
    try { new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(bytes); if (!bytes.includes(0)) return 'text/plain'; } catch { throw new HttpError(400, 'Text files must contain valid UTF-8 text.'); }
  }
  throw new HttpError(400, 'Upload a valid PNG, JPG, PDF, or UTF-8 text file.');
}
async function route(req: Request, env: Env) {
  const path = new URL(req.url).pathname.replace(/\/$/, '');
  if (path === '/api/health' && req.method === 'GET') {
    await env.DB.prepare('SELECT 1').first();
    return json({ ok: true, storage: 'Cloudflare D1 + private R2', payments: env.PAYPAL_SECRET ? 'sandbox' : 'needs_secret', review: 'human', ai: env.AI ? 'advisory' : 'off' });
  }
  if (path.startsWith('/api/auth/')) return authRoute(req, env, path);
  const user = await authenticate(req, env);
  if (path === '/api/paypal' && req.method === 'GET') return json({ clientId: paypalClientId, configured: Boolean(env.PAYPAL_SECRET), sandbox: true });
  if (path === '/api/projects' && req.method === 'GET') {
    const result = await env.DB.prepare(`SELECT ${projectColumns} FROM projects WHERE owner_id = ? OR client_id = ? ORDER BY created_at DESC`).bind(user.id, user.id).all();
    return json({ projects: result.results });
  }
  if (path === '/api/projects' && req.method === 'POST') {
    const data = await body(req);
    const name = text(data.name, 100, 'project name');
    const clientName = text(data.client_name, 100, 'client name');
    const description = text(data.description, 4000, 'project description');
    const amount = data.amount_cents;
    if (typeof amount !== 'number' || !Number.isSafeInteger(amount) || amount < 0 || amount > 100000000) throw new HttpError(400, 'Enter an amount between 0 and 1,000,000.');
    const currency = data.currency ?? 'USD';
    if (typeof currency !== 'string' || !currencies.includes(currency)) throw new HttpError(400, 'Choose a supported currency.');
    if (!Array.isArray(data.criteria) || data.criteria.length < 1 || data.criteria.length > 20) throw new HttpError(400, 'Add between 1 and 20 acceptance criteria.');
    const criteria = data.criteria.map(c => text(c, 500, 'acceptance criterion'));
    const count = await env.DB.prepare('SELECT COUNT(*) AS count FROM projects WHERE owner_id = ?').bind(user.id).first<{ count: number }>();
    if (count && count.count >= 100) throw new HttpError(400, 'This workspace has reached its 100-project limit.');
    const id = crypto.randomUUID();
    await env.DB.batch([
      env.DB.prepare('INSERT INTO projects (id, owner_id, name, client_name, description, amount_cents, currency) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(id, user.id, name, clientName, description, amount, currency),
      ...criteria.map((c, i) => env.DB.prepare('INSERT INTO criteria (id, project_id, title, position) VALUES (?, ?, ?, ?)').bind(crypto.randomUUID(), id, c, i)),
      event(env, id, user.id, 'Agreement created', 'Waiting for the client to join and accept.'),
    ]);
    return json({ id }, 201);
  }
  if (path === '/api/draft-criteria' && req.method === 'POST') {
    const data = await body(req);
    const criteria = await draftCriteria(env, user.id, text(data.name ?? 'Untitled project', 100, 'project name'), text(data.description, 4000, 'project scope'));
    return json({ criteria });
  }
  if (path === '/api/join' && req.method === 'POST') {
    const data = await body(req);
    if (typeof data.code !== 'string' || !/^[a-f0-9]{64}$/.test(data.code)) throw new HttpError(400, 'This invitation is invalid or has already been used.');
    const inviteHash = await hash(data.code);
    const invited = await env.DB.prepare('SELECT id FROM projects WHERE invite_hash = ? AND client_id IS NULL AND owner_id != ?').bind(inviteHash, user.id).first<{ id: string }>();
    if (!invited) throw new HttpError(400, 'This invitation is invalid or has already been used.');
    const result = await env.DB.batch([
      env.DB.prepare('UPDATE projects SET client_id = ?, invite_hash = NULL WHERE id = ? AND invite_hash = ? AND client_id IS NULL AND owner_id != ? RETURNING id').bind(user.id, invited.id, inviteHash, user.id),
      env.DB.prepare("INSERT INTO activity (id, project_id, actor_id, title) SELECT ?, ?, ?, 'Client joined the project' WHERE changes() > 0").bind(crypto.randomUUID(), invited.id, user.id),
    ]);
    const joined = result[0].results[0] as { id: string } | undefined;
    if (!joined) throw new HttpError(400, 'This invitation is invalid or has already been used.');
    return json({ id: joined.id });
  }
  const match = path.match(/^\/api\/projects\/([a-f0-9-]{36})(?:\/([a-z]+)(?:\/([a-f0-9-]{36}))?)?$/);
  if (!match) throw new HttpError(404, 'Not found.');
  const [, id, action, itemId] = match;
  const project = await projectFor(env, id, user);
  const owner = project.owner_id === user.id;
  if (!action && req.method === 'GET') {
    const [criteria, deliveries, activity] = await env.DB.batch([
      env.DB.prepare('SELECT id, title, status FROM criteria WHERE project_id = ? ORDER BY position').bind(id),
      env.DB.prepare('SELECT id, name, size, mime, created_at FROM deliveries WHERE project_id = ? ORDER BY created_at DESC').bind(id),
      env.DB.prepare('SELECT id, title, detail, created_at FROM activity WHERE project_id = ? ORDER BY created_at DESC').bind(id),
    ]);
    return json({ project, criteria: criteria.results, deliveries: deliveries.results, activity: activity.results });
  }
  if (action === 'payment' && req.method === 'POST') {
    if (owner || project.status !== 'approved' || project.amount_cents <= 0) throw new HttpError(403, 'Only the client can pay after approving a non-zero project.');
    const data = await body(req);
    if (data.orderId === undefined) {
      const paid = await env.DB.prepare("SELECT id FROM activity WHERE project_id = ? AND title = 'Sandbox payment completed'").bind(id).first();
      if (paid) throw new HttpError(409, 'This project already has a completed sandbox payment.');
      const order = await paypalOrder(env, '', 'POST', { intent: 'CAPTURE', purchase_units: [{ custom_id: `${id}:${user.id}`, invoice_id: `proofpal-${id}`, amount: { currency_code: project.currency, value: (project.amount_cents / 100).toFixed(2) } }] }, `create-${id}`);
      return json({ orderId: order.id });
    }
    if (typeof data.orderId !== 'string' || !/^[A-Z0-9]{10,32}$/.test(data.orderId)) throw new HttpError(400, 'Invalid PayPal order.');
    let order = await paypalOrder(env, `/${data.orderId}`, 'GET');
    verifyOrder(order, project, user.id);
    if (order.status !== 'COMPLETED') {
      if (order.status !== 'APPROVED') throw new HttpError(409, 'Approve the payment in PayPal first.');
      order = await paypalOrder(env, `/${data.orderId}/capture`, 'POST', {}, `capture-${id}`);
    }
    const unit = verifyOrder(order, project, user.id);
    const capture = unit.payments?.captures?.[0];
    if (order.status !== 'COMPLETED' || unit.payments?.captures?.length !== 1 || capture?.status !== 'COMPLETED' || capture.amount.currency_code !== project.currency || capture.amount.value !== (project.amount_cents / 100).toFixed(2)) throw new HttpError(409, 'Payment is not completed yet. Please retry confirmation.');
    await env.DB.prepare("INSERT OR IGNORE INTO activity (id, project_id, actor_id, title, detail) VALUES (?, ?, ?, 'Sandbox payment completed', ?)").bind(`paypal-${capture.id}`, id, user.id, `${capture.amount.currency_code} ${capture.amount.value} · PayPal capture ${capture.id} · Test money only, paid to the app sandbox merchant; not escrow or a freelancer payout.`).run();
    return json({ ok: true });
  }
  if (action === 'aicheck' && req.method === 'POST') {
    const allowed = owner ? ['active', 'revision', 'review'].includes(project.status) : project.status === 'review';
    if (!allowed) throw new HttpError(403, owner ? 'Run the AI check after the client accepts the agreement.' : 'The AI check is available once the delivery is submitted for review.');
    const [criteria, files] = await env.DB.batch([
      env.DB.prepare('SELECT id, title FROM criteria WHERE project_id = ? ORDER BY position').bind(id),
      env.DB.prepare('SELECT object_key, name, mime FROM deliveries WHERE project_id = ? ORDER BY created_at DESC').bind(id),
    ]);
    const findings = await evidenceCheck(env, user.id, project, criteria.results as { id: string; title: string }[], files.results as { object_key: string; name: string; mime: string }[]);
    const met = findings.filter(f => f.verdict === 'met').length;
    await event(env, id, user.id, 'AI evidence check run', `${met} of ${findings.length} requirements have clear evidence, according to the AI. Advisory only; no decision was changed.`).run();
    return json({ findings });
  }
  if (action === 'revisiondraft' && req.method === 'POST') {
    if (owner || project.status !== 'review') throw new HttpError(403, 'Only the client can draft a revision request during review.');
    const open = await env.DB.prepare("SELECT title, status FROM criteria WHERE project_id = ? AND status != 'met' ORDER BY position").bind(id).all<{ title: string; status: string }>();
    return json({ message: await draftRevision(env, user.id, project, open.results) });
  }
  if (action === 'invite' && req.method === 'POST') {
    if (!owner || project.client_id) throw new HttpError(403, 'Only the project owner can invite a client to an unclaimed project.');
    const code = token();
    const result = await env.DB.prepare('UPDATE projects SET invite_hash = ? WHERE id = ? AND client_id IS NULL').bind(await hash(code), id).run();
    if (!result.meta.changes) throw new HttpError(409, 'A client has already joined.');
    return json({ code });
  }
  if (action === 'accept' && req.method === 'POST') {
    if (owner) throw new HttpError(403, 'The client must accept the agreement.');
    return transition(env, project, user, ['draft'], 'active', 'Agreement accepted', 'The client accepted the scope and agreed price.');
  }
  if (action === 'files' && req.method === 'GET' && itemId) {
    const delivery = await env.DB.prepare('SELECT object_key, name FROM deliveries WHERE id = ? AND project_id = ?').bind(itemId, id).first<{ object_key: string; name: string }>();
    if (!delivery) throw new HttpError(404, 'File not found.');
    const object = await env.FILES.get(delivery.object_key);
    if (!object) throw new HttpError(404, 'File is unavailable.');
    return new Response(object.body, { headers: { 'Content-Type': 'application/octet-stream', 'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(delivery.name)}`, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
  }
  if (action === 'files' && req.method === 'POST' && !itemId) {
    if (!owner || !['active', 'revision'].includes(project.status)) throw new HttpError(403, 'Delivery uploads are available to the freelancer after agreement acceptance.');
    let filename: string;
    try { filename = text(decodeURIComponent(req.headers.get('X-Filename') || ''), 120, 'filename').replace(/[\r\n/\\]/g, '_'); } catch { throw new HttpError(400, 'Please choose a file with a valid name.'); }
    const bytes = await fileBytes(req);
    const mime = fileType(bytes, filename);
    const fileId = crypto.randomUUID();
    const key = `${project.owner_id}/${id}/${fileId}`;
    await env.FILES.put(key, bytes, { httpMetadata: { contentType: mime } });
    try {
      const inserted = await env.DB.batch([
        env.DB.prepare("INSERT INTO deliveries (id, project_id, object_key, name, size, mime) SELECT ?, ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM projects WHERE id = ? AND status IN ('active', 'revision')) AND (SELECT COUNT(*) FROM deliveries WHERE project_id = ?) < 25 AND (SELECT COALESCE(SUM(size), 0) FROM deliveries WHERE project_id = ?) + ? <= 104857600").bind(fileId, id, key, filename, bytes.length, mime, id, id, id, bytes.length),
        env.DB.prepare("INSERT INTO activity (id, project_id, actor_id, title, detail) SELECT ?, ?, ?, 'Delivery file uploaded', ? WHERE changes() > 0").bind(crypto.randomUUID(), id, user.id, filename),
      ]);
      if (!inserted[0].meta.changes) throw new HttpError(409, 'The project changed or reached its limit of 25 files / 100 MB.');
    } catch (error) { await env.FILES.delete(key); throw error; }
    return json({ id: fileId }, 201);
  }
  if (action === 'submit' && req.method === 'POST') {
    if (!owner) throw new HttpError(403, 'Only the freelancer can submit delivery.');
    return transition(env, project, user, ['active', 'revision'], 'review', 'Delivery submitted', 'The client can now review the evidence.', 'AND EXISTS (SELECT 1 FROM deliveries WHERE project_id = projects.id)');
  }
  if (action === 'criteria' && itemId && req.method === 'PATCH') {
    if (owner) throw new HttpError(403, 'Only the client can review requirements.');
    const data = await body(req);
    if (!['met', 'missing', 'uncertain'].includes(String(data.status))) throw new HttpError(400, 'Choose a valid review result.');
    const result = await env.DB.batch([
      env.DB.prepare("UPDATE criteria SET status = ? WHERE id = ? AND project_id = ? AND EXISTS (SELECT 1 FROM projects WHERE id = ? AND status = 'review')").bind(data.status, itemId, id, id),
      env.DB.prepare("INSERT INTO activity (id, project_id, actor_id, title, detail) SELECT ?, ?, ?, 'Requirement reviewed', ? WHERE changes() > 0").bind(crypto.randomUUID(), id, user.id, String(data.status)),
    ]);
    if (!result[0].meta.changes) throw new HttpError(409, 'This requirement is not available for review.');
    return json({ ok: true });
  }
  if (action === 'revision' && req.method === 'POST') {
    if (owner) throw new HttpError(403, 'Only the client can request revisions.');
    const data = await body(req);
    return transition(env, project, user, ['review'], 'revision', 'Revision requested', text(data.message, 2000, 'revision request'));
  }
  if (action === 'approve' && req.method === 'POST') {
    if (owner) throw new HttpError(403, 'Only the client can approve delivery.');
    return transition(env, project, user, ['review'], 'approved', 'Delivery approved', 'Approval recorded. No payment was processed.', "AND NOT EXISTS (SELECT 1 FROM criteria WHERE project_id = projects.id AND status != 'met')");
  }
  throw new HttpError(404, 'Not found.');
}
export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    try { return await route(req, env); }
    catch (error) {
      if (error instanceof HttpError) return json({ error: error.message }, error.status);
      console.error('Request failed', error);
      return json({ error: 'We could not complete that request. Please try again.' }, 500);
    }
  },
};
