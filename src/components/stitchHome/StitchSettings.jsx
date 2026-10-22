import { useState } from 'react';
import { Sun, Moon, Megaphone, CalendarClock, Monitor } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import '../../styles/stitchAccount.css';

/**
 * Settings — how the app behaves, not who you are.
 *
 * Identity, password and contact details moved to the profile panel behind the
 * avatar, which is where people look for them. What is left is genuinely
 * settings: two switches and a theme, all of them stored on this device.
 */

const NOTIFY_KEY = 'il-lms-notify-prefs';

export function loadNotifyPrefs() {
  try {
    const raw = localStorage.getItem(NOTIFY_KEY);
    if (!raw) return { announcements: true, reminders: true };
    return { announcements: true, reminders: true, ...JSON.parse(raw) };
  } catch {
    return { announcements: true, reminders: true };
  }
}

const NOTIFICATIONS = [
  {
    key: 'announcements',
    icon: Megaphone,
    title: 'Announcements',
    line: 'Programme updates and Iron Lady broadcasts.',
  },
  {
    key: 'reminders',
    icon: CalendarClock,
    title: 'Session reminders',
    line: 'A nudge before a live session starts.',
  },
];

const THEMES = [
  ['light', 'Light', Sun],
  ['dark', 'Dark', Moon],
];

function Switch({ on, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      className={`ac-sw${on ? ' on' : ''}`}
      onClick={() => onChange(!on)}
    >
      <span className="ac-sw__k" />
    </button>
  );
}

export default function StitchSettings() {
  const { theme, setTheme } = useTheme();
  const [prefs, setPrefs] = useState(loadNotifyPrefs);

  const setPref = (key, value) => {
    setPrefs((prev) => {
      const next = { ...prev, [key]: value };
      try {
        localStorage.setItem(NOTIFY_KEY, JSON.stringify(next));
      } catch {
        /* A browser refusing storage is not a reason to refuse the toggle. */
      }
      return next;
    });
  };

  return (
    <div className="ac">
      <header className="ac-head">
        <h1>Settings</h1>
        <p>How the app looks and what it tells you. Both are kept on this device.</p>
      </header>

      <section className="ac-card">
        <div className="ac-card__h">
          <span className="ac-card__i">
            <Monitor size={16} strokeWidth={2} aria-hidden />
          </span>
          <div>
            <h2>Appearance</h2>
            <p>Choose a theme. Defaults to your system setting.</p>
          </div>
        </div>

        <div className="ac-themes" role="radiogroup" aria-label="Theme">
          {THEMES.map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={theme === id}
              className={`ac-theme${theme === id ? ' on' : ''}`}
              onClick={() => setTheme(id)}
            >
              <span className={`ac-theme__sw ac-theme__sw--${id}`} aria-hidden>
                <i />
                <i />
              </span>
              <span className="ac-theme__l">
                <Icon size={14} strokeWidth={2.2} aria-hidden />
                {label}
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="ac-card">
        <div className="ac-card__h">
          <span className="ac-card__i">
            <Megaphone size={16} strokeWidth={2} aria-hidden />
          </span>
          <div>
            <h2>Notifications</h2>
            <p>What this browser is allowed to show you.</p>
          </div>
        </div>

        <ul className="ac-rows">
          {NOTIFICATIONS.map(({ key, icon: Icon, title, line }) => (
            <li key={key} className="ac-row">
              <span className="ac-row__i" aria-hidden>
                <Icon size={16} strokeWidth={2} />
              </span>
              <span className="ac-row__t">
                <strong>{title}</strong>
                <small>{line}</small>
              </span>
              <Switch on={prefs[key]} onChange={(v) => setPref(key, v)} label={title} />
            </li>
          ))}
        </ul>

        {/* Said plainly, because it is the thing people get wrong about these. */}
        <p className="ac-foot">
          These apply to this browser only. Delivery still follows your browser and system
          notification permissions.
        </p>
      </section>
    </div>
  );
}
