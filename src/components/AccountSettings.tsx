import { FormEvent, useState } from 'react';
import { Check, LockKeyhole, Settings, UserRound, X } from 'lucide-react';
import { api, User } from '@/lib/api';
import useDialog from '@/components/useDialog';

export default function AccountSettings({ user, onUpdate }: { user: User; onUpdate: (user: User) => void }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState('profile');
  const [name, setName] = useState(user.name);
  const [current, setCurrent] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  function close() { setOpen(false); setCurrent(''); setPassword(''); setConfirmation(''); }
  useDialog(open, close, busy);
  async function save(event: FormEvent) {
    event.preventDefault(); setError(''); setSuccess('');
    if (tab === 'security' && password !== confirmation) { setError('Your new passwords do not match.'); return; }
    setBusy(true);
    try {
      if (tab === 'profile') {
        const result = await api<{ user: User }>('/auth/profile', { method: 'PUT', body: JSON.stringify({ name: name.trim() }) });
        if (result.user?.id !== user.id || typeof result.user.name !== 'string' || !result.user.name.trim() || typeof result.user.email !== 'string') throw new Error('Unable to read your updated profile.');
        onUpdate(result.user); setName(result.user.name); setSuccess('Your profile has been saved.');
      } else {
        const result = await api<{ ok: boolean }>('/auth/password', { method: 'POST', body: JSON.stringify({ current_password: current, new_password: password }) });
        if (result.ok !== true) throw new Error('Unable to confirm your password change.');
        setCurrent(''); setPassword(''); setConfirmation(''); setSuccess('Password updated. Other signed-in sessions have been ended.');
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to save your changes.'); }
    finally { setBusy(false); }
  }
  const initials = user.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
  return <><button className="icon-button" title="Account settings" aria-label="Account settings" onClick={() => { setName(user.name); setError(''); setSuccess(''); setOpen(true); }}><Settings size={20} /></button>{open && <div className="modal-backdrop"><section className="modal account-modal" role="dialog" aria-modal="true" aria-labelledby="account-title"><button className="modal-close icon-button" aria-label="Close account settings" disabled={busy} onClick={close}><X size={20} /></button><div className="account-identity"><span className="avatar account-avatar">{initials}</span><div><span className="dialog-kicker">YOUR PRIVATE ACCOUNT</span><h2 id="account-title">Make yourself at home.</h2></div></div><div className="settings-tabs" aria-label="Account sections"><button className={tab === 'profile' ? 'selected' : ''} disabled={busy} aria-pressed={tab === 'profile'} onClick={() => { setTab('profile'); setError(''); setSuccess(''); }}><UserRound size={18} />Profile</button><button className={tab === 'security' ? 'selected' : ''} disabled={busy} aria-pressed={tab === 'security'} onClick={() => { setTab('security'); setError(''); setSuccess(''); }}><LockKeyhole size={18} />Security</button></div><form onSubmit={save}>{tab === 'profile' ? <><label>Display name<input required maxLength={80} autoComplete="name" value={name} onChange={e => setName(e.target.value)} /><small>This name appears in your workspace and shared projects.</small></label><label>Email address<input type="email" value={user.email} readOnly /><small>Your sign-in email cannot be changed here.</small></label></> : <><p className="settings-description">Choose a strong password. Changing it signs out your other sessions while keeping this one open.</p><label>Current password<input type="password" required maxLength={128} autoComplete="current-password" value={current} onChange={e => setCurrent(e.target.value)} /></label><label>New password<input type="password" required minLength={12} maxLength={128} autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} /><small>Use 12–128 characters.</small></label><label>Confirm new password<input type="password" required minLength={12} maxLength={128} autoComplete="new-password" value={confirmation} onChange={e => setConfirmation(e.target.value)} /></label></>}{error && <div className="form-message" role="alert">{error}</div>}{success && <div className="settings-success" role="status"><Check size={18} />{success}</div>}<div className="modal-actions"><button type="button" className="secondary" disabled={busy} onClick={close}>Close</button><button className="primary" disabled={busy || (tab === 'profile' && (!name.trim() || name.trim() === user.name))}>{busy ? 'Saving…' : tab === 'profile' ? 'Save profile' : 'Update password'}</button></div></form></section></div>}</>;
}
