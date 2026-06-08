import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export default function ThemeToggle({ compact = false, className = '' }) {
  const { theme, toggleTheme, setTheme } = useTheme();
  const isDark = theme === 'dark';

  if (compact) {
    return (
      <button
        type="button"
        className={`theme-toggle theme-toggle--compact${className ? ` ${className}` : ''}`}
        onClick={toggleTheme}
        aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
        title={isDark ? 'Light mode' : 'Dark mode'}
      >
        {isDark ? <Sun size={18} strokeWidth={2} /> : <Moon size={18} strokeWidth={2} />}
      </button>
    );
  }

  return (
    <div className={`theme-toggle-group${className ? ` ${className}` : ''}`}>
      <span className="theme-toggle-group__label">Appearance</span>
      <div className="theme-toggle-group__buttons">
        <button
          type="button"
          className={`theme-toggle-group__btn${theme === 'light' ? ' is-active' : ''}`}
          onClick={() => setTheme('light')}
        >
          <Sun size={16} strokeWidth={2} />
          Light
        </button>
        <button
          type="button"
          className={`theme-toggle-group__btn${theme === 'dark' ? ' is-active' : ''}`}
          onClick={() => setTheme('dark')}
        >
          <Moon size={16} strokeWidth={2} />
          Dark
        </button>
      </div>
    </div>
  );
}
