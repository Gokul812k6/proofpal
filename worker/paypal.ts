import { Env, HttpError } from './auth';

const base = 'https://api-m.sandbox.paypal.com';
export const paypalClientId = 'BAAzFPf9QXTRIr6y1m8n920PvHlzKf9DvIUAqQW3hK8o61xQfim8ONVt5gROgChpzqxLqxgMwv5H8UZ6ow';
interface Order {
  id: string;
  status: string;
  purchase_units: { custom_id: string; invoice_id: string; amount: { currency_code: string; value: string }; payments?: { captures?: { id: string; status: string; amount: { currency_code: string; value: string } }[] } }[];
}
async function accessToken(env: Env) {
  if (!env.PAYPAL_SECRET) throw new HttpError(503, 'Sandbox checkout needs a replacement PayPal Secret added securely to the payment server.');
  const response = await fetch(`${base}/v1/oauth2/token`, { method: 'POST', headers: { Authorization: `Basic ${btoa(`${paypalClientId}:${env.PAYPAL_SECRET}`)}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=client_credentials' });
  const data = await response.json() as { access_token?: string };
  if (!response.ok || typeof data.access_token !== 'string') throw new HttpError(502, 'PayPal could not connect. Please check the sandbox credentials.');
  return data.access_token;
}
export async function paypalOrder(env: Env, path: string, method: string, payload?: object, requestId?: string): Promise<Order> {
  const response = await fetch(`${base}/v2/checkout/orders${path}`, { method, headers: { Authorization: `Bearer ${await accessToken(env)}`, 'Content-Type': 'application/json', ...(requestId ? { 'PayPal-Request-Id': requestId } : {}) }, ...(payload ? { body: JSON.stringify(payload) } : {}) });
  const data = await response.json() as Order;
  if (!response.ok || typeof data.id !== 'string' || typeof data.status !== 'string') throw new HttpError(502, 'PayPal could not complete this request. No payment confirmation was recorded; try again.');
  return data;
}
export function verifyOrder(order: Order, project: { id: string; amount_cents: number; currency: string }, userId: string) {
  const unit = order.purchase_units?.[0];
  if (order.purchase_units?.length !== 1 || unit?.custom_id !== `${project.id}:${userId}` || unit.invoice_id !== `proofpal-${project.id}` || unit.amount?.currency_code !== project.currency || unit.amount.value !== (project.amount_cents / 100).toFixed(2)) throw new HttpError(400, 'This payment does not match your project.');
  return unit;
}
