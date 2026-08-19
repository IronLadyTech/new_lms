import { useEffect, useState } from 'react';
import { Footprints, Target, TrendingUp, Trophy } from 'lucide-react';

/**
 * The wait between routes.
 *
 * A blank page with a grey bar tells somebody nothing except that the product
 * is slow. Delivery apps solved this years ago: they narrate the wait, so the
 * same few seconds read as progress rather than as a stall.
 *
 * The narration here is the arc of the programmes themselves — start, aim,
 * climb, arrive. It is deliberately not a percentage or a "step 2 of 4": we do
 * not know how long a chunk will take, and inventing a number would be the
 * same fake-progress the rest of the LMS refuses to render.
 */
const STAGES = [
  { Icon: Footprints, line: 'Every leader started with one step.' },
  { Icon: Target, line: 'Clarity first, then speed.' },
  { Icon: TrendingUp, line: 'Small steps, compounded.' },
  { Icon: Trophy, line: 'A million women at the top.' },
];

const STAGE_MS = 1600;

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(
    () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  );
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!mq) return undefined;
    const onChange = (e) => setReduced(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

export default function RouteLoader({ label = 'Loading' }) {
  const reduced = usePrefersReducedMotion();
  const [stage, setStage] = useState(0);

  useEffect(() => {
    // Reduced motion holds on the first stage: the rotation is the motion, so
    // stopping the timer is the honest way to honour the setting.
    if (reduced) return undefined;
    const id = setInterval(() => setStage((s) => (s + 1) % STAGES.length), STAGE_MS);
    return () => clearInterval(id);
  }, [reduced]);

  const { Icon, line } = STAGES[stage];

  return (
    <div className="route-loader" role="status" aria-busy="true" aria-label={label}>
      {/*
        The rotating half is hidden from assistive tech on purpose. Announcing a
        new sentence every 1.6s would talk over whatever the user is doing; the
        aria-label above already says the one thing that matters.
      */}
      <div className="route-loader__stage" aria-hidden="true">
        <span key={stage} className="route-loader__badge">
          <Icon size={30} strokeWidth={2} aria-hidden="true" />
        </span>
        <p key={`line-${stage}`} className="route-loader__line">
          {line}
        </p>
      </div>

      <div className="route-loader__track" aria-hidden="true">
        <span className="route-loader__bar" />
      </div>
    </div>
  );
}
