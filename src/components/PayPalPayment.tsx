import { useCallback, useEffect, useRef, useState } from 'react';
import { api, Currency } from '@/lib/api';

interface Buttons { render: (element: HTMLElement) => Promise<void>; close: () => void }
interface Messages { render: (element: HTMLElement) => Promise<void> }
declare global { interface Window { paypal?: { Buttons: (options: { style: Record<string, string>; createOrder: () => Promise<string>; onApprove: (data: { orderID: string }) => Promise<void>; onCancel: () => void; onError: () => void }) => Buttons; Messages?: (options: { amount: number; currency: string; placement: string; style: Record<string, unknown> }) => Messages } } }

const payLaterCurrencies = ['USD', 'GBP', 'EUR', 'AUD'];

export default function PayPalPayment({ projectId, currency, amountCents, refresh }: { projectId: string; currency: Currency; amountCents: number; refresh: () => Promise<void> }) {
  const container = useRef<HTMLDivElement>(null);
  const messages = useRef<HTMLDivElement>(null);
  const [message, setMessage] = useState('Connecting sandbox checkout…');
  const [retryOrder, setRetryOrder] = useState('');
  const [busy, setBusy] = useState(false);
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  const confirm = useCallback(async (orderId: string) => {
    setBusy(true);
    try {
      await api(`/projects/${projectId}/payment`, { method: 'POST', body: JSON.stringify({ orderId }) });
      setRetryOrder('');
      setMessage('Sandbox payment completed. No real money was charged.');
      await refreshRef.current();
    } catch (error) { setRetryOrder(orderId); setMessage(error instanceof Error ? error.message : 'Could not confirm payment. Retry confirmation before starting another payment.'); }
    finally { setBusy(false); }
  }, [projectId]);
  useEffect(() => {
    let cancelled = false;
    let buttons: Buttons | undefined;
    async function setup() {
      try {
        const config = await api<{ configured: boolean; clientId: string }>('/paypal');
        if (!config.configured) throw new Error('Checkout is waiting for a replacement PayPal Secret to be stored securely on the payment server.');
        const loaded = document.getElementById('paypal-sdk') as HTMLScriptElement | null;
        if (loaded && loaded.dataset.currency !== currency) { loaded.remove(); delete window.paypal; }
        if (!window.paypal) {
          await new Promise<void>((resolve, reject) => {
            const existing = document.getElementById('paypal-sdk');
            const script = existing || document.createElement('script');
            script.addEventListener('load', () => resolve(), { once: true });
            script.addEventListener('error', () => { script.remove(); reject(new Error('PayPal could not load. Refresh to try again.')); }, { once: true });
            if (!existing) { (script as HTMLScriptElement).src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(config.clientId)}&currency=${currency}&intent=capture&components=buttons,messages&enable-funding=venmo,paylater,card`; script.id = 'paypal-sdk'; (script as HTMLScriptElement).dataset.currency = currency; document.body.appendChild(script); }
          });
        }
        if (cancelled || !container.current || !window.paypal) return;
        buttons = window.paypal.Buttons({
          style: { layout: 'vertical', shape: 'rect', color: 'gold', label: 'pay' },
          createOrder: async () => {
            const result = await api<{ orderId: string }>(`/projects/${projectId}/payment`, { method: 'POST', body: '{}' });
            if (typeof result.orderId !== 'string') throw new Error('PayPal returned an invalid order.');
            return result.orderId;
          },
          onApprove: async ({ orderID }) => { if (!cancelled) await confirm(orderID); },
          onCancel: () => { if (!cancelled) setMessage('Payment cancelled. No completed payment was recorded.'); },
          onError: () => { if (!cancelled) setMessage('PayPal checkout could not finish. Please retry or check the payment server settings.'); },
        });
        await buttons.render(container.current);
        if (!cancelled) setMessage('Pay with PayPal, Venmo, Pay Later or a card where eligible. Sandbox test money only.');
        if (!cancelled && messages.current && window.paypal.Messages && payLaterCurrencies.includes(currency)) {
          void window.paypal.Messages({ amount: amountCents / 100, currency, placement: 'payment', style: { layout: 'text', logo: { type: 'inline' }, text: { color: 'black', size: 12 } } }).render(messages.current).catch(() => undefined);
        }
      } catch (error) { if (!cancelled) setMessage(error instanceof Error ? error.message : 'Unable to load sandbox checkout.'); }
    }
    void setup();
    return () => { cancelled = true; buttons?.close(); };
  }, [projectId, currency, amountCents, confirm]);
  return <div className="invite-card paypal-card"><strong>PayPal sandbox checkout</strong><p role="status">{message}</p><div ref={messages} className="paypal-messages" /><div ref={container} />{retryOrder && <button className="secondary wide" disabled={busy} onClick={() => confirm(retryOrder)}>{busy ? 'Confirming…' : 'Retry payment confirmation'}</button>}<p>Payment goes to ProofPal’s test merchant account. This is not escrow or a payout to your freelancer.</p>{currency === 'INR' && <p>PayPal only processes Indian rupee payments between India-registered PayPal accounts.</p>}</div>;
}
