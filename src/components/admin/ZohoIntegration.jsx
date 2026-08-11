import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  RefreshCw,
  Link2,
  CheckCircle2,
  AlertCircle,
  Users,
  Database,
  Search,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import {
  isZohoConfigured,
  testZohoConnection,
  syncAllUsersToZoho,
  syncUserToZohoById,
  provisionUserFromZoho,
  listZohoLeads,
  listZohoIlUsers,
  listZohoIlRegistration,
  previewZohoBatches,
  applyZohoBatch,
  syncUserBatchFromZoho,
} from '../../services/zohoService';
import { formatUserCreatedAt, inferUserOrigin } from '../../utils/userOrigin';
import ConfirmDialog from '../ConfirmDialog';
import { useConfirm } from '../../hooks/useConfirm';

const DIRECTORY_TABS = [
  { id: 'lms', label: 'LMS users' },
  { id: 'leads', label: 'Zoho Leads' },
  { id: 'il_users', label: 'Zoho IL Users' },
  { id: 'il_registration', label: 'IL Registration' },
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
  return fields.some((field) =>
    String(field ?? '')
      .toLowerCase()
      .includes(q)
  );
}

export default function ZohoIntegration({ users = [] }) {
  const { confirm, dialogProps } = useConfirm();
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

  const [batchPreview, setBatchPreview] = useState(null);
  const [batchPreviewLoading, setBatchPreviewLoading] = useState(false);
  const [batchApplyLoading, setBatchApplyLoading] = useState('');
  const [batchApplyResult, setBatchApplyResult] = useState(null);
  const [batchSyncEmail, setBatchSyncEmail] = useState('');
  const [batchSyncLoading, setBatchSyncLoading] = useState(false);
  const [batchSyncResult, setBatchSyncResult] = useState(null);
  const [leadApplyForm, setLeadApplyForm] = useState({
    program: '100bm',
    startDate: '11/07/2026',
    endDate: '16/01/2027',
  });

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

  const filteredIlRegistrationRows = useMemo(() => {
    const rows = directoryData?.rows || [];
    const q = directorySearch.trim();
    if (!q) return rows;
    return rows.filter((row) =>
      matchesDirectorySearch(q, row.name, row.email, row.batch, row.program, row.status, row.id)
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
          : tab === 'il_registration'
            ? await listZohoIlRegistration({ page, perPage: 50 })
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

  const handleBatchPreview = async () => {
    setBatchPreviewLoading(true);
    setError('');
    setBatchPreview(null);
    setBatchApplyResult(null);
    try {
      const result = await previewZohoBatches({ maxPages: 50 });
      if (result?.ok === false) {
        setError(result.reason || 'Batch preview failed');
      } else {
        setBatchPreview(result);
      }
    } catch (e) {
      setError(e.message || 'Batch preview failed');
    } finally {
      setBatchPreviewLoading(false);
    }
  };

  const handleBatchApply = async (batchRow, dryRun = true) => {
    const applyKey = batchRow.startDate
      ? `${batchRow.program}:${batchRow.startDate}:${batchRow.endDate}`
      : `${batchRow.program}:${batchRow.rawBatch}`;
    if (!dryRun) {
      const confirmed = await confirm({
        title: 'Apply Zoho batch?',
        message: `Create or update LMS batch “${batchRow.displayName}” and assign active Zoho learners?\n\nSource: ${batchRow.source === 'leads' ? 'Leads (program dates)' : 'IL_Users / IL_Registration'}\n\nThis writes to Firestore. Excludes Leave/dropped statuses.`,
        confirmLabel: 'Apply batch',
        variant: 'danger',
      });
      if (!confirmed) return;
    }

    setBatchApplyLoading(applyKey);
    setError('');
    setBatchApplyResult(null);
    try {
      const result = await applyZohoBatch({
        program: batchRow.program,
        rawBatch: batchRow.rawBatch,
        startDate: batchRow.startDate,
        endDate: batchRow.endDate,
        dryRun,
        maxPages: 50,
      });
      if (result?.ok === false) {
        setError(result.reason || 'Batch apply failed');
      } else {
        setBatchApplyResult({ ...result, batchKey: applyKey, dryRun });
      }
    } catch (e) {
      setError(e.message || 'Batch apply failed');
    } finally {
      setBatchApplyLoading('');
    }
  };

  const handleBatchSyncUser = async (dryRun = true) => {
    const email = batchSyncEmail.trim().toLowerCase();
    if (!email) {
      setError('Enter a learner email to sync batch from Zoho.');
      return;
    }
    if (!dryRun) {
      const confirmed = await confirm({
        title: 'Sync learner batch?',
        message: `Update LMS batch for ${email} from Zoho?\n\nUses Leads program dates first, then IL_Registration batch. Removes from batch if Zoho status is Leave/dropped.`,
        confirmLabel: 'Sync batch',
        variant: 'danger',
      });
      if (!confirmed) return;
    }

    setBatchSyncLoading(true);
    setError('');
    setBatchSyncResult(null);
    try {
      const result = await syncUserBatchFromZoho(email, { dryRun, provisionIfMissing: !dryRun });
      if (result?.ok === false) {
        setError(result.reason || 'Batch sync failed');
      } else {
        setBatchSyncResult({ ...result, dryRun });
      }
    } catch (e) {
      setError(e.message || 'Batch sync failed');
    } finally {
      setBatchSyncLoading(false);
    }
  };

  const handleLeadDateApply = async (dryRun = true) => {
    const { program, startDate, endDate } = leadApplyForm;
    if (!startDate?.trim() || !endDate?.trim()) {
      setError('Enter both start and end dates (DD/MM/YYYY)');
      return;
    }
    await handleBatchApply(
      {
        program,
        startDate: startDate.trim(),
        endDate: endDate.trim(),
        displayName: `${program.toUpperCase()} · ${startDate.trim()} – ${endDate.trim()}`,
        source: 'leads',
      },
      dryRun
    );
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
        : directoryTab === 'il_registration'
          ? 'Search IL Registration by email, batch, status, program…'
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
          <button
            type="button"
            className="btn btn-sm btn-outline"
            onClick={() => setDirectorySearch('')}
          >
            Clear
          </button>
        </>
      ) : null}
    </div>
  );

  const renderInLmsBadge = (email) => {
    const lmsUser = lmsEmailMap.get(normalizeEmail(email));
    if (!lmsUser) {
      return (
        <span className="muted" style={{ fontSize: '0.78rem' }}>
          Not in LMS
        </span>
      );
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
          <strong>Provision</strong> creates or updates an LMS account from Zoho Lead + IL_Users
          data. Browse <strong>Zoho Leads</strong> and <strong>IL Users</strong> tabs to see
          everyone in CRM — not only users who already signed into the LMS.
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
            <code>ZohoCRM.modules.ALL,ZohoCRM.coql.READ</code>. Do <strong>not</strong> use{' '}
            <code>ZohoCRM.modules.IL_Users.ALL</code> — Zoho rejects custom module names in OAuth;{' '}
            <code>modules.ALL</code> covers IL Users, IL Registration, Leads, and Notes. Optional:
            find exact API names under CRM → Setup → Developer Space → APIs →{' '}
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
            When batch or cohort dates change in Zoho, POST to{' '}
            <code>
              https://&lt;region&gt;-&lt;project&gt;.cloudfunctions.net/zohoBatchUpdateWebhook
            </code>{' '}
            with the same JSON and secret header. Trigger from a Zoho workflow on IL_Registration or
            Lead date/status updates.
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
        <button
          type="button"
          className="btn btn-outline"
          onClick={handleTest}
          disabled={testing || !configured}
        >
          {testing ? 'Testing…' : 'Test connection'}
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleSyncAll}
          disabled={syncing || !configured}
        >
          <RefreshCw size={16} style={{ marginRight: 6, verticalAlign: 'middle' }} />
          {syncing ? 'Pushing to Zoho…' : 'Push all LMS users to Zoho'}
        </button>
      </div>

      <div className="card card-pad" style={{ marginBottom: '1rem' }}>
        <h3>Sync one learner&apos;s batch from Zoho</h3>
        <p className="muted">
          Updates <code>batchId</code> / <code>batchName</code> for a single LMS user from Zoho.
          Uses Leads program dates first, then IL_Registration batch. Removes from batch if Zoho
          status is Leave or dropped.
        </p>
        <div
          className="admin-actions-row"
          style={{ flexWrap: 'wrap', gap: '0.5rem', alignItems: 'flex-end' }}
        >
          <label className="field" style={{ margin: 0, flex: '1 1 14rem', minWidth: '14rem' }}>
            <span className="field-label">Learner email</span>
            <input
              type="email"
              placeholder="learner@example.com"
              value={batchSyncEmail}
              onChange={(e) => setBatchSyncEmail(e.target.value)}
              disabled={batchSyncLoading || !configured}
            />
          </label>
          <button
            type="button"
            className="btn btn-outline"
            disabled={batchSyncLoading || !configured || !batchSyncEmail.trim()}
            onClick={() => handleBatchSyncUser(true)}
          >
            {batchSyncLoading ? 'Working…' : 'Dry run'}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={batchSyncLoading || !configured || !batchSyncEmail.trim()}
            onClick={() => handleBatchSyncUser(false)}
          >
            Sync batch
          </button>
        </div>
        {batchSyncResult && (
          <div
            className={`alert ${batchSyncResult.ok !== false ? 'alert-success' : 'alert-warning'}`}
            role="status"
            style={{ marginTop: '0.75rem' }}
          >
            {batchSyncResult.dryRun !== false ? 'Dry run' : 'Applied'} —{' '}
            <strong>{batchSyncResult.email || batchSyncEmail}</strong>
            <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.2rem' }}>
              <li>Action: {batchSyncResult.action || '—'}</li>
              <li>Source: {batchSyncResult.source || '—'}</li>
              <li>Target batch: {batchSyncResult.batchName || batchSyncResult.batchId || '—'}</li>
              {batchSyncResult.previousBatchName && (
                <li>Previous batch: {batchSyncResult.previousBatchName}</li>
              )}
              {batchSyncResult.reason && <li>{batchSyncResult.reason}</li>}
            </ul>
          </div>
        )}
      </div>

      <div className="card card-pad" style={{ marginBottom: '1rem' }}>
        <h3>Batch mapping preview (read-only)</h3>
        <p className="muted">
          Scans <strong>Leads</strong> with COQL on program date fields (<code>BM_Reg_Date1</code> /{' '}
          <code>BM_End_Date</code> for 100BM), plus IL_Users / IL_Registration. Use{' '}
          <strong>Apply by Leads dates</strong> for a specific cohort (e.g. 11/07/2026 –
          16/01/2027).
        </p>

        <div
          className="admin-actions-row"
          style={{
            flexWrap: 'wrap',
            gap: '0.5rem',
            alignItems: 'flex-end',
            marginBottom: '0.75rem',
          }}
        >
          <label className="field" style={{ margin: 0, minWidth: '7rem' }}>
            <span className="field-label">Program</span>
            <select
              value={leadApplyForm.program}
              onChange={(e) => setLeadApplyForm((f) => ({ ...f, program: e.target.value }))}
            >
              <option value="100bm">100BM</option>
              <option value="lep">LEP</option>
              <option value="mbw">MBW</option>
            </select>
          </label>
          <label className="field" style={{ margin: 0, minWidth: '9rem' }}>
            <span className="field-label">
              {leadApplyForm.program === '100bm'
                ? 'BM_Reg_Date1'
                : leadApplyForm.program === 'lep'
                  ? 'LEP_Reg_Date'
                  : 'MBW_Reg_Date'}
            </span>
            <input
              type="text"
              placeholder="11/07/2026"
              value={leadApplyForm.startDate}
              onChange={(e) => setLeadApplyForm((f) => ({ ...f, startDate: e.target.value }))}
            />
          </label>
          <label className="field" style={{ margin: 0, minWidth: '9rem' }}>
            <span className="field-label">
              {leadApplyForm.program === '100bm'
                ? 'BM_End_Date'
                : leadApplyForm.program === 'lep'
                  ? 'LEP_End_Date'
                  : 'MBW_End_Date'}
            </span>
            <input
              type="text"
              placeholder="16/01/2027"
              value={leadApplyForm.endDate}
              onChange={(e) => setLeadApplyForm((f) => ({ ...f, endDate: e.target.value }))}
            />
          </label>
          <button
            type="button"
            className="btn btn-outline"
            disabled={Boolean(batchApplyLoading) || !configured}
            onClick={() => handleLeadDateApply(true)}
          >
            {batchApplyLoading ===
            `${leadApplyForm.program}:${leadApplyForm.startDate.trim()}:${leadApplyForm.endDate.trim()}`
              ? 'Working…'
              : 'Dry run (Leads dates)'}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={Boolean(batchApplyLoading) || !configured}
            onClick={() => handleLeadDateApply(false)}
          >
            Apply to LMS
          </button>
        </div>
        <p className="muted" style={{ marginTop: '-0.25rem', fontSize: '0.85rem' }}>
          COQL filter:{' '}
          <code>
            BM_Reg_Date1 = &apos;2026-07-11&apos; and BM_End_Date = &apos;2027-01-16&apos;
          </code>{' '}
          (dates converted to ISO). Same as your Zoho Leads filter — not the IL_Users Batch string.
        </p>

        {batchApplyResult && (
          <div
            className={`alert ${
              (batchApplyResult.zohoMatched ?? 0) > 0 ? 'alert-success' : 'alert-warning'
            }`}
            role="status"
            style={{ marginTop: '0.75rem' }}
          >
            {batchApplyResult.dryRun !== false ? 'Dry run' : 'Applied to LMS'} —{' '}
            <strong>{batchApplyResult.displayName || 'Leads cohort'}</strong>
            <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.2rem' }}>
              <li>
                Source: {batchApplyResult.source || '—'} ({batchApplyResult.method || '—'})
              </li>
              <li>
                Zoho rows returned:{' '}
                {batchApplyResult.scannedLeads ?? batchApplyResult.zohoMatched ?? '—'}
              </li>
              <li>Unique emails: {batchApplyResult.zohoMatched ?? '—'}</li>
              <li>Duplicate email rows: {batchApplyResult.duplicateEmails ?? 0}</li>
              <li>Active (after status filter): {batchApplyResult.active ?? '—'}</li>
              <li>Excluded (Leave/dropped): {batchApplyResult.excludedByStatus ?? 0}</li>
              <li>Skipped (no email): {batchApplyResult.skippedNoEmail ?? 0}</li>
              <li>Date mismatch dropped: {batchApplyResult.skippedDateMismatch ?? 0}</li>
              {batchApplyResult.query && (
                <li className="muted" style={{ wordBreak: 'break-all' }}>
                  Query: <code>{batchApplyResult.query}</code>
                </li>
              )}
              {batchApplyResult.fieldsUsed && (
                <li className="muted">
                  Fields: {batchApplyResult.fieldsUsed.start} + {batchApplyResult.fieldsUsed.end}
                </li>
              )}
              {batchApplyResult.reason && <li>{batchApplyResult.reason}</li>}
              {batchApplyResult.dryRun === false && (
                <>
                  <li>New accounts provisioned: {batchApplyResult.provisioned ?? 0}</li>
                  <li>Assigned to batch: {batchApplyResult.assigned ?? 0}</li>
                  <li>Already in batch: {batchApplyResult.alreadyInBatch ?? 0}</li>
                </>
              )}
              {(batchApplyResult.skipped > 0 || batchApplyResult.errors?.length > 0) && (
                <li>
                  Skipped/errors: {batchApplyResult.skipped ?? 0}
                  {batchApplyResult.errors?.length > 0 && (
                    <ul style={{ marginTop: '0.35rem' }}>
                      {batchApplyResult.errors.slice(0, 8).map((entry, i) => (
                        <li key={`${entry.email}-${i}`}>
                          {entry.email}: {entry.reason}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              )}
            </ul>
            {batchApplyResult.learners?.length > 0 && (
              <div style={{ marginTop: '0.75rem' }}>
                <h4 style={{ margin: '0 0 0.5rem' }}>
                  Learners ({batchApplyResult.learners.length})
                </h4>
                <div className="table-scroll-wrap" style={{ maxHeight: '22rem', overflow: 'auto' }}>
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th scope="col">#</th>
                        <th scope="col">Name</th>
                        <th scope="col">Email</th>
                        <th scope="col">Lead status</th>
                        <th scope="col">Active</th>
                      </tr>
                    </thead>
                    <tbody>
                      {batchApplyResult.learners.map((learner, index) => (
                        <tr key={learner.email || index}>
                          <td>{index + 1}</td>
                          <td>{learner.name || '—'}</td>
                          <td>{learner.email}</td>
                          <td className="muted">{learner.leadStatus || '—'}</td>
                          <td>{learner.active === false ? 'No' : 'Yes'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="alert alert-error" role="alert" style={{ marginTop: '0.75rem' }}>
            {error}
          </div>
        )}

        <div className="admin-actions-row" style={{ marginTop: '0.75rem' }}>
          <button
            type="button"
            className="btn btn-outline"
            onClick={handleBatchPreview}
            disabled={batchPreviewLoading || !configured}
          >
            <Database size={16} style={{ marginRight: 6, verticalAlign: 'middle' }} />
            {batchPreviewLoading ? 'Scanning Zoho…' : 'Run batch preview'}
          </button>
        </div>

        {batchPreview && (
          <div style={{ marginTop: '1rem' }}>
            <p className="alert alert-success" role="status">
              Dry run complete — nothing was written. IL_Users:{' '}
              <strong>{batchPreview.scannedRecords}</strong> scanned (
              <strong>
                {batchPreview.sources?.ilUsersWithBatch ?? batchPreview.recordsWithBatch}
              </strong>{' '}
              with batch)
              {batchPreview.registrationScannedRecords != null && (
                <>
                  {' '}
                  · IL_Registration: <strong>{batchPreview.registrationScannedRecords}</strong>{' '}
                  scanned (<strong>{batchPreview.sources?.ilRegistrationWithBatch ?? 0}</strong>{' '}
                  with batch)
                </>
              )}{' '}
              · Merged IL unique:{' '}
              <strong>
                {batchPreview.sources?.mergedUniqueEmails ?? batchPreview.recordsWithBatch}
              </strong>
              {batchPreview.scannedLeads != null && (
                <>
                  {' '}
                  · Leads scanned: <strong>{batchPreview.scannedLeads}</strong> (
                  <strong>{batchPreview.leadCohortCount ?? 0}</strong> cohorts)
                </>
              )}
              {batchPreview.truncated ? ' More records exist beyond this scan.' : ''}
            </p>

            {batchPreview.registrationCoqlError && (
              <p className="alert alert-warning" role="alert">
                IL_Registration scan failed — batch counts may be IL_Users only.{' '}
                {batchPreview.registrationCoqlError}
              </p>
            )}

            {batchPreview.method === 'unfiltered-scan' && (
              <p className="alert alert-warning" role="alert">
                COQL was unavailable, so this fell back to an unfiltered scan — these numbers are
                <strong> incomplete</strong> and under-count real batches.
                {batchPreview.coqlError ? ` Reason: ${batchPreview.coqlError}` : ''}
              </p>
            )}

            {batchPreview.leadCohortsError && (
              <p className="alert alert-warning" role="alert">
                Leads cohort scan failed: {batchPreview.leadCohortsError}
              </p>
            )}

            {batchPreview.leadCohortFields && (
              <p className="muted" style={{ fontSize: '0.85rem' }}>
                Leads fields used: 100BM start=
                <code>{batchPreview.leadCohortFields['100bm']?.start}</code>
                {' · '}end=<code>{batchPreview.leadCohortFields['100bm']?.end}</code>
                {' · '}Program=<code>{batchPreview.leadCohortFields['100bm']?.programField}</code>
              </p>
            )}

            <div className="zoho-batch-preview__stats">
              <span>
                <strong>{batchPreview.leadCohortCount ?? 0}</strong> Leads cohorts
              </span>
              <span>
                <strong>{batchPreview.batchCount}</strong> IL_Users batches
              </span>
              <span>
                <strong>{batchPreview.review?.length || 0}</strong> need review
              </span>
              <span>
                <strong>{batchPreview.conflicts?.length || 0}</strong> conflicts
              </span>
              <span>
                <strong>{batchPreview.invalidValues?.length || 0}</strong> invalid values
              </span>
              <span>
                <strong>{batchPreview.duplicateRecords?.length || 0}</strong> duplicate records
              </span>
            </div>

            <h4>Leads cohorts (program start + end dates) — use this</h4>
            <p className="muted" style={{ marginTop: '-0.35rem' }}>
              Matches Zoho Leads filters: Program + BM_Reg_Date1 / BM_End_Date (100BM), etc.
            </p>
            <div className="table-scroll-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th scope="col">Program</th>
                    <th scope="col">Cohort</th>
                    <th scope="col">Learners</th>
                    <th scope="col">Start</th>
                    <th scope="col">End</th>
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(batchPreview.plannedLeadCohorts || []).length === 0 ? (
                    <tr>
                      <td colSpan={6} className="muted">
                        No Leads cohorts found. Deploy updated functions, then re-run preview — or
                        use <strong>Dry run (Leads dates)</strong> above with BM_Reg_Date1 /
                        BM_End_Date. Looking for “11/07/2026 - 16/01/2027” in IL_Users will miss
                        this cohort (that string is not on Leads).
                      </td>
                    </tr>
                  ) : (
                    batchPreview.plannedLeadCohorts.map((b) => {
                      const applyKey = `${b.program}:${b.startDate}:${b.endDate}`;
                      const isApplying = batchApplyLoading === applyKey;
                      return (
                        <tr key={b.docId}>
                          <td>{b.program?.toUpperCase()}</td>
                          <td>{b.displayName}</td>
                          <td>
                            <strong>{b.memberCount}</strong>
                          </td>
                          <td className="muted">{String(b.startDate)}</td>
                          <td className="muted">{String(b.endDate)}</td>
                          <td>
                            <div
                              className="admin-actions-row"
                              style={{ margin: 0, flexWrap: 'wrap', gap: '0.35rem' }}
                            >
                              <button
                                type="button"
                                className="btn btn-sm btn-outline"
                                disabled={Boolean(batchApplyLoading) || !configured}
                                onClick={() => handleBatchApply({ ...b, source: 'leads' }, true)}
                              >
                                {isApplying ? 'Working…' : 'Dry run apply'}
                              </button>
                              <button
                                type="button"
                                className="btn btn-sm btn-primary"
                                disabled={Boolean(batchApplyLoading) || !configured}
                                onClick={() => handleBatchApply({ ...b, source: 'leads' }, false)}
                              >
                                Apply to LMS
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <h4>IL_Users / IL_Registration batches (legacy)</h4>
            <div className="table-scroll-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th scope="col">Program</th>
                    <th scope="col">Batch</th>
                    <th scope="col">Learners</th>
                    <th scope="col">Zoho value</th>
                    <th scope="col">Warnings</th>
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(batchPreview.plannedBatches || []).map((b) => {
                    const applyKey = `${b.program}:${b.rawBatch}`;
                    const isApplying = batchApplyLoading === applyKey;
                    return (
                      <tr key={b.docId}>
                        <td>{b.program?.toUpperCase()}</td>
                        <td>{b.displayName}</td>
                        <td>{b.memberCount}</td>
                        <td className="muted">{b.rawBatch}</td>
                        <td className="muted">{b.warnings?.join('; ') || '—'}</td>
                        <td>
                          <div
                            className="admin-actions-row"
                            style={{ margin: 0, flexWrap: 'wrap', gap: '0.35rem' }}
                          >
                            <button
                              type="button"
                              className="btn btn-sm btn-outline"
                              disabled={Boolean(batchApplyLoading) || !configured}
                              onClick={() => handleBatchApply(b, true)}
                            >
                              {isApplying ? 'Working…' : 'Dry run apply'}
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm btn-primary"
                              disabled={Boolean(batchApplyLoading) || !configured}
                              onClick={() => handleBatchApply(b, false)}
                            >
                              Apply to LMS
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {batchPreview.review?.length > 0 && (
              <>
                <h4>Needs review — not auto-assigned</h4>
                <ul className="zoho-batch-preview__list">
                  {batchPreview.review.map((r, i) => (
                    <li key={`${r.recordId || r.email}-${i}`}>
                      <strong>{r.email}</strong> — {r.reason}
                      {r.detail ? <span className="muted"> ({r.detail})</span> : null}
                    </li>
                  ))}
                </ul>
              </>
            )}

            {batchPreview.conflicts?.length > 0 && (
              <>
                <h4>Conflicts — same learner in two batches of one program</h4>
                <ul className="zoho-batch-preview__list">
                  {batchPreview.conflicts.map((c, i) => (
                    <li key={`${c.email}-${c.program}-${i}`}>
                      <strong>{c.email}</strong> [{c.program?.toUpperCase()}] →{' '}
                      {c.batches.join(' | ')}
                    </li>
                  ))}
                </ul>
              </>
            )}

            {batchPreview.invalidValues?.length > 0 && (
              <>
                <h4>Invalid batch values — skipped</h4>
                <ul className="zoho-batch-preview__list">
                  {batchPreview.invalidValues.map((v, i) => (
                    <li key={`${v.recordId || v.email}-${i}`}>
                      <strong>{v.email}</strong> [{v.program?.toUpperCase()}] &quot;{v.rawBatch}
                      &quot; — {v.reason}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
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
              Push complete: {syncResult.synced} synced, {syncResult.failed} failed (of{' '}
              {syncResult.total} LMS profiles).
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
              {t.id === 'lms' ? (
                <Users size={14} style={{ marginRight: 4 }} />
              ) : (
                <Database size={14} style={{ marginRight: 4 }} />
              )}
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
            {syncedCount} of {users.length} LMS accounts have a linked Zoho lead ID. Users appear
            here after they sign up or you provision them from Zoho.
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
                        {u.zohoLeadId || u.zohoContactId ? (
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
            All leads in your Zoho CRM Leads module (paginated). Use <strong>Provision</strong> to
            create or update the matching LMS account from Lead + IL_Users data.
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
                  <ChevronLeft size={14} aria-hidden="true" />
                  Previous
                </button>
                <span className="muted">Page {directoryPage}</span>
                <button
                  type="button"
                  className="btn btn-sm btn-outline"
                  disabled={!directoryData?.moreRecords || directoryLoading}
                  onClick={() => setDirectoryPage((p) => p + 1)}
                >
                  Next
                  <ChevronRight size={14} aria-hidden="true" />
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
            Credential records from the IL_Users module (Pre-IL registration). These are the
            accounts students use to log in once provisioned.
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
                              disabled={
                                !(row.email || row.username) ||
                                provisioningEmail === (row.email || row.username)
                              }
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
                  <ChevronLeft size={14} aria-hidden="true" />
                  Previous
                </button>
                <span className="muted">Page {directoryPage}</span>
                <button
                  type="button"
                  className="btn btn-sm btn-outline"
                  disabled={!directoryData?.moreRecords || directoryLoading}
                  onClick={() => setDirectoryPage((p) => p + 1)}
                >
                  Next
                  <ChevronRight size={14} aria-hidden="true" />
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {directoryTab === 'il_registration' && (
        <div className="card card-pad">
          <h3>Zoho IL Registration</h3>
          <p className="muted">
            Cohort tracker — usually matches your master sheet (Batch, Current Status, program).
            Batch sync prefers these records over IL_Users when the email exists in both.
          </p>
          {directoryLoading ? (
            <p className="muted">Loading IL Registration from Zoho…</p>
          ) : !directoryData?.rows?.length ? (
            <p className="muted">No IL Registration records found on this page.</p>
          ) : (
            <>
              {renderDirectorySearch(filteredIlRegistrationRows.length, directoryData.rows.length)}

              <div className="progress-table-wrap">
                <table className="progress-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Batch</th>
                      <th>Program</th>
                      <th>Status</th>
                      <th>LMS</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {filteredIlRegistrationRows.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="muted">
                          No IL Registration rows on this page match &ldquo;{directorySearch.trim()}
                          &rdquo;.
                        </td>
                      </tr>
                    ) : (
                      filteredIlRegistrationRows.map((row) => (
                        <tr key={row.id}>
                          <td>{row.name || '—'}</td>
                          <td>{row.email || '—'}</td>
                          <td>{row.batch || '—'}</td>
                          <td>{row.program || '—'}</td>
                          <td>{row.status || '—'}</td>
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
                  <ChevronLeft size={14} aria-hidden="true" />
                  Previous
                </button>
                <span className="muted">Page {directoryPage}</span>
                <button
                  type="button"
                  className="btn btn-sm btn-outline"
                  disabled={!directoryData?.moreRecords || directoryLoading}
                  onClick={() => setDirectoryPage((p) => p + 1)}
                >
                  Next
                  <ChevronRight size={14} aria-hidden="true" />
                </button>
              </div>
            </>
          )}
        </div>
      )}
      <ConfirmDialog {...dialogProps} />
    </section>
  );
}
