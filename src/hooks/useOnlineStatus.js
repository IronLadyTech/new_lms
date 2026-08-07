import { useEffect, useState } from 'react';

/**
 * Tracks browser online/offline state with event listeners.
 */
export function useOnlineStatus() {
  const [online, setOnline] = useState(
    () => typeof navigator !== 'undefined' && navigator.onLine !== false
  );

  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  return online;
}
