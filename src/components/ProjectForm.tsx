import { FormEvent, useState } from 'react';
import { ArrowRight, FileCheck2, Sparkles, X } from 'lucide-react';
import { api, currencies, Currency, money } from '@/lib/api';
import useDialog from '@/components/useDialog';
import AgreementClarity from '@/components/AgreementClarity';

export default function ProjectForm({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => Promise<void> }) {
  const [name, setName] = useState('');
  const [client, setClient] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<Currency>('USD');
  const [criteria, setCriteria] = useState('');
  const [busy, setBusy] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [error, setError] = useState('');
  useDialog(true, onClose, busy);
  const requirementCount = criteria.split('\n').filter(c => c.trim()).length;
  async function draft() {
    setDrafting(true); setError('');
    try {
      const result = await api<{ criteria: string[] }>('/draft-criteria', { method: 'POST', body: JSON.stringify({ name: name.trim() || undefined, description }) });
      if (!Array.isArray(result.criteria) || !result.criteria.length || result.criteria.some(c => typeof c !== 'string')) throw new Error('The AI could not suggest requirements. Please try again.');
      setCriteria(result.criteria.join('\n'));
    } catch (e) { setError(e instanceof Error ? e.message : 'The AI could not suggest requirements.'); }
    finally { setDrafting(false); }
  }
  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError('');
    try {
      const items = criteria.split('\n').map(c => c.trim()).filter(Boolean);
      const result = await api<{ id: string }>('/projects', { method: 'POST', body: JSON.stringify({ name, client_name: client, description, amount_cents: Math.round(Number(amount) * 100), currency, criteria: items }) });
      if (!result.id) throw new Error('Unable to create your project.');
      await onCreated(result.id); onClose();
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to save.'); }
    finally { setBusy(false); }
  }
  return <div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true" aria-labelledby="project-form-title"><button className="modal-close icon-button" aria-label="Close" disabled={busy} onClick={onClose}><X size={20} /></button><div className="dialog-art agreement-art" aria-hidden="true"><span className="art-orbit" /><span className="art-card"><FileCheck2 size={48} strokeWidth={1.5} /></span><span className="art-spark"><Sparkles size={24} /></span><span className="art-label">A shared vision</span></div><span className="dialog-kicker">NEW BEGINNINGS</span><h2 id="project-form-title">Start with a clear agreement.</h2><p>Define the scope now. Invite your client to accept it before delivery begins.</p><form onSubmit={submit}><label>Project name<input autoFocus required maxLength={100} value={name} onChange={e => setName(e.target.value)} placeholder="Sunday Bakery website" /></label><label>Client or business name<input required maxLength={100} value={client} onChange={e => setClient(e.target.value)} /></label><fieldset className="price-field"><legend>Agreed price</legend><div className="currency-chips" role="radiogroup" aria-label="Billing currency">{currencies.map(c => <button type="button" role="radio" aria-checked={currency === c.code} title={`${c.name} · ${c.region}`} key={c.code} className={currency === c.code ? 'selected' : ''} onClick={() => setCurrency(c.code)}>{c.code}</button>)}</div><label className="price-input"><span className="price-symbol">{currency}</span><input type="number" min="0" max="1000000" step="0.01" required aria-label={`Amount in ${currency}`} value={amount} onChange={e => setAmount(e.target.value)} placeholder={currency === 'INR' ? '75000.00' : '1250.00'} /></label><small>{amount !== '' && Number(amount) >= 0 && Number(amount) <= 1000000 ? `Your client will see ${money(Math.round(Number(amount) * 100), currency)} and pay in ${currencies.find(c => c.code === currency)?.name}s.` : 'Bill your client in their local currency. It can\'t be changed after creation.'}</small></fieldset><label>Project scope<textarea rows={3} required maxLength={4000} value={description} onChange={e => setDescription(e.target.value)} /></label><label>Acceptance criteria<textarea rows={5} required maxLength={10000} disabled={drafting} value={criteria} onChange={e => setCriteria(e.target.value)} placeholder={'One requirement per line\nHomepage matches the approved design\nWorking contact form\nResponsive mobile layout'} /><small>{requirementCount}/20 requirements · up to 500 characters each. Scope is fixed after creation.</small></label><button type="button" className="ai-draft-button" disabled={busy || drafting || description.trim().length < 20} onClick={draft}><Sparkles size={16} />{drafting ? 'Drafting clear requirements…' : criteria.trim() ? 'Redraft requirements with AI' : 'Draft requirements from scope with AI'}</button><small className="ai-draft-hint">{description.trim().length < 20 ? 'Describe the scope in a sentence or two to unlock AI drafting.' : 'AI suggests checkable requirements. Edit them freely before creating the agreement.'}</small><AgreementClarity criteria={criteria.split('\n')} audience="freelancer" />{error && <div className="form-message" role="alert">{error}</div>}<div className="modal-actions"><button type="button" className="secondary" disabled={busy} onClick={onClose}>Cancel</button><button className="primary" disabled={busy || drafting || requirementCount < 1 || requirementCount > 20}>{busy ? 'Saving…' : 'Create agreement'}<ArrowRight size={18} /></button></div></form></section></div>;
}
