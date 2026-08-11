import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';

export default function OfflineBanner() {
  const online = useOnlineStatus();

  if (online) return null;

  return (
    <div className="offline-banner" role="status" aria-live="polite">
      <WifiOff size={16} aria-hidden="true" />
      <span>
        You&apos;re offline. You can keep reading, but submissions may not sync until your
        connection returns.
      </span>
    </div>
  );
}
