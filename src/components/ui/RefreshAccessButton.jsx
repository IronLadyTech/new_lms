import { useState } from 'react';
import { RefreshCw, Check } from 'lucide-react';
import { refreshMyAccess } from '../../services/zohoService';
import { useAuth } from '../../context/AuthContext';

/**
 * "I just paid — why is this still locked?"
 *
 * Payment normally unlocks within a second, and a sweep catches anything that
 * slips. But the sweep runs on a timer, and the worst possible moment to wait
 * for it is the minute after paying, staring at a padlock on something you have
 * just bought. This gives that person something to do besides email support.
 *
 * Deliberately quiet: no spinner-heavy ceremony, no error banner if Zoho is
 * unreachable. A refresh that fails should leave the page exactly as it was —
 * the padlock is already the honest answer, and a red alert on top of it would
 * only suggest the payment itself had failed.
 */
export default function RefreshAccessButton({ label = 'Just paid? Refresh access' }) {
  const { refreshProfile } = useAuth();
  const [state, setState] = useState('idle');

  const onClick = async () => {
    setState('working');
    await refreshMyAccess();
    // Reload regardless of what Zoho said: the profile may have been updated by
    // the webhook or a sweep since the page was opened, and that is exactly the
    // case this button is for.
    await refreshProfile?.();
    setState('done');
    // Back to idle so a learner still waiting on Zoho can try again in a moment
    // rather than facing a permanently spent button.
    setTimeout(() => setState('idle'), 4000);
  };

  return (
    <button
      type="button"
      className="btn btn-outline btn-sm refresh-access"
      onClick={onClick}
      disabled={state === 'working'}
    >
      {state === 'done' ? (
        <Check size={16} strokeWidth={2} aria-hidden="true" />
      ) : (
        <RefreshCw
          size={16}
          strokeWidth={2}
          aria-hidden="true"
          className={state === 'working' ? 'refresh-access__spin' : undefined}
        />
      )}
      {state === 'working' ? 'Checking…' : state === 'done' ? 'Up to date' : label}
    </button>
  );
}
