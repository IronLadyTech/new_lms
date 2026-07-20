import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Layers, RefreshCw, Plus } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useProgramAdapter } from '../../hooks/useProgramAdapter';
import { useCxData } from '../../hooks/useCxData';
import { getProgramLabel } from '../../data/programTypes';
import { createGroup } from '../../services/groupService';
import PageHeader from '../../components/ui/PageHeader';
import DashboardSkeleton from '../../components/ui/DashboardSkeleton';

export default function CXBatches() {
  const { user } = useAuth();
  const { program, adapter } = useProgramAdapter();
  const { batches, students, loading, error, refresh } = useCxData(program, adapter);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setFormError('');
    try {
      await createGroup({
        name: name.trim(),
        description: description.trim(),
        program,
        createdBy: user?.uid,
        moderatorIds: user?.uid ? [user.uid] : [],
      });
      setName('');
      setDescription('');
      setShowCreate(false);
      await refresh();
    } catch (err) {
      console.error(err);
      setFormError(err.message || 'Could not create batch');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page cx-page cx-batches-page">
      <PageHeader
        eyebrow={getProgramLabel(program)}
        title="Participants"
        subtitle="Create batches, add learners, upload session videos, and track attendance."
        icon={Layers}
        actions={
          <>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={refresh}
              disabled={loading}
            >
              <RefreshCw size={14} aria-hidden />
              Refresh
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => setShowCreate((v) => !v)}
            >
              <Plus size={14} aria-hidden />
              {showCreate ? 'Cancel' : 'New batch'}
            </button>
          </>
        }
      />

      {error && (
        <p className="cx-error" role="alert">
          {error}
        </p>
      )}

      {showCreate && (
        <section className="cx-panel cx-panel--accent">
          <div className="cx-panel__head">
            <h2 className="cx-panel__title">Create batch</h2>
            <span className="cx-program-badge">{adapter.shortLabel}</span>
          </div>
          <div className="cx-panel__body">
            <form className="cx-form cx-form--grid" onSubmit={handleCreate}>
              <label className="field">
                <span className="field__label">Batch name</span>
                <input
                  type="text"
                  placeholder="e.g. MBW June 2026"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </label>
              <label className="field">
                <span className="field__label">Description (optional)</span>
                <input
                  type="text"
                  placeholder="Cohort notes"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </label>
              <div className="cx-form__actions">
                <button type="submit" className="btn btn-primary btn-sm" disabled={saving || !name.trim()}>
                  {saving ? 'Creating…' : 'Create batch'}
                </button>
              </div>
              {formError && (
                <p className="cx-error" role="alert">
                  {formError}
                </p>
              )}
            </form>
          </div>
        </section>
      )}

      <section className="cx-panel">
        <div className="cx-panel__head">
          <h2 className="cx-panel__title">All batches</h2>
          <span className="muted cx-panel__meta">
            {students.length} participant{students.length === 1 ? '' : 's'} · {batches.length} batch
            {batches.length === 1 ? '' : 'es'}
          </span>
        </div>
        <div className="cx-panel__body">
          {loading ? (
            <DashboardSkeleton rows={4} />
          ) : batches.length === 0 ? (
            <div className="cx-work-queue__empty">
              <p className="cx-work-queue__empty-title">No batches yet</p>
              <p className="muted cx-work-queue__empty-msg">
                Create your first batch to organize learners and track attendance.
              </p>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>
                <Plus size={14} aria-hidden />
                Create batch
              </button>
            </div>
          ) : (
            <div className="cx-batch-table-wrap">
              <table className="cx-data-table cx-data-table--interactive">
                <thead>
                  <tr>
                    <th scope="col">Batch</th>
                    <th scope="col">Description</th>
                    <th scope="col">Members</th>
                    <th scope="col" />
                  </tr>
                </thead>
                <tbody>
                  {batches.map((b) => (
                    <tr key={b.id}>
                      <td>
                        <Link to={`/cx/batches/${b.id}`} className="cx-data-table__link">
                          {b.name}
                        </Link>
                      </td>
                      <td className="muted">{b.description || '—'}</td>
                      <td>{(b.memberIds || []).length}</td>
                      <td className="cx-data-table__actions-cell">
                        <Link to={`/cx/batches/${b.id}`} className="btn btn-outline btn-sm">
                          Manage →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
