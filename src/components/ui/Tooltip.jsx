import { useId, useState } from 'react';

/**
 * Accessible tooltip — visible on hover and keyboard focus via aria-describedby.
 *
 * Escape dismisses without moving pointer or focus, per WCAG 1.4.13
 * (Content on Hover or Focus).
 */
export default function Tooltip({ label, children, className = '' }) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (!label) return children;

  const show = () => {
    setDismissed(false);
    setVisible(true);
  };

  const open = visible && !dismissed;

  return (
    <span
      className={`tooltip-wrap ${className}`.trim()}
      onMouseEnter={show}
      onMouseLeave={() => setVisible(false)}
      onFocus={show}
      onBlur={() => setVisible(false)}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && visible) {
          e.stopPropagation();
          setDismissed(true);
        }
      }}
    >
      <span aria-describedby={open ? id : undefined}>{children}</span>
      {open && (
        <span id={id} role="tooltip" className="tooltip">
          {label}
        </span>
      )}
    </span>
  );
}
