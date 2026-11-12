export type ScopeVerdict = 'covered' | 'partial' | 'new';
export interface ScopeResult { verdict: ScopeVerdict; match: string | null; overlap: number }

const stop = new Set('a an the and or but of to for in on at by with from into is are be can could would should will please also just need needs want wants we you i it its this that our your my me us they them add make some more new another one all any have has do does so as if then than very really like page site website app screen section part thing stuff project'.split(' '));
const stem = (w: string) => w.replace(/(ing|ed|es|s)$/, '');
const tokens = (text: string) => new Set(text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 2 && !stop.has(w)).map(stem));
const expansion = /\b(also|another|extra|additional|more|new|second|too|as well|while you'?re at it|one more|quick(ly)? add)\b/i;

export function checkScope(request: string, criteria: string[]): ScopeResult {
  const asked = tokens(request);
  if (!asked.size) return { verdict: 'new', match: null, overlap: 0 };
  let best = { match: null as string | null, overlap: 0 };
  for (const c of criteria) {
    const have = tokens(c);
    const shared = [...asked].filter(w => have.has(w)).length;
    const overlap = shared / Math.min(asked.size, Math.max(have.size, 1));
    if (overlap > best.overlap) best = { match: c, overlap };
  }
  const verdict: ScopeVerdict = best.overlap >= 0.6 && !expansion.test(request) ? 'covered' : best.overlap >= 0.4 ? 'partial' : 'new';
  return { verdict, ...best };
}

export function changeOrderMessage({ project, request, price, days, audience }: { project: string; request: string; price: string; days: number; audience: 'freelancer' | 'client' }) {
  if (audience === 'client') return `Hi! For "${project}", I'd like to request something that may be outside our original agreement:\n\n"${request.trim()}"\n\nCould you send me a quote and timeline for this as a separate change? Happy to keep the current deliverables on track first.`;
  return `Thanks for the request! For "${project}", this falls outside the success criteria we agreed on:\n\n"${request.trim()}"\n\nI'm happy to take it on as a change order:\n- Additional cost: ${price}\n- Additional time: ${days} working day${days === 1 ? '' : 's'}\n\nIf that works for you, reply to approve and I'll add it to the agreement. The original deliverables stay on schedule either way.`;
}
