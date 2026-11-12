export interface Env { DB: D1Database; FILES: R2Bucket; AI?: Ai; PAYPAL_SECRET?: string }
export interface User { id: string; email: string; name: string }
export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
}
export function text(value: unknown, max: number, label: string): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new HttpError(400, `Please enter a valid ${label}.`);
  return value.trim();
}
export async function body(req: Request): Promise<Record<string, unknown>> {
  if (Number(req.headers.get('content-length') || 0) > 16000) throw new HttpError(413, 'This request is too large.');
  const raw = await req.text();
  if (raw.length > 16000) throw new HttpError(413, 'This request is too large.');
  try {
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error();
    return data;
  } catch { throw new HttpError(400, 'Please check your submitted details.'); }
}
export async function hash(value: string): Promise<string> {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))), n => n.toString(16).padStart(2, '0')).join('');
}
export function token(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), n => n.toString(16).padStart(2, '0')).join('');
}
async function passwordHash(password: string, salt: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode(salt), iterations: 100000 }, key, 256);
  return Array.from(new Uint8Array(bits), n => n.toString(16).padStart(2, '0')).join('');
}
function equal(a: string, b: string) {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}
async function rateLimit(req: Request, env: Env) {
  const now = Date.now();
  const key = await hash(`auth:${req.headers.get('CF-Connecting-IP') || 'local'}:${Math.floor(now / 60000)}`);
  const result = await env.DB.prepare('INSERT INTO rate_limits (key, count, expires_at) VALUES (?, 1, ?) ON CONFLICT(key) DO UPDATE SET count = count + 1 RETURNING count').bind(key, now + 120000).first<{ count: number }>();
  if (!result || result.count > 15) throw new HttpError(429, 'Too many attempts. Please wait a minute.');
}
export async function authenticate(req: Request, env: Env): Promise<User> {
  const bearer = req.headers.get('Authorization')?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
  if (!bearer) throw new HttpError(401, 'Please sign in to continue.');
  const user = await env.DB.prepare('SELECT u.id, u.email, u.name FROM users u JOIN sessions s ON s.user_id = u.id WHERE s.token_hash = ? AND s.expires_at > ?').bind(await hash(bearer), Date.now()).first<User>();
  if (!user) throw new HttpError(401, 'Your session ended. Please sign in again.');
  return user;
}
export async function authRoute(req: Request, env: Env, path: string) {
  if (req.method === 'GET' && path === '/api/auth/me') return json({ user: await authenticate(req, env) });
  if (req.method === 'POST' && path === '/api/auth/logout') {
    await authenticate(req, env);
    await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await hash(req.headers.get('Authorization')!.slice(7))).run();
    return json({ ok: true });
  }
  if (req.method === 'PUT' && path === '/api/auth/profile') {
    const user = await authenticate(req, env);
    const data = await body(req);
    const name = text(data.name, 80, 'name');
    await env.DB.prepare('UPDATE users SET name = ? WHERE id = ?').bind(name, user.id).run();
    return json({ user: { ...user, name } });
  }
  if (req.method === 'POST' && path === '/api/auth/password') {
    const user = await authenticate(req, env);
    await rateLimit(req, env);
    const data = await body(req);
    if (typeof data.current_password !== 'string' || data.current_password.length > 128 || typeof data.new_password !== 'string' || data.new_password.length < 12 || data.new_password.length > 128) throw new HttpError(400, 'Use a new password with 12–128 characters and enter your current password.');
    const record = await env.DB.prepare('SELECT salt, password_hash FROM users WHERE id = ?').bind(user.id).first<{ salt: string; password_hash: string }>();
    if (!record || !equal(await passwordHash(data.current_password, record.salt), record.password_hash)) throw new HttpError(400, 'Unable to change password. Check your current password.');
    if (data.current_password === data.new_password) throw new HttpError(400, 'Choose a different new password.');
    const salt = token();
    const digest = await passwordHash(data.new_password, salt);
    const updated = await env.DB.prepare('UPDATE users SET salt = ?, password_hash = ? WHERE id = ? AND password_hash = ?').bind(salt, digest, user.id, record.password_hash).run();
    if (!updated.meta.changes) throw new HttpError(409, 'Your password changed during this request. Please try again.');
    await env.DB.prepare('DELETE FROM sessions WHERE user_id = ? AND token_hash != ?').bind(user.id, await hash(req.headers.get('Authorization')!.slice(7))).run();
    return json({ ok: true });
  }
  if (req.method !== 'POST' || !['/api/auth/signup', '/api/auth/login'].includes(path)) throw new HttpError(404, 'Not found.');
  await rateLimit(req, env);
  const data = await body(req);
  const email = text(data.email, 254, 'email address').toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, 'Please enter a valid email address.');
  if (typeof data.password !== 'string' || data.password.length < 12 || data.password.length > 128) throw new HttpError(400, 'Use a password with 12–128 characters.');
  const password = data.password;
  if (path.endsWith('signup')) {
    const name = text(data.name, 80, 'name');
    const salt = token();
    const digest = await passwordHash(password, salt);
    await env.DB.prepare('INSERT OR IGNORE INTO users (id, email, name, salt, password_hash) VALUES (?, ?, ?, ?, ?)').bind(crypto.randomUUID(), email, name, salt, digest).run();
    return json({ message: 'If these details are available, your account is ready. Please sign in with your password.' });
  }
  const record = await env.DB.prepare('SELECT id, email, name, salt, password_hash FROM users WHERE email = ?').bind(email).first<User & { salt: string; password_hash: string }>();
  const digest = await passwordHash(password, record?.salt || 'unregistered-account-salt');
  if (!record || !equal(digest, record.password_hash)) throw new HttpError(401, 'Unable to sign in. Check your email and password.');
  const sessionToken = token();
  await env.DB.batch([
    env.DB.prepare('DELETE FROM sessions WHERE expires_at < ?').bind(Date.now()),
    env.DB.prepare('DELETE FROM rate_limits WHERE expires_at < ?').bind(Date.now()),
    env.DB.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)').bind(await hash(sessionToken), record.id, Date.now() + 7 * 86400000),
  ]);
  return json({ token: sessionToken, user: { id: record.id, email: record.email, name: record.name } });
}
