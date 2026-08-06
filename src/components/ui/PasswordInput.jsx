import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

/**
 * Password field with show/hide toggle (Lucide icons, 44px tap target).
 */
export default function PasswordInput({
  id,
  value,
  onChange,
  placeholder = '••••••••',
  autoComplete = 'current-password',
  minLength,
  required = false,
  className = '',
  'aria-label': ariaLabel = 'Password',
}) {
  const [visible, setVisible] = useState(false);
  const inputId = id || 'password-input';

  return (
    <div className={`password-input${className ? ` ${className}` : ''}`}>
      <input
        id={inputId}
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={autoComplete}
        minLength={minLength}
        required={required}
        aria-label={ariaLabel}
      />
      <button
        type="button"
        className="password-input__toggle"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
      >
        {visible ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
      </button>
    </div>
  );
}
