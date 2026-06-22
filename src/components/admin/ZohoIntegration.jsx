import { useState } from 'react';
import { RefreshCw, Link2, CheckCircle2, AlertCircle } from 'lucide-react';
import {
  isZohoConfigured,
  testZohoConnection,
  syncAllUsersToZoho,
  syncUserToZohoById,
  provisionUserFromZoho,
} from '../../services/zohoService';

export default function ZohoIntegration({ users = [] }) {
  const [status, setStatus] = useState(null);
  const [syncResult, setSyncResult] = useState(null);
  const [testing, setTesting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncingUserId, setSyncingUserId] = useState('');
  const [error, setError] = useState('');

  const [provisioningEmail, setProvisioningEmail] = useState('');

  const configured = isZohoConfigured();
  const syncedCount = users.filter((u) => u.zohoLeadId || u.zohoContactId).length;

  const handleTest = async () => {
    setTesting(true);
    setError('');
    setStatus(null);
    try {
      const result = await testZohoConnection();
      setStatus(result);
    } catch (e) {
      setError(e.message || 'Connection test failed');
    } finally {
      setTesting(false);
    }
  };

  const handleSyncAll = async () => {
    setSyncing(true);
    setError('');
    setSyncResult(null);
    try {
      const result = await syncAllUsersToZoho();
      setSyncResult(result);
    } catch (e) {
      setError(e.message || 'Bulk sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const handleSyncUser = async (userId) => {
    setSyncingUserId(userId);
    setError('');
    try {
      await syncUserToZohoById(userId);
    } catch (e) {
      setError(e.message || 'User sync failed');
    } finally {
      setSyncingUserId('');
    }
  };

  const handleProvision = async (email) => {
    if (!email) return;
    setProvisioningEmail(email);
    setError('');
    try {
      const result = await provisionUserFromZoho(email);
      if (!result.ok) {
        setError(result.reason || 'Provision failed');
      } else {
        setSyncResult({
          synced: 1,
          failed: 0,
          total: 1,
          errors: [],
          message: result.created
            ? `Provisioned new LMS account for ${email}`
            : `Updated LMS account for ${email} (${result.accessTier || 'access synced'})`,
        });
      }
    } catch (e) {
      setError(e.message || 'Provision failed');
    } finally {
      setProvisioningEmail('');
    }
  };

  return (
    <section className="admin-section">
      <div className="section-header">
        <h2>
          <Link2 size={20} strokeWidth={2} style={{ verticalAlign: 'middle', marginRight: 8 }} />
          Zoho CRM integration
        </h2>
        <p className="page-sub">
          Leads sync from your existing <strong>Lead Status</strong> (Follow up → Enrolled → Start) and/or
          payment status (<code>unpaid</code> / <code>register</code> / <code>paid</code>). No Zoho changes required
          if statuses already match.
        </p>
      </div>

      {!configured && (
        <div className="alert alert-warning">
          Firebase is not configured. Add your Firebase keys to <code>.env</code> first.
        </div>
      )}

      <div className="card card-pad" style={{ marginBottom: '1rem' }}>
        <h3>Setup</h3>
        <ol className="zoho-setup-list">
          <li>
            Create a Self Client at{' '}
            <a href="https://api-console.zoho.in/" target="_blank" rel="noreferrer">
              Zoho API Console (India)
            </a>{' '}
            with scopes{' '}
            <code>ZohoCRM.modules.leads.ALL,ZohoCRM.modules.notes.ALL</code>.
          </li>
          <li>
            Add custom fields on Leads: <code>Enrolled_Courses</code>, <code>LMS_Role</code>,{' '}
            <code>LMS_Blocked</code>, <code>Firebase_UID</code>, <code>LMS_Password</code> (text),{' '}
            <code>LMS_Program</code> (<code>mbw</code>, <code>lep</code>, <code>100bm</code>),{' '}
            <code>LMS_Access_Tier</code> (<code>registration</code> or <code>full</code>),{' '}
            <code>LMS_Payment_Status</code> (text), <code>LMS_Password_Updated_At</code> (DateTime),{' '}
            <code>LMS_Credential_Status</code> (text).
          </li>
          <li>
            Zoho automation emails credentials to users, then POST to the webhook:{' '}
            <code>https://&lt;region&gt;-&lt;project&gt;.cloudfunctions.net/zohoLeadWebhook</code>{' '}
            with JSON <code>{'{"email":"user@example.com"}'}</code> and header{' '}
            <code>x-zoho-webhook-secret</code> (set <code>ZOHO_WEBHOOK_SECRET</code> in{' '}
            <code>functions/.env</code>).
          </li>
          <li>
            <strong>registration</strong> tier: Pre-Preparation + Quarter 1 only.{' '}
            <strong>full</strong> tier: all MBW sections after sequence gates.
          </li>
          <li>
            Copy <code>functions/.env.example</code> → <code>functions/.env</code> and paste Client
            ID, Secret, and Refresh Token (not in the root <code>.env</code> file).
          </li>
          <li>
            Deploy functions: <code>firebase deploy --only functions</code>
          </li>
        </ol>
      </div>

      <div className="admin-actions-row" style={{ marginBottom: '1rem' }}>
        <button type="button" className="btn btn-outline" onClick={handleTest} disabled={testing || !configured}>
          {testing ? 'Testing…' : 'Test connection'}
        </button>
        <button type="button" className="btn btn-primary" onClick={handleSyncAll} disabled={syncing || !configured}>
          <RefreshCw size={16} style={{ marginRight: 6, verticalAlign: 'middle' }} />
          {syncing ? 'Syncing all users…' : 'Sync all users now'}
        </button>
      </div>

      {status && (
        <div className={`alert ${status.ok ? 'alert-success' : 'alert-warning'}`}>
          {status.ok ? (
            <>
              <CheckCircle2 size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />
              Zoho connection OK — token refresh succeeded.
            </>
          ) : (
            <>
              <AlertCircle size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />
              {status.reason || 'Connection failed'}
            </>
          )}
        </div>
      )}

      {syncResult && (
        <div className="alert alert-success">
          {syncResult.message || (
            <>
              Sync complete: {syncResult.synced} synced, {syncResult.failed} failed (of {syncResult.total}{' '}
              profiles).
            </>
          )}
          {syncResult.errors?.length > 0 && (
            <ul style={{ marginTop: 8, marginBottom: 0 }}>
              {syncResult.errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {error && <div className="alert alert-error">{error}</div>}

      <div className="card card-pad">
        <h3>Sync status</h3>
        <p className="muted">
          {syncedCount} of {users.length} LMS users have a linked Zoho lead ID.
        </p>

        <div className="progress-table-wrap">
          <table className="progress-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Email</th>
                <th>Payment</th>
                <th>Zoho lead</th>
                <th>Last synced</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.displayName || '—'}</td>
                  <td>{u.email || '—'}</td>
                  <td>{u.paymentStatus || u.accessTier || '—'}</td>
                  <td>{(u.zohoLeadId || u.zohoContactId) ? <code>{u.zohoLeadId || u.zohoContactId}</code> : <span className="muted">Not linked</span>}</td>
                  <td>{u.zohoSyncedAt?.toDate?.()?.toLocaleString?.() || '—'}</td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline"
                      disabled={syncingUserId === u.id || !u.email}
                      onClick={() => handleSyncUser(u.id)}
                    >
                      {syncingUserId === u.id ? 'Syncing…' : 'Sync'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-primary"
                      style={{ marginLeft: 6 }}
                      disabled={provisioningEmail === u.email || !u.email}
                      onClick={() => handleProvision(u.email)}
                    >
                      {provisioningEmail === u.email ? 'Provisioning…' : 'Provision'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
