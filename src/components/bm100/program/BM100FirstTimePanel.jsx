import { ChevronRight, Sparkles } from 'lucide-react';
import { DEFAULT_PROGRAM_UI } from '../../../data/programUiAdapters';

/**
 * The welcome panel a learner sees before they have completed anything.
 *
 * Its copy used to be hard-coded 100BM — welcoming LEP learners to "100 Board
 * Members" and pointing them at an Onboarding section LEP does not have. The
 * wording now comes from the programme's own adapter, and 100BM's default is
 * word-for-word what it was.
 */
export default function BM100FirstTimePanel({ onStart, program = DEFAULT_PROGRAM_UI }) {
  const { firstTime, title } = program.meta;

  return (
    <div className="mbw-first-time">
      <Sparkles size={28} className="mbw-first-time__icon" aria-hidden />
      <h2>Welcome to {title}</h2>
      <p>{firstTime.intro}</p>
      <button type="button" className="btn btn-primary" onClick={onStart}>
        {firstTime.cta} <ChevronRight size={16} />
      </button>
    </div>
  );
}
