import { useState } from 'react';
import { CircleCheck, CircleHelp, Copy, Radar, TriangleAlert, X } from 'lucide-react';
import useDialog from '@/components/useDialog';
import { money, Project } from '@/lib/api';
import { changeOrderMessage, checkScope, ScopeResult } from '@/lib/scope';

const verdicts = {
  covered: { icon: CircleCheck, title: 'Already in the agreement', body: 'This request matches what you both agreed on, so it\'s part of the original price.' },
  partial: { icon: CircleHelp, title: 'Partly covered', body: 'This is close to an agreed item but seems to go further. Agree on the extra part before starting it.' },
  new: { icon: TriangleAlert, title: 'Looks like new work', body: 'Nothing in the agreement covers this. Treat it as a change order with its own price and timeline.' },
};

export default function ScopeGuard({ project, criteria, owner, notify }: { project: Project; criteria: string[]; owner: boolean; notify: (message: string) => void }) {
  const [open, setOpen] = useState(false);
  const [request, setRequest] = useState('');
  const [result, setResult] = useState<ScopeResult | null>(null);
  const [price, setPrice] = useState(() => String(Math.max(1, Math.round(project.amount_cents * 0.15 / 100))));
  const [days, setDays] = useState('2');
  useDialog(open, () => setOpen(false), false);
  const audience = owner ? 'freelancer' : 'client';
  const priceCents = Math.round(Number(price) * 100);
  const validPrice = Number.isFinite(priceCents) && priceCents > 0;
  const dayCount = Math.max(1, Math.min(365, Math.round(Number(days)) || 1));
  const message = result && result.verdict !== 'covered' ? changeOrderMessage({ project: project.name, request, price: validPrice ? money(priceCents, project.currency) : 'to be agreed', days: dayCount, audience }) : '';
  const Verdict = result ? verdicts[result.verdict].icon : null;

  async function copy() {
    try { await navigator.clipboard.writeText(message); notify('Change-order message copied.'); }
    catch { notify('Copy was blocked by your browser. Select the message and copy it manually.'); }
  }

  return <>
    <div className="scope-card"><Radar size={24} /><div><strong>Scope check</strong><p>{owner ? 'Got a new request from your client? Check it against the agreement before saying yes.' : 'Want something new? See if it\'s already covered before you ask.'}</p></div><button className="secondary" onClick={() => { setOpen(true); setResult(null); }}>Check a request</button></div>
    {open && <div className="modal-backdrop"><section className="modal scope-modal" role="dialog" aria-modal="true" aria-labelledby="scope-title">
      <button className="modal-close icon-button" aria-label="Close" onClick={() => setOpen(false)}><X size={20} /></button>
      <span className="dialog-kicker">SCOPE CHECK</span>
      <h2 id="scope-title">Is this part of the deal?</h2>
      <p>Paste the request. ProofPal compares it with the {criteria.length} success criteria in this agreement.</p>
      <form onSubmit={e => { e.preventDefault(); setResult(checkScope(request, criteria)); }}>
        <label>The request<textarea autoFocus required rows={3} maxLength={600} placeholder="e.g. Can you also add an online booking page?" value={request} onChange={e => { setRequest(e.target.value); setResult(null); }} /></label>
        <div className="modal-actions"><button className="primary" disabled={!request.trim()}>Check against agreement</button></div>
      </form>
      {result && Verdict && <div className={`scope-result ${result.verdict}`} role="status">
        <div className="scope-verdict"><Verdict size={24} /><div><strong>{verdicts[result.verdict].title}</strong><p>{verdicts[result.verdict].body}</p>{result.match && result.verdict !== 'new' && <small>Closest agreed item: "{result.match}"</small>}</div></div>
        {result.verdict !== 'covered' && <>
          {owner && <div className="scope-inputs"><label>Extra price ({project.currency})<input type="number" min="1" step="1" value={price} onChange={e => setPrice(e.target.value)} /></label><label>Extra working days<input type="number" min="1" max="365" value={days} onChange={e => setDays(e.target.value)} /></label></div>}
          <pre className="scope-message">{message}</pre>
          <button className="primary" type="button" onClick={copy}><Copy size={16} />Copy message</button>
        </>}
      </div>}
    </section></div>}
  </>;
}
