import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { ROLES, isModeratorOnly } from '../../utils/roles';
import AdminPanel, { ADMIN_TABS, SUPER_ADMIN_TABS, MODERATOR_TABS } from './AdminPanel';
import AdminNotificationBell from './AdminNotificationBell';
import ThemeToggle from '../ThemeToggle';
import WidgetErrorBoundary from '../WidgetErrorBoundary';
import LayoutErrorBoundary from '../LayoutErrorBoundary';
import OfflineBanner from '../ui/OfflineBanner';
import { useFocusTrap } from '../../hooks/useFocusTrap';

function resolveTab(section, navTabs, fallback) {
  const ids = navTabs.map((t) => t.id);
  return ids.includes(section) ? section : fallback;
}

export default function AdminShell({ title, subtitle, isSuperAdmin = false }) {
  const { signOut, profile, role } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const moderatorView = isModeratorOnly(role);
  const navTabs = moderatorView ? MODERATOR_TABS : isSuperAdmin ? SUPER_ADMIN_TABS : ADMIN_TABS;
  const defaultTab = moderatorView ? 'mbw' : 'overview';
  const sectionParam = searchParams.get('section');
  const [tab, setTab] = useState(() => resolveTab(sectionParam, navTabs, defaultTab));
  const [menuOpen, setMenuOpen] = useState(false);
  const sidebarRef = useRef(null);

  useFocusTrap(menuOpen, sidebarRef, { onEscape: () => setMenuOpen(false), restoreFocus: true });

  useEffect(() => {
    const next = resolveTab(searchParams.get('section'), navTabs, defaultTab);
    setTab(next);
  }, [searchParams, navTabs, defaultTab]);

  useEffect(() => {
    if (!menuOpen) return undefined;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [menuOpen]);

  const activeTab = navTabs.find((t) => t.id === tab);

  const handleSelectTab = (id) => {
    setTab(id);
    setSearchParams({ section: id }, { replace: true });
    setMenuOpen(false);
  };

  const sidebarLabel = isSuperAdmin
    ? 'Super Admin'
    : moderatorView
      ? 'Customer Expression'
      : 'Admin';

  return (
    <div className="admin-shell">
      <div
        className={`admin-shell__overlay${menuOpen ? ' is-visible' : ''}`}
        onClick={() => setMenuOpen(false)}
      />

      <aside
        ref={sidebarRef}
        className={`admin-sidebar${menuOpen ? ' is-open' : ''}`}
        role={menuOpen ? 'dialog' : undefined}
        aria-modal={menuOpen ? 'true' : undefined}
        aria-label={menuOpen ? 'Admin navigation menu' : undefined}
      >
        <div className="admin-sidebar__brand">
          <img src="/logo.png" alt="Iron Lady" className="logo-mark" />
          <div>
            <strong>Iron Lady</strong>
            <span>{sidebarLabel}</span>
          </div>
          <button
            type="button"
            className="admin-sidebar__close"
            onClick={() => setMenuOpen(false)}
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="admin-sidebar__nav">
          {navTabs.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                className={`admin-sidebar__link${tab === t.id ? ' is-active' : ''}`}
                onClick={() => handleSelectTab(t.id)}
              >
                <span className="admin-sidebar__icon">
                  <Icon size={18} strokeWidth={2} />
                </span>
                <span className="admin-sidebar__link-text">
                  <span>{t.label}</span>
                  <span className="admin-sidebar__link-desc muted">{t.desc}</span>
                </span>
              </button>
            );
          })}
        </nav>

        <div className="admin-sidebar__footer">
          {!isSuperAdmin && role === ROLES.SUPERADMIN && (
            <Link to="/superadmin" className="btn btn-outline btn-sm btn-block">
              Super Admin panel
            </Link>
          )}
          {isSuperAdmin && (
            <Link to="/admin" className="btn btn-outline btn-sm btn-block">
              Admin panel
            </Link>
          )}
          <Link to="/app/home" className="btn btn-outline btn-sm btn-block">
            View as user
          </Link>
          <p className="muted admin-sidebar__email">{profile?.email}</p>
          <button
            type="button"
            className="btn btn-danger btn-sm btn-block"
            onClick={() => signOut().then(() => navigate('/auth/login'))}
          >
            Sign out
          </button>
        </div>
      </aside>

      <div className="admin-shell__main">
        <header className="admin-shell__header">
          <button
            type="button"
            className="admin-shell__menu-btn"
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
          >
            <Menu size={22} />
          </button>
          <div className="admin-shell__header-text">
            <h1>{activeTab ? activeTab.label : title}</h1>
            <p>{activeTab ? activeTab.desc : subtitle}</p>
          </div>
          <div className="admin-shell__header-actions">
            <ThemeToggle compact />
            <WidgetErrorBoundary name="AdminNotificationBell">
              <AdminNotificationBell onTabChange={handleSelectTab} />
            </WidgetErrorBoundary>
          </div>
        </header>

        <OfflineBanner />

        <LayoutErrorBoundary name="admin-panel">
          <AdminPanel isSuperAdmin={isSuperAdmin} tab={tab} onTabChange={handleSelectTab} />
        </LayoutErrorBoundary>
      </div>
    </div>
  );
}
