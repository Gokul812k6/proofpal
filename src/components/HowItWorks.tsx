import { useState } from 'react';
import { ArrowLeft, ArrowRight, BadgeCheck, Briefcase, CheckCircle2, CreditCard, Eye, FolderPlus, HelpCircle, ListChecks, ShieldAlert, Sparkles, Store, Upload, UserPlus, Wallet, X } from 'lucide-react';
import useDialog from '@/components/useDialog';

type Step = { icon: typeof HelpCircle; title: string; text: string; where: string };

const journeys: Record<'freelancer' | 'client', { label: string; who: string; icon: typeof HelpCircle; steps: Step[] }> = {
  freelancer: {
    label: 'Freelancer', who: 'You do the work and want to get paid without arguments.', icon: Briefcase,
    steps: [
      { icon: FolderPlus, title: 'Create a project', text: 'Add the price and a short checklist (acceptance criteria) of what "done" means, then send your client the private invitation code.', where: 'New project button, top right' },
      { icon: Sparkles, title: 'Make the wording clear', text: 'The clarity check flags vague words like "modern" or "fast", so you and your client mean the same thing.', where: 'Appears while you write the acceptance criteria' },
      { icon: ShieldAlert, title: 'Protect your scope', text: 'When the client asks for something new, Scope check tells you if it is extra work you should charge for.', where: 'Open a project, then Scope check' },
      { icon: Upload, title: 'Upload your proof', text: 'Attach files for each checklist item and submit. An AI check gives advice only. It never approves anything for you.', where: 'Delivery evidence, then Submit delivery for review' },
      { icon: Wallet, title: 'Get paid', text: 'Once the client approves, they pay through PayPal. You both get a receipt and a handoff certificate.', where: 'Unlocks after the client clicks Approve delivery' },
    ],
  },
  client: {
    label: 'Client', who: 'You hired someone and want to pay only for what was agreed.', icon: Store,
    steps: [
      { icon: UserPlus, title: 'Join the project', text: 'Use the invite code your freelancer shared. You will see the same agreement they see.', where: 'Join project button, top right' },
      { icon: ListChecks, title: 'Read the checklist', text: 'Every item says exactly what you are paying for. When it looks right, accept the agreement so work can begin.', where: 'What we agreed on, then Accept this agreement' },
      { icon: Eye, title: 'Check the proof', text: 'Open the files for each item. The AI note is only a second opinion. You stay in charge.', where: 'Open the project, then Delivery evidence' },
      { icon: CheckCircle2, title: 'Approve or ask for changes', text: 'Approve when it matches the agreement, or send it back with a clear note on what is missing.', where: 'Approve delivery or Request revision' },
      { icon: CreditCard, title: 'Pay with PayPal', text: 'Pay safely with PayPal (test mode for this demo) and keep the receipt and certificate for your records.', where: 'PayPal sandbox checkout, then View handoff certificate' },
    ],
  },
};

const phases = ['Agree', 'Prove', 'Review', 'Pay'];

export default function HowItWorks({ variant = 'icon' }: { variant?: 'icon' | 'link' }) {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<'freelancer' | 'client'>('freelancer');
  const [index, setIndex] = useState(0);
  const close = () => setOpen(false);
  useDialog(open, close, false);
  const journey = journeys[role];
  const step = journey.steps[index];
  const StepIcon = step.icon;
  const last = index === journey.steps.length - 1;
  function choose(next: 'freelancer' | 'client') { setRole(next); setIndex(0); }
  function launch() { setRole('freelancer'); setIndex(0); setOpen(true); }

  return <>
    {variant === 'icon'
      ? <button className="guide-trigger" title="How ProofPal works" aria-label="How ProofPal works" onClick={launch}><HelpCircle size={18} /><span>How it works</span></button>
      : <button type="button" className="guide-link" onClick={launch}><HelpCircle size={16} />New here? See how ProofPal works</button>}
    {open && <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) close(); }}>
      <section className="modal guide-modal" role="dialog" aria-modal="true" aria-labelledby="guide-title">
        <button className="modal-close icon-button" aria-label="Close guide" onClick={close}><X size={20} /></button>
        <span className="dialog-kicker">HOW PROOFPAL WORKS</span>
        <h2 id="guide-title">Clear work. Fair pay.</h2>
        <p className="guide-lead">ProofPal turns "is it done yet?" into a simple path both sides can follow.</p>
        <ol className="guide-phases" aria-label="The four stages">
          {phases.map((phase, i) => <li key={phase} style={{ animationDelay: `${i * 80}ms` }}><span>{i + 1}</span>{phase}</li>)}
        </ol>
        <div className="guide-roles" role="tablist" aria-label="Choose your side">
          {(Object.keys(journeys) as Array<'freelancer' | 'client'>).map(key => { const RoleIcon = journeys[key].icon; return <button key={key} role="tab" aria-selected={role === key} className={role === key ? 'selected' : ''} onClick={() => choose(key)}><RoleIcon size={18} /><em>I am a {journeys[key].label.toLowerCase()}</em><span className="guide-short">{journeys[key].label}</span></button>; })}
        </div>
        <p className="guide-who">{journey.who}</p>
        <div className="guide-body">
          <ol className="guide-steps">
            {journey.steps.map((s, i) => <li key={s.title}><button className={`${i === index ? 'active' : ''} ${i < index ? 'done' : ''}`} aria-current={i === index ? 'step' : undefined} onClick={() => setIndex(i)}><span className="guide-dot">{i < index ? <BadgeCheck size={16} /> : i + 1}</span>{s.title}</button></li>)}
          </ol>
          <article className="guide-card" key={`${role}-${index}`} aria-live="polite">
            <div className="guide-orb"><StepIcon size={32} /></div>
            <span className="guide-count">Step {index + 1} of {journey.steps.length}</span>
            <h3>{step.title}</h3>
            <p>{step.text}</p>
            <span className="guide-where">Find it: {step.where}</span>
          </article>
        </div>
        <div className="guide-progress" aria-hidden="true"><span style={{ width: `${((index + 1) / journey.steps.length) * 100}%` }} /></div>
        <div className="modal-actions guide-actions">
          <button className="secondary" disabled={index === 0} onClick={() => setIndex(i => i - 1)}><ArrowLeft size={16} />Back</button>
          {last
            ? role === 'freelancer'
              ? <button className="primary" onClick={() => choose('client')}>See the client side<ArrowRight size={16} /></button>
              : <button className="primary" onClick={close}>Got it, let's start</button>
            : <button className="primary" onClick={() => setIndex(i => i + 1)}>Next<ArrowRight size={16} /></button>}
        </div>
      </section>
    </div>}
  </>;
}
