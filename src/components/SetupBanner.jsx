import { isFirebaseConfigured } from '../firebase/config';

export default function SetupBanner() {
  const firebaseOk = isFirebaseConfigured();

  if (firebaseOk) return null;

  return (
    <div className="setup-banner" role="alert">
      <strong>Setup required:</strong> Copy <code>.env.example</code> to <code>.env</code> and add your
      Firebase keys. Zoho CRM sync runs via Cloud Functions when secrets are deployed.
    </div>
  );
}
