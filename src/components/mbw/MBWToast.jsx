import { useEffect } from 'react';
import { CheckCircle2, X } from 'lucide-react';

export default function MBWToast({ message, onClose, duration = 5000 }) {
  useEffect(() => {
    if (!message) return undefined;
    const t = setTimeout(onClose, duration);
    return () => clearTimeout(t);
  }, [message, duration, onClose]);

  if (!message) return null;

  return (
    <div className="mbw-toast" role="status" aria-live="polite">
      <CheckCircle2 size={18} className="mbw-toast__icon" />
      <span>{message}</span>
      <button type="button" className="mbw-toast__close" onClick={onClose} aria-label="Dismiss">
        <X size={16} />
      </button>
    </div>
  );
}
