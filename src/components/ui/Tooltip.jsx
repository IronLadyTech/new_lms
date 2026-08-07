import { useId, useState } from 'react';

/**
 * Accessible tooltip — visible on hover and keyboard focus via aria-describedby.
 */
export default function Tooltip({ label, children, className = '' }) {
  const id = useId();
  const [visible, setVisible] = useState(false);

  if (!label) return children;

  return (
    <span
      className={`tooltip-wrap ${className}`.trim()}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
    >
      <span aria-describedby={visible ? id : undefined}>{children}</span>
      {visible && (
        <span id={id} role="tooltip" className="tooltip">
          {label}
        </span>
      )}
    </span>
  );
}
