export interface ClarityFlag { requirement: string; issue: string; tip: string }
export interface ClarityReport { score: number; grade: 'Clear' | 'Mostly clear' | 'Needs work'; flags: ClarityFlag[] }

const vague = ['nice', 'good', 'great', 'modern', 'clean', 'beautiful', 'professional', 'user-friendly', 'user friendly', 'intuitive', 'fast', 'quick', 'simple', 'easy', 'seamless', 'robust', 'high quality', 'high-quality', 'best', 'optimal', 'appropriate', 'proper', 'sleek', 'engaging', 'attractive'];
const subjective = /\b(client|customer|they|we|i)\s+(likes?|loves?|is happy|is satisfied|approves? of|feels?)\b|\b(to (my|our|the client's) satisfaction|looks? good|feels? right)\b/i;
const openEnded = /\b(etc\.?|and so on|and more|as needed|if needed|unlimited|any changes|all changes|whatever|tbd|to be decided)\b/i;
const measurable = /\d|\b(works? on|loads?|sends?|emails?|displays?|shows?|includes?|lists?|passes|matches|exports?|imports?|links? to|returns?|saves?|submits?|delivered as|in (pdf|png|jpg|figma|svg)|responsive|mobile|desktop|tablet)\b/i;

export function checkClarity(items: string[]): ClarityReport {
  const criteria = items.map(c => c.trim()).filter(Boolean);
  const flags: ClarityFlag[] = [];
  const seen = new Set<string>();
  for (const requirement of criteria) {
    const lower = requirement.toLowerCase();
    const words = lower.split(/\s+/).length;
    const fuzzy = vague.find(w => new RegExp(`\\b${w}\\b`).test(lower));
    if (seen.has(lower)) flags.push({ requirement, issue: 'Listed twice', tip: 'Remove the duplicate so each requirement is reviewed once.' });
    seen.add(lower);
    if (words < 3) flags.push({ requirement, issue: 'Too short to check', tip: 'Describe what the client will see or test, e.g. "Contact form sends an email to the shop".' });
    if (fuzzy) flags.push({ requirement, issue: `"${fuzzy}" means different things to different people`, tip: 'Swap it for something checkable, like a number, a device, or a specific result.' });
    if (subjective.test(requirement)) flags.push({ requirement, issue: 'Depends on personal opinion', tip: 'Tie approval to a visible result instead of how someone feels.' });
    if (openEnded.test(requirement)) flags.push({ requirement, issue: 'Open-ended scope', tip: 'Set a limit, e.g. "Up to 2 rounds of revisions" instead of "any changes".' });
    if ((lower.match(/\band\b|;|,/g) || []).length >= 3) flags.push({ requirement, issue: 'Bundles several requirements', tip: 'Split it into separate lines so each part can be approved on its own.' });
    if (words >= 3 && !flags.some(f => f.requirement === requirement) && !measurable.test(requirement)) flags.push({ requirement, issue: 'Hard to verify', tip: 'Add how it will be checked: a number, a file type, or what happens when tested.' });
  }
  if (criteria.length > 0 && criteria.length < 3) flags.push({ requirement: 'Whole agreement', issue: `Only ${criteria.length} requirement${criteria.length === 1 ? '' : 's'}`, tip: 'Most clear agreements list 3 to 8 checkable outcomes.' });
  const flagged = new Set(flags.filter(f => f.requirement !== 'Whole agreement').map(f => f.requirement)).size;
  const score = criteria.length ? Math.max(0, Math.round(100 - (flagged / criteria.length) * 70 - (criteria.length < 3 ? 15 : 0) - Math.max(0, flags.length - flagged) * 3)) : 0;
  return { score, grade: score >= 85 ? 'Clear' : score >= 60 ? 'Mostly clear' : 'Needs work', flags };
}
