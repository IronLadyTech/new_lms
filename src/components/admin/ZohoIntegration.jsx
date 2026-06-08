import { useState } from 'react';
import { RefreshCw, Link2, CheckCircle2, AlertCircle } from 'lucide-react';
import {
  isZohoConfigured,
  testZohoConnection,
  syncAllUsersToZoho,
  syncUserToZohoById,
} from '../../services/zohoService';

export default function ZohoIntegration({ users = [] }) {
  const [status, setStatus] = useState(null);
  const [syncResult, setSyncResult] = useState(null);
  const [testing, setTesting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncingUserId, setSyncingUserId] = useState('');
  const [error, setError] = useState('');

  const configured = isZohoConfigured();
  const syncedCount = users.filter((u) => u.zohoContactId).length;

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

  return (
    <section className="admin-section">
      <div className="section-header">
        <h2>
          <Link2 size={20} strokeWidth={2} style={{ verticalAlign: 'middle', marginRight: 8 }} />
          Zoho CRM integration
        </h2>
        <p className="page-sub">
          Contacts sync automatically when users sign up, enroll, or change profile. Activity logs
          appear as Notes on the matching Zoho contact.
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
            <code>ZohoCRM.modules.contacts.ALL,ZohoCRM.modules.notes.ALL</code>.
          </li>
          <li>
            Add custom fields on Contacts: <code>Enrolled_Courses</code>, <code>LMS_Role</code>,{' '}
            <code>LMS_Blocked</code>, <code>Firebase_UID</code>.
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
          Sync complete: {syncResult.synced} synced, {syncResult.failed} failed (of {syncResult.total}{' '}
          profiles).
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
          {syncedCount} of {users.length} LMS users have a linked Zoho contact ID.
        </p>

        <div className="progress-table-wrap">
          <table className="progress-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Email</th>
                <th>Zoho contact</th>
                <th>Last synced</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.displayName || '—'}</td>
                  <td>{u.email || '—'}</td>
                  <td>{u.zohoContactId ? <code>{u.zohoContactId}</code> : <span className="muted">Not linked</span>}</td>
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
