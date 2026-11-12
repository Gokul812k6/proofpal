import { useState } from 'react';
import { ArrowRightLeft, X } from 'lucide-react';
import useDialog from '@/components/useDialog';
import { currencies, Currency, money } from '@/lib/api';

export default function CurrencyEstimator() {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('100');
  const [from, setFrom] = useState<Currency>('USD');
  const [to, setTo] = useState<Currency>('INR');
  const [rate, setRate] = useState('');
  useDialog(open, () => setOpen(false), false);
  const result = Number(amount) * Number(rate);
  const valid = amount !== '' && Number(amount) >= 0 && Number(rate) > 0 && Number.isFinite(result);
  const options = currencies.map(c => <option key={c.code} value={c.code}>{c.code} · {c.name}</option>);
  return <><button className="secondary" onClick={() => setOpen(true)}><ArrowRightLeft size={18} />Currencies</button>{open && <div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true" aria-labelledby="currency-title"><button className="modal-close icon-button" aria-label="Close currency estimator" onClick={() => setOpen(false)}><X size={20} /></button><span className="modal-symbol"><ArrowRightLeft size={24} /></span><h2 id="currency-title">A little currency clarity.</h2><p>Estimate a price in another currency using your own exchange rate. Each agreement is billed and paid in the currency chosen when it was created.</p><label>Convert from<select value={from} onChange={e => { setFrom(e.target.value as Currency); setRate(''); }}>{options}</select></label><label>Amount in {from}<input autoFocus type="number" min="0" step="any" value={amount} onChange={e => setAmount(e.target.value)} /></label><label>Estimate in<select value={to} onChange={e => { setTo(e.target.value as Currency); setRate(''); }}>{options}</select></label><label>{to} per 1 {from}<input type="number" min="0" step="any" value={from === to ? '1' : rate} disabled={from === to} placeholder="Enter your current exchange rate" onChange={e => setRate(e.target.value)} /></label><div className="currency-result" role="status"><small>ESTIMATED VALUE · {to}</small><strong>{from === to && amount !== '' && Number(amount) >= 0 ? money(Math.round(Number(amount) * 100), to) : valid ? money(Math.round(result * 100), to) : 'Enter an amount and rate'}</strong><p>No live rates or conversion fees included.</p></div><div className="modal-actions"><button className="primary" onClick={() => setOpen(false)}>Done</button></div></section></div>}</>;
}
