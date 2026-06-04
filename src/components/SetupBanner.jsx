import { isFirebaseConfigured } from '../firebase/config';
import { isZohoConfigured } from '../services/zohoService';

export default function SetupBanner() {
  const firebaseOk = isFirebaseConfigured();
  const zohoOk = isZohoConfigured();

  if (firebaseOk) return null;

  return (
    <div className="setup-banner" role="alert">
      <strong>Setup required:</strong> Copy <code>.env.example</code> to <code>.env</code> and add your
      Firebase keys. {zohoOk ? 'Zoho is configured.' : 'Zoho sync is optional.'}
    </div>
  );
}
