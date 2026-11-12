import { Check, CircleDollarSign } from 'lucide-react';

export default function ProofPalLogo() {
  return (
    <span className="proofpal-logo" role="img" aria-label="ProofPal">
      <span className="proofpal-logo-mark" aria-hidden="true">
        <span className="proofpal-logo-coin"><CircleDollarSign size={28} strokeWidth={1.8} /></span>
        <span className="proofpal-logo-verified"><Check size={11} strokeWidth={3} /></span>
      </span>
      <span className="proofpal-logo-wordmark" aria-hidden="true">proof<span>pal</span></span>
    </span>
  );
}
