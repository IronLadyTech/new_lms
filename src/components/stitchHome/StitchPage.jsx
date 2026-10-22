import { useMemo } from 'react';
import StitchShell from './StitchShell';
import { useAuth } from '../../context/AuthContext';
import { buildStitchChrome } from '../../services/stitchHomeDashboardService';
import '../../styles/stitchHome.css';

/**
 * The Stitch chrome around a page that has no dashboard data of its own.
 *
 * Settings and Help & Support are the learner's account, not their learning, so
 * they need the sidebar and topbar but nothing behind them. Routing them
 * through HomeNext would have loaded the course list, the events, all three
 * task engines and the streak history to put a name in the top corner.
 *
 * @param {object} props
 * @param {string} props.activeId - which nav item is current
 * @param {string} [props.title] - page heading in the topbar
 * @param {string} [props.subtitle]
 * @param {import('react').ReactNode} props.children
 */
export default function StitchPage({ activeId, title, subtitle, children }) {
  const { user, profile, role, signOut } = useAuth();
  const chrome = useMemo(() => buildStitchChrome({ user, profile, role }), [user, profile, role]);

  return (
    <StitchShell
      nav={chrome.nav}
      learner={chrome.learner}
      activeId={activeId}
      title={title}
      subtitle={subtitle}
      onLogout={signOut}
    >
      {children}
    </StitchShell>
  );
}
