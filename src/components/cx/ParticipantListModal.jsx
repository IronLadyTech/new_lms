import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { useFocusTrap } from '../../hooks/useFocusTrap';

export default function ParticipantListModal({ title, participants, onClose }) {
  const panelRef = useRef(null);
  const titleId = 'cx-plist-title';

  useFocusTrap(true, panelRef, { onEscape: onClose });

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  return (
    <div className="cx-plist-backdrop" onClick={onClose}>
      <div
        className="cx-plist-panel"
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="cx-plist-header">
          <h3 className="cx-plist-title" id={titleId}>
            {title}
          </h3>
          <button type="button" className="cx-plist-close" onClick={onClose} aria-label="Close">
            <X size={18} aria-hidden />
          </button>
        </div>
        {participants.length === 0 ? (
          <p className="muted cx-plist-empty">No participants in this group.</p>
        ) : (
          <ul className="cx-plist-list">
            {participants.map((p, i) => (
              <li key={p.id || i} className="cx-plist-item">
                <span className="cx-plist-name">{p.displayName || p.email}</span>
                <span className="cx-plist-phone">{p.phone || p.email}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="cx-plist-footer">
          <span className="muted">
            {participants.length} participant{participants.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>
    </div>
  );
}
