import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  HardDrive,
  RefreshCw,
  Trash2,
  ScanSearch,
  AlertTriangle,
  UserX,
  ExternalLink,
  Filter,
} from 'lucide-react';
import {
  isStorageAdminAvailable,
  getStorageOverview,
  scanStorageBucket,
  listStorageObjects,
  deleteStorageObjects,
  cleanOrphanFiles,
  deleteUserStorage,
} from '../../services/storageAdminService';
import { formatStorageBytes } from '../../services/storageService';
import { useConfirm } from '../../hooks/useConfirm';
import ConfirmDialog from '../ConfirmDialog';

const FOLDER_LABELS = {
  resources: 'Resources (PDF/PPT)',
  courses: 'Course thumbnails',
  events: 'Event images',
  mbw: 'MBW learner uploads',
  unknown: 'Other',
};

const SOURCE_LABELS = {
  course: 'Course',
  resource: 'Resource',
  event: 'Event',
  mbw: 'MBW submission',
  orphan: 'Orphan (unlinked)',
};

function userLabel(user) {
  return user?.displayName || user?.email?.split('@')[0] || user?.id || 'Unknown';
}

export default function StorageManager({ users = [] }) {
  const { confirm, dialogProps } = useConfirm();
  const [overview, setOverview] = useState(null);
  const [objects, setObjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [filterFolder, setFilterFolder] = useState('');
  const [filterUserId, setFilterUserId] = useState('');
  const [filterSource, setFilterSource] = useState('');
  const [showOrphansOnly, setShowOrphansOnly] = useState(false);
  const [selectedPaths, setSelectedPaths] = useState(new Set());

  const userMap = useMemo(() => Object.fromEntries(users.map((u) => [u.id, u])), [users]);

  const userStorageRows = useMemo(() => {
    if (!overview?.byUser) return [];
    return Object.entries(overview.byUser)
      .map(([userId, stats]) => ({
        userId,
        user: userMap[userId],
        ...stats,
      }))
      .sort((a, b) => b.bytes - a.bytes);
  }, [overview, userMap]);

  const folderRows = useMemo(() => {
    if (!overview?.byFolder) return [];
    return Object.entries(overview.byFolder)
      .map(([folder, stats]) => ({ folder, label: FOLDER_LABELS[folder] || folder, ...stats }))
      .sort((a, b) => b.bytes - a.bytes);
  }, [overview]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [ov, objs] = await Promise.all([
        getStorageOverview(),
        listStorageObjects({
          folder: filterFolder || undefined,
          userId: filterUserId || undefined,
          source: filterSource || undefined,
          orphanOnly: showOrphansOnly || undefined,
          limit: 200,
        }),
      ]);
      setOverview(ov);
      setObjects(Array.isArray(objs) ? objs : []);
    } catch (e) {
      setError(e.message || 'Failed to load storage data');
    } finally {
      setLoading(false);
    }
  }, [filterFolder, filterUserId, filterSource, showOrphansOnly]);

  useEffect(() => {
    if (isStorageAdminAvailable()) load();
  }, [load]);

  const handleScan = async () => {
    setScanning(true);
    setError('');
    setMessage('');
    try {
      const result = await scanStorageBucket();
      setMessage(
        `Scan complete — ${result.scanned} files indexed (${result.linked} linked, ${result.orphans} orphans).`
      );
      await load();
    } catch (e) {
      setError(e.message || 'Bucket scan failed. Deploy Cloud Functions first.');
    } finally {
      setScanning(false);
    }
  };

  const handleCleanOrphans = async () => {
    const ok = await confirm({
      title: 'Clean orphan files',
      message:
        'Delete all unlinked files from Firebase Storage? Linked course/resource/event/MBW files will be kept.',
      confirmLabel: 'Clean orphans',
      variant: 'danger',
    });
    if (!ok) return;

    setCleaning(true);
    setError('');
    setMessage('');
    try {
      const result = await cleanOrphanFiles();
      setMessage(`Removed ${result.deleted} orphan file(s), freed ${result.freedBytesLabel}.`);
      setSelectedPaths(new Set());
      await load();
    } catch (e) {
      setError(e.message || 'Orphan cleanup failed');
    } finally {
      setCleaning(false);
    }
  };

  const handleDeleteSelected = async () => {
    const paths = [...selectedPaths];
    if (paths.length === 0) return;

    const ok = await confirm({
      title: 'Delete selected files',
      message: `Permanently delete ${paths.length} file(s) from storage and unlink from Firestore records?`,
      confirmLabel: 'Delete',
      variant: 'danger',
    });
    if (!ok) return;

    setDeleting(true);
    setError('');
    setMessage('');
    try {
      const result = await deleteStorageObjects(paths);
      setMessage(`Deleted ${result.deleted} file(s).`);
      setSelectedPaths(new Set());
      await load();
    } catch (e) {
      setError(e.message || 'Delete failed');
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteUserStorage = async (userId) => {
    const u = userMap[userId];
    const ok = await confirm({
      title: 'Delete user storage',
      message: `Remove all MBW uploads for ${userLabel(u)}? Files are deleted from storage and submission records are cleared.`,
      confirmLabel: 'Delete all',
      variant: 'danger',
    });
    if (!ok) return;

    setDeleting(true);
    setError('');
    setMessage('');
    try {
      const result = await deleteUserStorage(userId);
      setMessage(`Removed ${result.deleted} file(s) for ${userLabel(u)} (${result.freedBytesLabel} freed).`);
      await load();
    } catch (e) {
      setError(e.message || 'User storage delete failed');
    } finally {
      setDeleting(false);
    }
  };

  const toggleSelect = (path) => {
    setSelectedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedPaths.size === objects.length) {
      setSelectedPaths(new Set());
    } else {
      setSelectedPaths(new Set(objects.map((o) => o.path)));
    }
  };

  if (!isStorageAdminAvailable()) {
    return (
      <section className="admin-section">
        <div className="alert alert-warning">Firebase is not configured. Add your Firebase keys to enable storage management.</div>
      </section>
    );
  }

  return (
    <section className="admin-section">
      <ConfirmDialog {...dialogProps} />

      <div className="section-header">
        <h2>
          <HardDrive size={20} strokeWidth={2} style={{ verticalAlign: 'middle', marginRight: 8 }} />
          Storage management
        </h2>
        <p className="page-sub">
          Monitor overall LMS storage, per-user usage, and clean up orphaned files. Run a bucket scan to index
          existing files and link them to courses, resources, events, and MBW submissions.
        </p>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}
      {message && <div className="alert alert-success">{message}</div>}

      <div className="admin-actions-row" style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <button type="button" className="btn btn-primary btn-sm" onClick={load} disabled={loading}>
          <RefreshCw size={14} style={{ marginRight: 4, verticalAlign: 'middle' }} />
          Refresh
        </button>
        <button type="button" className="btn btn-outline btn-sm" onClick={handleScan} disabled={scanning}>
          <ScanSearch size={14} style={{ marginRight: 4, verticalAlign: 'middle' }} />
          {scanning ? 'Scanning bucket…' : 'Scan & index bucket'}
        </button>
        <button type="button" className="btn btn-outline btn-sm" onClick={handleCleanOrphans} disabled={cleaning}>
          <Trash2 size={14} style={{ marginRight: 4, verticalAlign: 'middle' }} />
          {cleaning ? 'Cleaning…' : 'Clean orphan files'}
        </button>
        {selectedPaths.size > 0 && (
          <button type="button" className="btn btn-danger btn-sm" onClick={handleDeleteSelected} disabled={deleting}>
            Delete selected ({selectedPaths.size})
          </button>
        )}
      </div>

      {loading && !overview ? (
        <p className="muted">Loading storage data…</p>
      ) : (
        <>
          <div className="admin-stats-grid" style={{ marginBottom: '1.5rem' }}>
            <div className="stat-card stat-card--blue">
              <span className="stat-card__icon">
                <HardDrive size={22} />
              </span>
              <div>
                <span className="stat-card__value">{overview?.totalBytesLabel || formatStorageBytes(0)}</span>
                <span className="stat-card__label">Total storage</span>
              </div>
            </div>
            <div className="stat-card stat-card--indigo">
              <span className="stat-card__icon">
                <Filter size={22} />
              </span>
              <div>
                <span className="stat-card__value">{overview?.totalFiles ?? 0}</span>
                <span className="stat-card__label">Indexed files</span>
              </div>
            </div>
            <div className="stat-card stat-card--amber">
              <span className="stat-card__icon">
                <AlertTriangle size={22} />
              </span>
              <div>
                <span className="stat-card__value">{overview?.orphanCount ?? 0}</span>
                <span className="stat-card__label">Orphan files ({overview?.orphanBytesLabel || '0 B'})</span>
              </div>
            </div>
          </div>

          <div className="card card-pad" style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ marginTop: 0 }}>Storage by folder</h3>
            {folderRows.length === 0 ? (
              <p className="muted">No indexed files yet. Run &quot;Scan &amp; index bucket&quot; to populate.</p>
            ) : (
              <ul className="admin-list admin-list--compact">
                {folderRows.map((row) => (
                  <li key={row.folder}>
                    <div className="admin-list__content">
                      <strong>{row.label}</strong>
                      <p className="admin-list__meta muted">
                        {row.count} file{row.count !== 1 ? 's' : ''} · {formatStorageBytes(row.bytes)}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline"
                      onClick={() => {
                        setFilterFolder(row.folder);
                        setShowOrphansOnly(false);
                      }}
                    >
                      View
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="card card-pad" style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ marginTop: 0 }}>Per-user storage (MBW uploads)</h3>
            {userStorageRows.length === 0 ? (
              <p className="muted">No learner uploads indexed yet.</p>
            ) : (
              <ul className="admin-list admin-list--compact">
                {userStorageRows.map((row) => (
                  <li key={row.userId}>
                    <div className="admin-list__content">
                      <strong>{userLabel(row.user)}</strong>
                      <p className="admin-list__meta muted">
                        {row.count} file{row.count !== 1 ? 's' : ''} · {formatStorageBytes(row.bytes)}
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: '0.35rem' }}>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline"
                        onClick={() => {
                          setFilterUserId(row.userId);
                          setFilterFolder('mbw');
                        }}
                      >
                        View files
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-danger"
                        onClick={() => handleDeleteUserStorage(row.userId)}
                        disabled={deleting}
                        title="Delete all MBW files for this user"
                      >
                        <UserX size={14} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="card card-pad">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0 }}>File registry</h3>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <select
                  value={filterFolder}
                  onChange={(e) => setFilterFolder(e.target.value)}
                  className="btn btn-sm btn-outline"
                  style={{ padding: '0.35rem 0.6rem' }}
                >
                  <option value="">All folders</option>
                  {Object.entries(FOLDER_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
                <select
                  value={filterUserId}
                  onChange={(e) => setFilterUserId(e.target.value)}
                  className="btn btn-sm btn-outline"
                  style={{ padding: '0.35rem 0.6rem', maxWidth: 180 }}
                >
                  <option value="">All users</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {userLabel(u)}
                    </option>
                  ))}
                </select>
                <select
                  value={filterSource}
                  onChange={(e) => setFilterSource(e.target.value)}
                  className="btn btn-sm btn-outline"
                  style={{ padding: '0.35rem 0.6rem' }}
                >
                  <option value="">All sources</option>
                  {Object.entries(SOURCE_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
                <label className="btn btn-sm btn-outline" style={{ cursor: 'pointer', margin: 0 }}>
                  <input
                    type="checkbox"
                    checked={showOrphansOnly}
                    onChange={(e) => setShowOrphansOnly(e.target.checked)}
                    style={{ marginRight: 6 }}
                  />
                  Orphans only
                </label>
              </div>
            </div>

            {objects.length === 0 ? (
              <p className="muted">No files match filters. Run a bucket scan if the registry is empty.</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="admin-table" style={{ width: '100%', fontSize: '0.875rem' }}>
                  <thead>
                    <tr>
                      <th>
                        <input
                          type="checkbox"
                          checked={selectedPaths.size === objects.length && objects.length > 0}
                          onChange={toggleSelectAll}
                          aria-label="Select all"
                        />
                      </th>
                      <th>File</th>
                      <th>Size</th>
                      <th>Folder</th>
                      <th>Source</th>
                      <th>User</th>
                      <th>Status</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {objects.map((obj) => (
                      <tr key={obj.path}>
                        <td>
                          <input
                            type="checkbox"
                            checked={selectedPaths.has(obj.path)}
                            onChange={() => toggleSelect(obj.path)}
                            aria-label={`Select ${obj.fileName}`}
                          />
                        </td>
                        <td>
                          <strong>{obj.fileName || obj.path}</strong>
                          <br />
                          <span className="muted" style={{ fontSize: '0.75rem', wordBreak: 'break-all' }}>
                            {obj.path}
                          </span>
                        </td>
                        <td>{formatStorageBytes(obj.sizeBytes)}</td>
                        <td>{FOLDER_LABELS[obj.folder] || obj.folder}</td>
                        <td>
                          {SOURCE_LABELS[obj.source] || obj.source}
                          {obj.sourceLabel && (
                            <>
                              <br />
                              <span className="muted" style={{ fontSize: '0.75rem' }}>
                                {obj.sourceLabel}
                              </span>
                            </>
                          )}
                        </td>
                        <td>{obj.uploadedBy ? userLabel(userMap[obj.uploadedBy]) : '—'}</td>
                        <td>
                          {obj.linked ? (
                            <span className="badge badge--soft">Linked</span>
                          ) : (
                            <span className="badge badge-alert">Orphan</span>
                          )}
                        </td>
                        <td>
                          {obj.url && (
                            <a href={obj.url} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-outline" title="Open file">
                              <ExternalLink size={14} />
                            </a>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
