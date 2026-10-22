import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import StitchSidebar from './StitchSidebar';
import StitchTopbar from './StitchTopbar';
import StitchProfilePanel from './StitchProfilePanel';

/**
 * The Stitch chrome: sidebar, topbar, mobile drawer, and the scrolling main
 * area. Everything a page inside this design needs and should not re-implement.
 *
 * Extracted from StitchDashboard when a second page was added. Duplicating it
 * would have meant two copies of the drawer's Escape handling, its body scroll
 * lock and the nav's navigate-or-logout branch — the kind of pair that stays in
 * step for exactly as long as nobody touches it.
 *
 * @param {object} props
 * @param {object} props.nav - nav model from the dashboard payload
 * @param {object} props.learner - learner summary for the topbar
 * @param {string} props.activeId - which nav item is current for this page
 * @param {string} [props.title] - page heading; defaults to the dashboard greeting
 * @param {string} [props.subtitle] - pass '' for no subline
 * @param {() => void} [props.onLogout]
 * @param {import('react').ReactNode} props.children - the page body
 */
export default function StitchShell({
  nav,
  learner,
  activeId,
  title,
  subtitle,
  onLogout,
  children,
}) {
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  /* Lives on the shell, so the avatar opens the same panel on every page. */
  const [profileOpen, setProfileOpen] = useState(false);

  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  useEffect(() => {
    if (!drawerOpen) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') closeDrawer();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [drawerOpen, closeDrawer]);

  const onSelect = async (item) => {
    closeDrawer();
    if (item?.action === 'logout') {
      await onLogout?.();
      return;
    }
    if (item?.href) navigate(item.href);
  };

  return (
    <div className="stitch-home">
      <div className="sh-shell">
        {drawerOpen && (
          <button
            type="button"
            className="sh-backdrop"
            aria-label="Close menu"
            onClick={closeDrawer}
          />
        )}

        <div className="sh-app">
          <StitchSidebar
            nav={nav}
            activeId={activeId}
            collapsed={collapsed}
            drawerOpen={drawerOpen}
            onSelect={onSelect}
            onToggleCollapse={() => setCollapsed((c) => !c)}
            onCloseDrawer={closeDrawer}
          />

          <div className="sh-panel">
            <StitchTopbar
              learner={learner}
              title={title}
              subtitle={subtitle}
              onOpenMenu={() => setDrawerOpen(true)}
              onOpenProfile={() => setProfileOpen(true)}
            />
            <main className="sh-main">{children}</main>
          </div>
        </div>
      </div>

      {/* Mounted only while open. The panel reads the auth context, and a
          closed panel has no business holding a subscription to it — or
          demanding a provider from anything that renders this shell. */}
      {profileOpen && <StitchProfilePanel onClose={() => setProfileOpen(false)} />}
    </div>
  );
}
