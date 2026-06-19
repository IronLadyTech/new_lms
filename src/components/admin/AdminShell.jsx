import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { ROLES, isModeratorOnly } from '../../utils/roles';
import AdminPanel, { ADMIN_TABS, SUPER_ADMIN_TABS, MODERATOR_TABS } from './AdminPanel';
import AdminNotificationBell from './AdminNotificationBell';
import ThemeToggle from '../ThemeToggle';

export default function AdminShell({ title, subtitle, isSuperAdmin = false }) {
  const { signOut, profile, role } = useAuth();
  const navigate = useNavigate();
  const moderatorView = isModeratorOnly(role);
  const navTabs = moderatorView ? MODERATOR_TABS : isSuperAdmin ? SUPER_ADMIN_TABS : ADMIN_TABS;
  const [tab, setTab] = useState(moderatorView ? 'mbw' : 'overview');
  const [menuOpen, setMenuOpen] = useState(false);

  const activeTab = navTabs.find((t) => t.id === tab);

  const handleSelectTab = (id) => {
    setTab(id);
    setMenuOpen(false);
  };

  const sidebarLabel = isSuperAdmin ? 'Super Admin' : moderatorView ? 'Customer Expression' : 'Admin';

  return (
    <div className="admin-shell">
      <div
        className={`admin-shell__overlay${menuOpen ? ' is-visible' : ''}`}
        onClick={() => setMenuOpen(false)}
      />

      <aside className={`admin-sidebar${menuOpen ? ' is-open' : ''}`}>
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
                title={t.desc}
              >
                <span className="admin-sidebar__icon">
                  <Icon size={18} strokeWidth={2} />
                </span>
                <span>{t.label}</span>
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
            <AdminNotificationBell onTabChange={handleSelectTab} />
          </div>
        </header>

        <AdminPanel isSuperAdmin={isSuperAdmin} tab={tab} onTabChange={setTab} />
      </div>
    </div>
  );
}
