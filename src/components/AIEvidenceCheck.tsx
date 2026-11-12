import { useState } from 'react';
import { Check, Quote, ScanSearch, Sparkles } from 'lucide-react';
import { api, Criterion } from '@/lib/api';

interface Finding { criterion_id: string; verdict: Criterion['status']; reason: string; evidence: string }
const labels = { met: 'Evidence found', missing: 'Looks missing', uncertain: 'Not enough proof' };

export default function AIEvidenceCheck({ projectId, criteria, canApply, apply, refresh }: { projectId: string; criteria: Criterion[]; canApply: boolean; apply: (criterionId: string, status: Criterion['status']) => Promise<void>; refresh: () => Promise<void> }) {
  const [findings, setFindings] = useState<Finding[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function run() {
    setBusy(true); setError('');
    try {
      const result = await api<{ findings: Finding[] }>(`/projects/${projectId}/aicheck`, { method: 'POST', body: '{}' });
      if (!Array.isArray(result.findings) || result.findings.some(f => typeof f?.criterion_id !== 'string' || !(f.verdict in labels) || typeof f.reason !== 'string')) throw new Error('The AI check returned an unexpected answer. Please try again.');
      setFindings(result.findings);
      await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : 'The AI check could not run. Please try again.'); }
    finally { setBusy(false); }
  }
  const met = findings?.filter(f => f.verdict === 'met').length ?? 0;
  return <div className="ai-check">
    <div className="ai-check-head"><span className="ai-check-icon"><Sparkles size={20} /></span><div><strong>AI evidence check</strong><p>{canApply ? 'Get a second opinion: AI reads the delivered files and points to proof for each requirement. You still decide.' : 'Check your delivery before you submit. AI reads your files and flags requirements without clear proof.'}</p></div><button className="secondary" disabled={busy} onClick={run}><ScanSearch size={18} />{busy ? 'Reading files…' : findings ? 'Run again' : 'Run check'}</button></div>
    {busy && <div className="ai-check-scan" role="status"><span />Reading each file and matching it to the agreement…</div>}
    {error && <div className="form-message" role="alert">{error}</div>}
    {findings && !busy && <><div className="ai-check-score"><span>{met}<small>/{findings.length}</small></span>requirements have clear evidence, according to the AI</div>
      {findings.map(f => { const c = criteria.find(x => x.id === f.criterion_id); if (!c) return null; return <div className={`ai-finding ${f.verdict}`} key={f.criterion_id}><div className="ai-finding-top"><strong>{c.title}</strong><span className={`status ${f.verdict}`}>{labels[f.verdict]}</span></div><p>{f.reason}</p>{f.evidence && <blockquote><Quote size={14} />{f.evidence}</blockquote>}{canApply && c.status !== f.verdict && <button className="text-button" onClick={() => apply(c.id, f.verdict)}><Check size={14} />Use this as my decision</button>}</div>; })}
      <p className="ai-check-note">AI suggestions are advisory and can be wrong. They never approve work or release payment on their own.</p></>}
  </div>;
}
