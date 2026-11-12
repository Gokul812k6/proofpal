import { lazy, Suspense, useEffect, useState } from 'react';
import { ArrowRight, FileText, FolderOpen, History, LayoutDashboard, LogOut, Plus, RefreshCw, ShieldCheck, Table2, Users, X } from 'lucide-react';
import Auth from '@/components/Auth';
import AccountSettings from '@/components/AccountSettings';
import HowItWorks from '@/components/HowItWorks';
import CurrencyEstimator from '@/components/CurrencyEstimator';
import useDialog from '@/components/useDialog';
import ProofPalLogo from '@/components/ProofPalLogo';
import ProjectForm from '@/components/ProjectForm';
import ProjectDetail from '@/components/ProjectDetail';
import { api, clearToken, date, Detail, getToken, isCurrency, money, Project, statuses, totalsByCurrency, User } from '@/lib/api';

const PipelineGrid = lazy(() => import('@/components/PipelineGrid'));

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [starting, setStarting] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [nav, setNav] = useState('Overview');
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState('');
  const [newProject, setNewProject] = useState(false);
  const [joining, setJoining] = useState(false);
  const [code, setCode] = useState('');
  const [joinBusy, setJoinBusy] = useState(false);
  const [joinError, setJoinError] = useState('');
  const [loadFailed, setLoadFailed] = useState(false);
  useDialog(joining, () => setJoining(false), joinBusy);
  useEffect(() => {
    if (!getToken()) { setStarting(false); return; }
    api<{ user: User }>('/auth/me').then(result => {
      if (!result.user?.id || !result.user?.email || !result.user?.name) throw new Error('Please sign in again.');
      setUser(result.user);
    }).catch(e => { clearToken(); setNotice(e.message); }).finally(() => setStarting(false));
  }, []);
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setLoading(true); setLoadFailed(false);
    api<{ projects: Project[] }>('/projects').then(result => {
      if (!Array.isArray(result.projects) || result.projects.some(p => !validProject(p))) throw new Error('Unable to read your projects. Please refresh.');
      if (!cancelled) setProjects(result.projects);
    }).catch(e => { if (!cancelled) { setNotice(e.message); setLoadFailed(true); } }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [user]);
  async function loadDetail(id: string) {
    const result = await api<Detail>(`/projects/${id}`);
    if (!validProject(result.project) || !Array.isArray(result.criteria) || !Array.isArray(result.deliveries) || !Array.isArray(result.activity)) throw new Error('Unable to read this project. Please refresh.');
    setDetail(result);
  }
  async function refresh(id = detail?.project.id) {
    const result = await api<{ projects: Project[] }>('/projects');
    if (!Array.isArray(result.projects) || result.projects.some(p => !validProject(p))) throw new Error('Unable to read your projects.');
    setProjects(result.projects); setLoadFailed(false);
    if (id) await loadDetail(id);
  }
  async function openProject(id: string) {
    setLoading(true);
    try { await loadDetail(id); setNav('Overview'); }
    catch (e) { setNotice(e instanceof Error ? e.message : 'Unable to open this project.'); }
    finally { setLoading(false); }
  }
  async function logout() {
    try { await api('/auth/logout', { method: 'POST' }); }
    catch (e) { setNotice(e instanceof Error ? e.message : 'Unable to sign out. Please try again.'); return; }
    clearToken(); setUser(null); setProjects([]); setDetail(null); setNotice('');
  }
  if (starting) return <div className="loading-screen"><ProofPalLogo /><p>Opening your private workspace…</p></div>;
  if (!user) return <><Auth onLogin={setUser} />{notice && <div className="toast" role="status"><span>{notice}</span><button aria-label="Dismiss" onClick={() => setNotice('')}><X size={20} /></button></div>}</>;
  const initials = user.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
  const stats = [
    ['Active projects', projects.filter(p => p.status !== 'approved').length.toString(), 'Across your private workspace'],
    ['Awaiting review', projects.filter(p => p.status === 'review').length.toString(), 'Ready for a human decision'],
    ['Agreed project value', totalsByCurrency(projects), new Set(projects.map(p => p.currency)).size > 1 ? 'Totalled separately per currency' : 'Agreement values, not collected payments'],
    ['Approved deliveries', projects.filter(p => p.status === 'approved').length.toString(), 'Checked and approved by the client'],
  ];
  return <div className="app-shell"><aside className="sidebar"><button className="brand" onClick={() => { setNav('Overview'); setDetail(null); }}><ProofPalLogo /></button><div className="workspace"><span className="workspace-avatar">{initials[0]}</span><div><strong>Your workspace</strong><small>Private project account</small></div></div><div className="nav-label">WORKSPACE</div><nav>{[["Overview", LayoutDashboard], ["Projects", FolderOpen], ["Pipeline", Table2], ["Agreements", FileText], ["Activity", History]].map(([label, Icon]) => { const name = label as string; const NavIcon = Icon as typeof LayoutDashboard; return <button key={name} aria-label={name} title={name} className={`nav-item ${nav === name ? 'active' : ''}`} onClick={() => setNav(name)}><NavIcon size={22} />{name}{name === 'Projects' && <span className="nav-count">{projects.length}</span>}</button>; })}</nav><div className="sidebar-bottom"><div className="trust-note"><ShieldCheck size={28} /><strong>Clarity before payment.</strong><p>Better agreements.<br />Confident handoffs.</p></div><div className="profile"><span className="avatar">{initials}</span><span><strong>{user.name}</strong><small>{user.email}</small></span></div></div></aside><div className="main-shell"><header className="topbar"><div className="breadcrumb">Workspace <ArrowRight size={14} /><span>{nav}</span></div><div className="top-actions"><HowItWorks /><AccountSettings user={user} onUpdate={updated => setUser(updated)} /><span className="preview-badge"><span />Private workspace</span><button className="icon-button" title="Refresh workspace" aria-label="Refresh workspace" disabled={loading} onClick={async () => { setLoading(true); try { await refresh(); setNotice('Workspace refreshed.'); } catch (e) { setNotice(e instanceof Error ? e.message : 'Refresh failed.'); } finally { setLoading(false); } }}><RefreshCw size={20} /></button><button className="icon-button" aria-label="Sign out" title="Sign out" onClick={logout}><LogOut size={20} /></button><span className="avatar small">{initials}</span></div></header><main><div className="page-heading"><div><div className="eyebrow">YOUR WORK. CLEARLY VERIFIED.</div><h1>{nav === 'Overview' ? 'A little clarity. A lot of confidence.' : nav}</h1><p>Keep your projects moving, from a clear agreement to a confident handoff.</p></div><div className="heading-actions"><CurrencyEstimator /><button className="secondary" onClick={() => { setJoining(true); setJoinError(''); }}><Users size={18} />Join project</button><button className="primary" onClick={() => setNewProject(true)}><Plus size={18} />New project</button></div></div><section className="stats" aria-label="Workspace summary">{stats.map(([label, value, sub], i) => <div className="stat" key={label}><div className="stat-label"><span>{label}</span>{i === 0 ? <FolderOpen size={20} /> : <ShieldCheck size={20} />}</div><strong>{value}</strong><small>{sub}</small></div>)}</section>{loading && <p className="loading-note" role="status">Loading your workspace…</p>}{loadFailed ? <section className="panel empty-state"><h2>Your projects could not be loaded.</h2><p>Use the refresh button above to try again. Your saved projects have not changed.</p></section> : nav === 'Pipeline' ? <Suspense fallback={<p className="loading-note" role="status">Loading your pipeline…</p>}><PipelineGrid projects={projects} user={user} open={openProject} /></Suspense> : nav === 'Activity' ? <section className="panel"><div className="panel-heading"><h2>{detail ? `${detail.project.name} activity` : 'Project activity'}</h2></div>{detail ? <div className="timeline">{detail.activity.map(a => <div className="timeline-item" key={a.id}><span className="activity-icon"><History size={20} /></span><div><strong>{a.title}</strong><p>{a.detail}</p><small>{date(a.created_at)}</small></div></div>)}</div> : <ProjectList projects={projects} open={openProject} empty="Select a project to see its saved activity." />}</section> : detail && nav !== 'Projects' ? <><div className="section-caption"><h2>{nav === 'Agreements' ? 'Project agreement' : 'Your current project'}</h2><button className="text-button" onClick={() => { setDetail(null); setNav('Projects'); }}>All projects<ArrowRight size={16} /></button></div><ProjectDetail key={detail.project.id} detail={detail} user={user} refresh={() => refresh()} notify={setNotice} agreementOnly={nav === 'Agreements'} /></> : <section className="panel project-list"><div className="panel-heading"><h2>{nav === 'Agreements' ? 'Your agreements' : 'Your projects'}</h2><span className="muted">{projects.length} projects</span></div><ProjectList projects={projects} open={async id => { await openProject(id); if (nav === 'Agreements') setNav('Agreements'); }} empty={loading ? 'Loading…' : 'No projects yet. Create an agreement or join with a private invitation.'} />{!projects.length && !loading && <div className="empty-state"><ShieldCheck size={40} /><h2>Good work starts here.</h2><p>Define what success looks like, invite your client, and keep every delivery and decision in one private place.</p><button className="primary" onClick={() => setNewProject(true)}><Plus size={18} />Create your first project</button></div>}</section>}<div className="clarity-panel live-clarity"><ShieldCheck size={32} /><div><span className="eyebrow">BUILT FOR BETTER WORKING RELATIONSHIPS</span><h3>Clear expectations. Evidence-led reviews.</h3><p>Your work is saved on Cloudflare. Reviews are human-led, with an AI evidence check as a second opinion. Payments run through PayPal checkout.</p></div></div><footer className="page-footer"><span>ProofPal · For PayPal Hackathon · <a className="maker-link" href="https://heygokul.in" target="_blank" rel="noopener noreferrer">Built by Gokul</a></span><span><ShieldCheck size={16} />Human-approved. Always.</span></footer></main></div>{notice && <div className="toast" role="status"><span>{notice}</span><button aria-label="Dismiss notification" onClick={() => setNotice('')}><X size={20} /></button></div>}{newProject && <ProjectForm onClose={() => setNewProject(false)} onCreated={async id => { await refresh(id); setNav('Overview'); }} />}{joining && <div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true" aria-labelledby="join-title"><button className="modal-close icon-button" disabled={joinBusy} aria-label="Close" onClick={() => setJoining(false)}><X size={20} /></button><div className="dialog-art invitation-art" aria-hidden="true"><span className="art-orbit" /><span className="art-card"><Users size={48} strokeWidth={1.5} /></span><span className="art-spark"><ShieldCheck size={24} /></span><span className="art-label">Better together</span></div><span className="dialog-kicker">PRIVATE INVITATION</span><h2 id="join-title">Join a shared project.</h2><p>Paste the private invitation code your freelancer sent you. Each invitation can be claimed once.</p><form onSubmit={async e => { e.preventDefault(); setJoinBusy(true); setJoinError(''); try { const result = await api<{ id: string }>('/join', { method: 'POST', body: JSON.stringify({ code: code.trim() }) }); if (!result.id) throw new Error('Unable to join.'); await refresh(result.id); setNav('Agreements'); setJoining(false); setCode(''); } catch (e) { setJoinError(e instanceof Error ? e.message : 'Unable to join.'); } finally { setJoinBusy(false); } }}><label>Invitation code<textarea autoFocus required rows={3} maxLength={64} value={code} onChange={e => setCode(e.target.value)} /></label>{joinError && <div className="form-message" role="alert">{joinError}</div>}<div className="modal-actions"><button type="button" className="secondary" disabled={joinBusy} onClick={() => setJoining(false)}>Cancel</button><button className="primary" disabled={joinBusy || code.trim().length !== 64}>{joinBusy ? 'Joining…' : 'Join project'}</button></div></form></section></div>}</div>;
}
function validProject(project: Project) {
  return project && typeof project.id === 'string' && typeof project.name === 'string' && typeof project.owner_id === 'string' && Number.isSafeInteger(project.amount_cents) && (project.currency === undefined || isCurrency(project.currency)) && Object.prototype.hasOwnProperty.call(statuses, project.status);
}
function ProjectList({ projects, open, empty }: { projects: Project[]; open: (id: string) => void; empty: string }) {
  return <>{!projects.length && <p className="muted">{empty}</p>}{projects.map(project => <button className="project-row" key={project.id} onClick={() => open(project.id)}><span className="project-symbol"><FileText size={24} /></span><span><strong>{project.name}</strong><small>{project.client_name} · {date(project.created_at)}</small></span><span className="project-price">{money(project.amount_cents, project.currency)}<small>{project.currency}</small></span><span className="pill neutral-pill">{statuses[project.status]}</span><ArrowRight size={18} /></button>)}</>;
}
