import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, Link2, CheckCircle2, AlertCircle, Users, Database, Search } from 'lucide-react';
import {
  isZohoConfigured,
  testZohoConnection,
  syncAllUsersToZoho,
  syncUserToZohoById,
  provisionUserFromZoho,
  listZohoLeads,
  listZohoIlUsers,
} from '../../services/zohoService';
import { formatUserCreatedAt, inferUserOrigin } from '../../utils/userOrigin';

const DIRECTORY_TABS = [
  { id: 'lms', label: 'LMS users' },
  { id: 'leads', label: 'Zoho Leads' },
  { id: 'il_users', label: 'Zoho IL Users' },
];

function normalizeEmail(email) {
  return (email || '').trim().toLowerCase();
}

function lmsUserByEmail(users) {
  const map = new Map();
  users.forEach((u) => {
    const key = normalizeEmail(u.email);
    if (key) map.set(key, u);
  });
  return map;
}

function matchesDirectorySearch(query, ...fields) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return fields.some((field) => String(field ?? '').toLowerCase().includes(q));
}

export default function ZohoIntegration({ users = [] }) {
  const [status, setStatus] = useState(null);
  const [syncResult, setSyncResult] = useState(null);
  const [testing, setTesting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncingUserId, setSyncingUserId] = useState('');
  const [error, setError] = useState('');

  const [provisioningEmail, setProvisioningEmail] = useState('');
  const [directoryTab, setDirectoryTab] = useState('lms');
  const [directoryPage, setDirectoryPage] = useState(1);
  const [directorySearch, setDirectorySearch] = useState('');
  const [directoryLoading, setDirectoryLoading] = useState(false);
  const [directoryData, setDirectoryData] = useState(null);

  const configured = isZohoConfigured();
  const syncedCount = users.filter((u) => u.zohoLeadId || u.zohoContactId).length;
  const lmsEmailMap = useMemo(() => lmsUserByEmail(users), [users]);

  const lmsUsersSorted = useMemo(
    () =>
      [...users].sort((a, b) => {
        const ta = a.createdAt?.toMillis?.() ?? 0;
        const tb = b.createdAt?.toMillis?.() ?? 0;
        return tb - ta;
      }),
    [users]
  );

  const filteredLmsUsers = useMemo(() => {
    const q = directorySearch.trim();
    if (!q) return lmsUsersSorted;
    return lmsUsersSorted.filter((u) =>
      matchesDirectorySearch(
        q,
        u.displayName,
        u.email,
        u.paymentStatus,
        u.accessTier,
        u.zohoLeadId,
        u.zohoContactId,
        inferUserOrigin(u)
      )
    );
  }, [lmsUsersSorted, directorySearch]);

  const filteredLeadRows = useMemo(() => {
    const rows = directoryData?.rows || [];
    const q = directorySearch.trim();
    if (!q) return rows;
    return rows.filter((row) =>
      matchesDirectorySearch(
        q,
        row.name,
        row.email,
        row.program,
        row.paymentStatus,
        row.accessTier,
        row.leadStatus,
        row.id
      )
    );
  }, [directoryData, directorySearch]);

  const filteredIlUserRows = useMemo(() => {
    const rows = directoryData?.rows || [];
    const q = directorySearch.trim();
    if (!q) return rows;
    return rows.filter((row) =>
      matchesDirectorySearch(q, row.name, row.email, row.username, row.phone, row.id)
    );
  }, [directoryData, directorySearch]);

  const loadDirectory = useCallback(async (tab, page) => {
    if (tab === 'lms') return;
    setDirectoryLoading(true);
    setError('');
    try {
      const result =
        tab === 'leads'
          ? await listZohoLeads({ page, perPage: 50 })
          : await listZohoIlUsers({ page, perPage: 50 });
      if (!result?.ok && result?.reason) {
        setError(result.reason);
        setDirectoryData(null);
      } else {
        setDirectoryData(result);
      }
    } catch (e) {
      setError(e.message || 'Failed to load Zoho records');
      setDirectoryData(null);
    } finally {
      setDirectoryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (directoryTab === 'lms') return;
    loadDirectory(directoryTab, directoryPage);
  }, [directoryTab, directoryPage, loadDirectory]);

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
        if (directoryTab !== 'lms') {
          loadDirectory(directoryTab, directoryPage);
        }
      }
    } catch (e) {
      setError(e.message || 'Provision failed');
    } finally {
      setProvisioningEmail('');
    }
  };

  const switchDirectoryTab = (tab) => {
    setDirectoryTab(tab);
    setDirectoryPage(1);
    setDirectoryData(null);
    setDirectorySearch('');
  };

  const directorySearchPlaceholder =
    directoryTab === 'lms'
      ? 'Search by name, email, payment, or Zoho lead ID…'
      : directoryTab === 'leads'
        ? 'Search leads on this page by name, email, program…'
        : 'Search IL users on this page by name, email, phone…';

  const renderDirectorySearch = (resultCount, totalCount) => (
    <div className="admin-form zoho-directory-search" style={{ marginBottom: '0.75rem' }}>
      <div className="zoho-directory-search__field">
        <Search size={16} className="zoho-directory-search__icon" aria-hidden />
        <input
          type="search"
          placeholder={directorySearchPlaceholder}
          value={directorySearch}
          onChange={(e) => setDirectorySearch(e.target.value)}
          className="admin-form__search zoho-directory-search__input"
          aria-label="Search participants"
        />
      </div>
      {directorySearch.trim() ? (
        <>
          <span className="muted zoho-directory-search__count">
            {resultCount} of {totalCount} shown
          </span>
          <button type="button" className="btn btn-sm btn-outline" onClick={() => setDirectorySearch('')}>
            Clear
          </button>
        </>
      ) : null}
    </div>
  );

  const renderInLmsBadge = (email) => {
    const lmsUser = lmsEmailMap.get(normalizeEmail(email));
    if (!lmsUser) {
      return <span className="muted" style={{ fontSize: '0.78rem' }}>Not in LMS</span>;
    }
    return (
      <span className="cx-count-badge" title={lmsUser.displayName || lmsUser.email}>
        In LMS
      </span>
    );
  };

  return (
    <section className="admin-section">
      <div className="section-header">
        <h2>
          <Link2 size={20} strokeWidth={2} style={{ verticalAlign: 'middle', marginRight: 8 }} />
          Zoho CRM integration
        </h2>
        <p className="page-sub">
          <strong>Push to Zoho</strong> updates existing LMS profiles on Zoho Leads.{' '}
          <strong>Provision</strong> creates or updates an LMS account from Zoho Lead + IL_Users data.{' '}
          Browse <strong>Zoho Leads</strong> and <strong>IL Users</strong> tabs to see everyone in CRM —
          not only users who already signed into the LMS.
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
            with scopes (comma-separated, no spaces):{' '}
            <code>ZohoCRM.modules.ALL,ZohoCRM.coql.READ</code>
            . Do <strong>not</strong> use <code>ZohoCRM.modules.IL_Users.ALL</code> — Zoho rejects
            custom module names in OAuth; <code>modules.ALL</code> covers IL Users, IL Registration, Leads,
            and Notes. Optional: find exact API names under CRM → Setup → Developer Space → APIs →{' '}
            <strong>API Names</strong>.
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
          {syncing ? 'Pushing to Zoho…' : 'Push all LMS users to Zoho'}
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
              Push complete: {syncResult.synced} synced, {syncResult.failed} failed (of {syncResult.total}{' '}
              LMS profiles).
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

      <div className="cx-section__head" style={{ marginBottom: '0.75rem' }}>
        <nav className="admin-tabs" style={{ marginBottom: 0 }}>
          {DIRECTORY_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={directoryTab === t.id ? 'active' : ''}
              onClick={() => switchDirectoryTab(t.id)}
            >
              {t.id === 'lms' ? <Users size={14} style={{ marginRight: 4 }} /> : <Database size={14} style={{ marginRight: 4 }} />}
              {t.label}
            </button>
          ))}
        </nav>
        {directoryTab !== 'lms' && (
          <button
            type="button"
            className="btn btn-sm btn-outline"
            disabled={directoryLoading || !configured}
            onClick={() => loadDirectory(directoryTab, directoryPage)}
          >
            <RefreshCw size={14} style={{ marginRight: 4, verticalAlign: 'middle' }} />
            Refresh
          </button>
        )}
      </div>

      {directoryTab === 'lms' && (
        <div className="card card-pad">
          <h3>LMS users linked to Zoho</h3>
          <p className="muted">
            {syncedCount} of {users.length} LMS accounts have a linked Zoho lead ID. Users appear here after
            they sign up or you provision them from Zoho.
          </p>

          {renderDirectorySearch(filteredLmsUsers.length, lmsUsersSorted.length)}

          <div className="progress-table-wrap">
            <table className="progress-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Email</th>
                  <th>Joined</th>
                  <th>How joined</th>
                  <th>Payment</th>
                  <th>Zoho lead</th>
                  <th>Last pushed</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filteredLmsUsers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="muted">
                      {directorySearch.trim()
                        ? `No participants match “${directorySearch.trim()}”.`
                        : 'No LMS users yet.'}
                    </td>
                  </tr>
                ) : (
                  filteredLmsUsers.map((u) => (
                  <tr key={u.id}>
                    <td>{u.displayName || '—'}</td>
                    <td>{u.email || '—'}</td>
                    <td className="muted">{formatUserCreatedAt(u.createdAt)}</td>
                    <td className="muted">{inferUserOrigin(u)}</td>
                    <td>{u.paymentStatus || u.accessTier || '—'}</td>
                    <td>
                      {(u.zohoLeadId || u.zohoContactId) ? (
                        <code>{u.zohoLeadId || u.zohoContactId}</code>
                      ) : (
                        <span className="muted">Not linked</span>
                      )}
                    </td>
                    <td>{u.zohoSyncedAt?.toDate?.()?.toLocaleString?.() || '—'}</td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline"
                        disabled={syncingUserId === u.id || !u.email}
                        onClick={() => handleSyncUser(u.id)}
                      >
                        {syncingUserId === u.id ? 'Pushing…' : 'Push'}
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
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {directoryTab === 'leads' && (
        <div className="card card-pad">
          <h3>Zoho Leads</h3>
          <p className="muted">
            All leads in your Zoho CRM Leads module (paginated). Use <strong>Provision</strong> to create or
            update the matching LMS account from Lead + IL_Users data.
          </p>
          {directoryLoading ? (
            <p className="muted">Loading leads from Zoho…</p>
          ) : !directoryData?.rows?.length ? (
            <p className="muted">No leads found on this page.</p>
          ) : (
            <>
              {renderDirectorySearch(filteredLeadRows.length, directoryData.rows.length)}

              <div className="progress-table-wrap">
                <table className="progress-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Program</th>
                      <th>Payment</th>
                      <th>Lead status</th>
                      <th>LMS</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLeadRows.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="muted">
                          No leads on this page match &ldquo;{directorySearch.trim()}&rdquo;.
                        </td>
                      </tr>
                    ) : (
                      filteredLeadRows.map((row) => (
                      <tr key={row.id}>
                        <td>{row.name || '—'}</td>
                        <td>{row.email || '—'}</td>
                        <td>{row.program || '—'}</td>
                        <td>{row.paymentStatus || row.accessTier || '—'}</td>
                        <td>{row.leadStatus || '—'}</td>
                        <td>{renderInLmsBadge(row.email)}</td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-sm btn-primary"
                            disabled={!row.email || provisioningEmail === row.email}
                            onClick={() => handleProvision(row.email)}
                          >
                            {provisioningEmail === row.email ? 'Provisioning…' : 'Provision'}
                          </button>
                        </td>
                      </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <div className="admin-actions-row" style={{ marginTop: '0.75rem' }}>
                <button
                  type="button"
                  className="btn btn-sm btn-outline"
                  disabled={directoryPage <= 1 || directoryLoading}
                  onClick={() => setDirectoryPage((p) => Math.max(1, p - 1))}
                >
                  ← Previous
                </button>
                <span className="muted">Page {directoryPage}</span>
                <button
                  type="button"
                  className="btn btn-sm btn-outline"
                  disabled={!directoryData?.moreRecords || directoryLoading}
                  onClick={() => setDirectoryPage((p) => p + 1)}
                >
                  Next →
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {directoryTab === 'il_users' && (
        <div className="card card-pad">
          <h3>Zoho IL Users</h3>
          <p className="muted">
            Credential records from the IL_Users module (Pre-IL registration). These are the accounts students
            use to log in once provisioned.
          </p>
          {directoryLoading ? (
            <p className="muted">Loading IL Users from Zoho…</p>
          ) : !directoryData?.rows?.length ? (
            <p className="muted">No IL Users found on this page.</p>
          ) : (
            <>
              {renderDirectorySearch(filteredIlUserRows.length, directoryData.rows.length)}

              <div className="progress-table-wrap">
                <table className="progress-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email / Username</th>
                      <th>Phone</th>
                      <th>Password set</th>
                      <th>LMS</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {filteredIlUserRows.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="muted">
                          No IL users on this page match &ldquo;{directorySearch.trim()}&rdquo;.
                        </td>
                      </tr>
                    ) : (
                      filteredIlUserRows.map((row) => (
                      <tr key={row.id}>
                        <td>{row.name || row.username || '—'}</td>
                        <td>{row.email || row.username || '—'}</td>
                        <td>{row.phone || '—'}</td>
                        <td>{row.hasPassword ? 'Yes' : 'No'}</td>
                        <td>{renderInLmsBadge(row.email || row.username)}</td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-sm btn-primary"
                            disabled={!(row.email || row.username) || provisioningEmail === (row.email || row.username)}
                            onClick={() => handleProvision(row.email || row.username)}
                          >
                            {provisioningEmail === (row.email || row.username)
                              ? 'Provisioning…'
                              : 'Provision'}
                          </button>
                        </td>
                      </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <div className="admin-actions-row" style={{ marginTop: '0.75rem' }}>
                <button
                  type="button"
                  className="btn btn-sm btn-outline"
                  disabled={directoryPage <= 1 || directoryLoading}
                  onClick={() => setDirectoryPage((p) => Math.max(1, p - 1))}
                >
                  ← Previous
                </button>
                <span className="muted">Page {directoryPage}</span>
                <button
                  type="button"
                  className="btn btn-sm btn-outline"
                  disabled={!directoryData?.moreRecords || directoryLoading}
                  onClick={() => setDirectoryPage((p) => p + 1)}
                >
                  Next →
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}
