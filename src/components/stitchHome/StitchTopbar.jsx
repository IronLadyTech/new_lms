import { Bell, ChevronDown, Menu } from 'lucide-react';

/**
 * @param {object} props
 * @param {object} props.learner
 * @param {string} [props.title] - overrides the dashboard greeting
 * @param {string} [props.subtitle]
 * @param {() => void} props.onOpenMenu
 * @param {() => void} [props.onOpenProfile] - opens the profile panel
 */
export default function StitchTopbar({ learner, title, subtitle, onOpenMenu, onOpenProfile }) {
  return (
    <header className="sh-header">
      <span className="sh-header-logo">
        <img alt="Iron Lady" src="/logo.png" />
      </span>

      <button
        type="button"
        className="sh-menu-btn"
        aria-label="Open menu"
        aria-expanded="false"
        onClick={onOpenMenu}
      >
        <Menu size={22} strokeWidth={2} aria-hidden />
      </button>

      {/* The greeting is the dashboard's line, not every page's. Settings said
          "here's what happened with your learning system" above a password
          form. */}
      <div className="sh-greeting">
        <h1>{title || `Welcome, ${learner.displayName}`}</h1>
        {subtitle === '' ? null : (
          <p className="sh-subline">
            {subtitle || "Here's what happened with your learning system"}
          </p>
        )}
      </div>

      <div className="sh-header-actions">
        <button type="button" className="sh-bell" aria-label="Notifications">
          <Bell size={16} strokeWidth={2} aria-hidden />
        </button>

        <span className="sh-header-rule" aria-hidden="true" />

        <button
          type="button"
          className="sh-profile"
          aria-label="Your profile"
          aria-haspopup="dialog"
          onClick={onOpenProfile}
        >
          <span className="sh-avatar" aria-hidden>
            {learner.photoURL ? <img src={learner.photoURL} alt="" /> : learner.initial}
          </span>
          <span className="sh-profile-meta">
            <span className="sh-profile-row">
              <span className="sh-profile-name">{learner.displayName}</span>
              <ChevronDown size={12} strokeWidth={2} aria-hidden />
            </span>
            <span className="sh-profile-role">{learner.roleLabel}</span>
          </span>
        </button>
      </div>
    </header>
  );
}
