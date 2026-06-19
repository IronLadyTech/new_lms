import { useEffect } from 'react';

export default function ParticipantListModal({ title, participants, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="cx-plist-backdrop" onClick={onClose}>
      <div className="cx-plist-panel" onClick={(e) => e.stopPropagation()}>
        <div className="cx-plist-header">
          <h3 className="cx-plist-title">{title}</h3>
          <button type="button" className="cx-plist-close" onClick={onClose} aria-label="Close">✕</button>
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
          <span className="muted">{participants.length} participant{participants.length !== 1 ? 's' : ''}</span>
        </div>
      </div>
    </div>
  );
}
