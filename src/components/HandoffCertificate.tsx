import { useEffect, useState } from 'react';
import { BadgeCheck, CircleCheck, ClipboardCopy, Clock, Fingerprint, Printer, ShieldCheck, Wallet, X } from 'lucide-react';
import ProofPalLogo from '@/components/ProofPalLogo';
import useDialog from '@/components/useDialog';
import { date, Detail, fileBlob, money } from '@/lib/api';

const milestones = ['Agreement created', 'Client joined the project', 'Agreement accepted', 'Delivery submitted', 'Revision requested', 'Delivery approved', 'Sandbox payment completed'];

async function sha256(data: BufferSource) {
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
}

export default function HandoffCertificate({ detail, onClose, notify }: { detail: Detail; onClose: () => void; notify: (message: string) => void }) {
  const { project, criteria, deliveries, activity } = detail;
  const [hashes, setHashes] = useState<Record<string, string> | null>(null);
  const [seal, setSeal] = useState('');
  const [failed, setFailed] = useState(false);
  useDialog(true, onClose, false);
  const timeline = activity.filter(a => milestones.includes(a.title)).sort((a, b) => a.created_at.localeCompare(b.created_at));
  const approval = timeline.find(a => a.title === 'Delivery approved');
  const payment = timeline.find(a => a.title === 'Sandbox payment completed');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const entries = await Promise.all(deliveries.map(async f => [f.id, await sha256(await (await fileBlob(project.id, f)).arrayBuffer())] as const));
        const manifest = [project.id, project.amount_cents, project.currency, ...criteria.map(c => `${c.title}:${c.status}`), ...entries.map(([, h]) => h).sort(), approval?.created_at || ''].join('\n');
        const combined = await sha256(new TextEncoder().encode(manifest));
        if (!cancelled) { setHashes(Object.fromEntries(entries)); setSeal(combined); }
      } catch { if (!cancelled) setFailed(true); }
    })();
    return () => { cancelled = true; };
  }, [project, criteria, deliveries, approval?.created_at]);

  const certificateId = seal ? `PP-${seal.slice(0, 4)}-${seal.slice(4, 8)}-${seal.slice(8, 12)}`.toUpperCase() : 'Sealing…';
  async function copySummary() {
    const text = [
      `ProofPal Verified Handoff Certificate ${certificateId}`,
      `${project.name} for ${project.client_name}`,
      `Agreed value: ${money(project.amount_cents, project.currency)} ${project.currency}`,
      `Requirements met: ${criteria.filter(c => c.status === 'met').length}/${criteria.length}`,
      ...criteria.map(c => `  - ${c.title}`),
      `Approved: ${approval ? date(approval.created_at) : 'Pending'}`,
      `Payment: ${payment ? payment.detail : 'Awaiting PayPal checkout'}`,
      `Delivery fingerprint (SHA-256): ${seal}`,
    ].join('\n');
    try { await navigator.clipboard.writeText(text); notify('Certificate summary copied.'); }
    catch { notify('Copy is unavailable in this browser. Use Save as PDF instead.'); }
  }

  return <div className="modal-backdrop certificate-backdrop"><section className="certificate" role="dialog" aria-modal="true" aria-labelledby="certificate-title">
    <button className="modal-close icon-button certificate-close" aria-label="Close" onClick={onClose}><X size={20} /></button>
    <div className="certificate-strip" aria-hidden="true" />
    <header className="certificate-head">
      <ProofPalLogo />
      <div className="certificate-id"><small>CERTIFICATE ID</small><strong>{certificateId}</strong></div>
    </header>
    <div className="certificate-hero">
      <span className="certificate-seal" aria-hidden="true"><BadgeCheck size={44} strokeWidth={1.6} /></span>
      <span className="eyebrow">VERIFIED HANDOFF</span>
      <h2 id="certificate-title">{project.name}</h2>
      <p>Delivered to <strong>{project.client_name}</strong> and approved by a person against every agreed requirement.</p>
    </div>
    <div className="certificate-facts">
      <div><small>Agreed value</small><strong>{money(project.amount_cents, project.currency)}</strong><span>{project.currency}</span></div>
      <div><small>Requirements met</small><strong>{criteria.filter(c => c.status === 'met').length}/{criteria.length}</strong><span>Human-reviewed</span></div>
      <div><small>Approved</small><strong>{approval ? new Date(approval.created_at).toLocaleDateString(undefined, { dateStyle: 'medium' }) : 'Pending'}</strong><span>{approval ? 'Final decision' : 'Awaiting client'}</span></div>
      <div className={payment ? 'paid' : ''}><small>Payment</small><strong>{payment ? 'Paid' : 'Pending'}</strong><span>{payment ? 'PayPal sandbox' : 'PayPal checkout next'}</span></div>
    </div>
    <div className="certificate-grid">
      <section>
        <h3><CircleCheck size={18} />Agreed requirements</h3>
        <ol className="certificate-criteria">{criteria.map(c => <li key={c.id}><span className={c.status === 'met' ? 'met' : ''}><CircleCheck size={16} /></span>{c.title}</li>)}</ol>
        <h3><Clock size={18} />Handoff timeline</h3>
        <ol className="certificate-timeline">{timeline.map(a => <li key={a.id}><strong>{a.title}</strong><small>{date(a.created_at)}</small></li>)}</ol>
      </section>
      <section>
        <h3><Fingerprint size={18} />Delivery fingerprint</h3>
        <p className="muted">A SHA-256 fingerprint of every delivered file. If any file changes, its fingerprint changes too, so both sides can prove exactly what was handed over.</p>
        {deliveries.map(f => <div className="certificate-file" key={f.id}><strong>{f.name}</strong><code>{hashes ? hashes[f.id] : failed ? 'Unavailable' : 'Computing…'}</code></div>)}
        <div className="certificate-file sealed"><strong><ShieldCheck size={16} />Certificate seal</strong><code>{seal || (failed ? 'Files could not be read. Refresh and try again.' : 'Computing…')}</code></div>
        {payment && <div className="certificate-payment"><Wallet size={18} /><p>{payment.detail}</p></div>}
      </section>
    </div>
    <footer className="certificate-foot">
      <span><ShieldCheck size={16} />Human-approved. AI was advisory only.</span>
      <div className="certificate-actions">
        <button className="secondary" disabled={!seal} onClick={copySummary}><ClipboardCopy size={16} />Copy summary</button>
        <button className="primary" disabled={!seal} onClick={() => window.print()}><Printer size={16} />Save as PDF</button>
      </div>
    </footer>
  </section></div>;
}
