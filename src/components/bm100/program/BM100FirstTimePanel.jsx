import { ChevronRight, Sparkles } from 'lucide-react';

export default function BM100FirstTimePanel({ onStart }) {
  return (
    <div className="mbw-first-time">
      <Sparkles size={28} className="mbw-first-time__icon" aria-hidden />
      <h2>Welcome to 100 Board Members</h2>
      <p>
        You&apos;re starting a focused <strong>6-month</strong> board-member program. Begin with{' '}
        <strong>Onboarding</strong> — four prep lessons before Phase 1 opens with your cohort.
      </p>
      <button type="button" className="btn btn-primary" onClick={onStart}>
        Start with Onboarding <ChevronRight size={16} />
      </button>
    </div>
  );
}
