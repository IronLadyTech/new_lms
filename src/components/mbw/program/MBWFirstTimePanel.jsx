import { ChevronRight, Sparkles } from 'lucide-react';

export default function MBWFirstTimePanel({ onStart }) {
  return (
    <div className="mbw-first-time">
      <Sparkles size={28} className="mbw-first-time__icon" aria-hidden />
      <h2>Welcome to MBW</h2>
      <p>
        You&apos;re starting a focused <strong>1-year</strong> MBW program. Begin with{' '}
        <strong>Pre-Preparation</strong> — twelve lessons before Quarter 1 opens with your batch.
      </p>
      <button type="button" className="btn btn-primary" onClick={onStart}>
        Start with Pre-Preparation <ChevronRight size={16} />
      </button>
    </div>
  );
}
