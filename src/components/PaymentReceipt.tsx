import { BadgeCheck, Copy } from 'lucide-react';
import { Activity, date, money } from '@/lib/api';

export default function PaymentReceipt({ payment, notify }: { payment: Activity; notify: (message: string) => void }) {
  const match = payment.detail.match(/^([A-Z]{3}) (\d+\.\d{2}) · PayPal capture ([A-Z0-9]+)/);
  const amount = match ? money(Math.round(Number(match[2]) * 100), match[1]) : null;
  const captureId = match?.[3] ?? null;
  async function copy() {
    if (!captureId) return;
    try { await navigator.clipboard.writeText(captureId); notify('PayPal transaction ID copied.'); }
    catch { notify('Copy was blocked by your browser. Select the ID and copy it manually.'); }
  }
  return <div className="receipt-card">
    <div className="receipt-head"><BadgeCheck size={24} /><div><strong>Paid with PayPal</strong><small>{date(payment.created_at)}</small></div>{amount && <span className="receipt-amount">{amount}</span>}</div>
    <dl>
      <div><dt>Status</dt><dd><span className="receipt-status">Captured</span></dd></div>
      {captureId && <div><dt>Transaction ID</dt><dd><code>{captureId}</code><button className="icon-button" aria-label="Copy transaction ID" title="Copy transaction ID" onClick={copy}><Copy size={14} /></button></dd></div>}
      <div><dt>Verified by</dt><dd>Server-side PayPal order check</dd></div>
    </dl>
    <p>Sandbox test payment. No real money moved, and this is not escrow or a payout to the freelancer.</p>
  </div>;
}
