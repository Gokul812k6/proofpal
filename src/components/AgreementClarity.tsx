import { useState } from 'react';
import { ChevronDown, Gauge, Lightbulb } from 'lucide-react';
import { checkClarity } from '@/lib/clarity';

export default function AgreementClarity({ criteria, audience }: { criteria: string[]; audience: 'freelancer' | 'client' }) {
  const report = checkClarity(criteria);
  const [open, setOpen] = useState(false);
  if (!criteria.some(c => c.trim())) return null;
  const tone = report.grade === 'Clear' ? 'clear' : report.grade === 'Mostly clear' ? 'fair' : 'risky';
  const summary = report.flags.length === 0
    ? 'Every requirement can be checked objectively. Disputes are unlikely.'
    : audience === 'client'
      ? `${report.flags.length} point${report.flags.length === 1 ? '' : 's'} could be read in more than one way. Ask your freelancer to clarify before you accept.`
      : `${report.flags.length} suggestion${report.flags.length === 1 ? '' : 's'} to make this agreement easier to approve.`;
  return <div className={`clarity-check ${tone}`}>
    <div className="clarity-head">
      <span className="clarity-ring" style={{ ['--score' as string]: report.score }} aria-hidden="true"><span>{report.score}</span></span>
      <div><strong><Gauge size={16} />Agreement clarity: {report.grade}</strong><p>{summary}</p></div>
    </div>
    {report.flags.length > 0 && <>
      <button type="button" className="clarity-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? 'Hide' : 'Show'} suggestions<ChevronDown size={16} /></button>
      {open && <ul className="clarity-flags">{report.flags.map((f, i) => <li key={i}><span className="clarity-issue">{f.issue}</span><q>{f.requirement}</q><small><Lightbulb size={14} />{f.tip}</small></li>)}</ul>}
    </>}
  </div>;
}
