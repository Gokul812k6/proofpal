import { FormEvent, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import ProofPalLogo from '@/components/ProofPalLogo';
import HowItWorks from '@/components/HowItWorks';
import { api, User } from '@/lib/api';

export default function Auth({ onLogin }: { onLogin: (user: User) => void }) {
  const [signup, setSignup] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setMessage('');
    try {
      if (signup) {
        const result = await api<{ message: string }>('/auth/signup', { method: 'POST', body: JSON.stringify({ name, email, password }) });
        setMessage(result.message); setSignup(false);
      } else {
        const result = await api<{ token: string; user: User }>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
        if (!/^[a-f0-9]{64}$/.test(result.token) || !result.user?.id || !result.user?.name || !result.user?.email) throw new Error('Unable to sign in. Please try again.');
        sessionStorage.setItem('proofpay-session', result.token);
        onLogin(result.user);
      }
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Please try again.'); }
    finally { setBusy(false); }
  }

  return (
    <div className="auth-page">
      <section className="auth-story">
        <div className="auth-brand-row">
          <div className="brand"><ProofPalLogo /></div>
          <span className="hackathon-badge">For PayPal Hackathon</span>
        </div>
        <div>
          <span className="eyebrow">CLARITY BEFORE PAYMENT</span>
          <h1>{signup ? <>A shared vision.<br />A better beginning.</> : <>Good work deserves<br />a confident handoff.</>}</h1>
          <p>{signup ? <>Bring your projects, people, and expectations<br />together in one thoughtful workspace.</> : <>Agree on the details. Share your evidence.<br />Make the next decision together.</>}</p>
          <img
            className="auth-illustration"
            src={signup ? '/signup-illustration.webp' : '/login-illustration.webp'}
            alt={signup ? 'Two people collaborating on a project agreement' : 'A freelancer checking a project delivery at their laptop'}
            width={640}
            height={360}
          />
          <div className="auth-features"><span>Private project workspaces</span><span>Invite-only delivery files</span></div>
        </div>
        <small>Built for clearer collaborations. Powered by Cloudflare.</small>
      </section>
      <section className="auth-form panel">
        <span className="auth-form-eyebrow">{signup ? 'YOUR NEXT CHAPTER' : 'YOUR PRIVATE WORKSPACE'}</span>
        <h2>{signup ? 'Start with a little clarity.' : 'Welcome back.'}</h2>
        <p className="muted">{signup ? 'Create your account to send or review a project.' : 'Sign in to your private ProofPal workspace.'}</p>
        <form onSubmit={submit}>
          {signup && <label>Your name<input required maxLength={80} autoComplete="name" value={name} onChange={e => setName(e.target.value)} /></label>}
          <label>Email address<input type="email" required maxLength={254} autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} /></label>
          <label>Password<input type="password" required minLength={12} maxLength={128} autoComplete={signup ? 'new-password' : 'current-password'} value={password} onChange={e => setPassword(e.target.value)} /><small>At least 12 characters. Use a unique password.</small></label>
          {message && <div role="status" className="form-message">{message}</div>}
          <button className="primary wide" disabled={busy}>{busy ? 'Please wait…' : signup ? 'Create account' : 'Sign in'}<ArrowRight size={18} /></button>
        </form>
        <button className="text-button" disabled={busy} onClick={() => { setSignup(!signup); setMessage(''); }}>{signup ? 'Already have an account? Sign in' : 'New to ProofPal? Create an account'}</button>
        <HowItWorks variant="link" />
        <p className="auth-footnote">For PayPal Hackathon. No automatic approvals or charges. PayPal runs in sandbox (test) mode.</p>
        <a className="maker-link" href="https://heygokul.in" target="_blank" rel="noopener noreferrer">Built by Gokul · heygokul.in</a>
      </section>
    </div>
  );
}
