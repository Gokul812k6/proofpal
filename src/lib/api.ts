export const currencies = [
  { code: 'USD', name: 'US dollar', region: 'United States' },
  { code: 'INR', name: 'Indian rupee', region: 'India' },
  { code: 'EUR', name: 'Euro', region: 'Eurozone' },
  { code: 'GBP', name: 'British pound', region: 'United Kingdom' },
  { code: 'CAD', name: 'Canadian dollar', region: 'Canada' },
  { code: 'AUD', name: 'Australian dollar', region: 'Australia' },
  { code: 'SGD', name: 'Singapore dollar', region: 'Singapore' },
] as const;
export type Currency = typeof currencies[number]['code'];
export const isCurrency = (value: unknown): value is Currency => currencies.some(c => c.code === value);
export interface User { id: string; name: string; email: string }
export interface Project { id: string; owner_id: string; client_id: string | null; name: string; client_name: string; description: string; amount_cents: number; currency: Currency; status: 'draft' | 'active' | 'review' | 'revision' | 'approved'; created_at: string }
export interface Criterion { id: string; title: string; status: 'met' | 'missing' | 'uncertain' }
export interface Delivery { id: string; name: string; size: number; mime: string; created_at: string }
export interface Activity { id: string; title: string; detail: string; created_at: string }
export interface Detail { project: Project; criteria: Criterion[]; deliveries: Delivery[]; activity: Activity[] }
export function getToken() { return sessionStorage.getItem('proofpay-session'); }
export function clearToken() { sessionStorage.removeItem('proofpay-session'); }
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (getToken()) headers.set('Authorization', `Bearer ${getToken()}`);
  if (typeof options.body === 'string') headers.set('Content-Type', 'application/json');
  let response: Response;
  try { response = await fetch(`/api${path}`, { ...options, headers }); }
  catch { throw new Error('Unable to reach your workspace. Please check your connection.'); }
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Unable to complete this request. Please try again.');
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('The workspace returned an unexpected response.');
  return data as T;
}
export async function fileBlob(projectId: string, file: Delivery) {
  const response = await fetch(`/api/projects/${projectId}/files/${file.id}`, { headers: { Authorization: `Bearer ${getToken() || ''}` } });
  if (!response.ok) throw new Error('Unable to download this file. Please sign in and try again.');
  return response.blob();
}
export async function download(projectId: string, file: Delivery) {
  const url = URL.createObjectURL(await fileBlob(projectId, file));
  const link = document.createElement('a');
  link.href = url; link.download = file.name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export const money = (cents: number, currency: string = 'USD') => new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', { style: 'currency', currency }).format(cents / 100);
export function totalsByCurrency(projects: Project[]) {
  const totals = new Map<Currency, number>();
  for (const p of projects) totals.set(p.currency, (totals.get(p.currency) || 0) + p.amount_cents);
  return totals.size ? [...totals].map(([currency, cents]) => money(cents, currency)).join(' · ') : money(0);
}
export const date = (value: string) => new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
export const statuses: Record<Project['status'], string> = { draft: 'Awaiting agreement', active: 'In progress', review: 'In review', revision: 'Revision requested', approved: 'Delivery approved' };
