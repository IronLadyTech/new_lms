import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useProgramAdapter } from '../../hooks/useProgramAdapter';
import { useCxData } from '../../hooks/useCxData';
import { getProgramLabel } from '../../data/programTypes';
import { createGroup } from '../../services/groupService';

export default function CXBatches() {
  const { user } = useAuth();
  const { program, adapter } = useProgramAdapter();
  const { batches, loading, error, refresh } = useCxData(program, adapter);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

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
      });
      setName('');
      setDescription('');
      await refresh();
    } catch (err) {
      console.error(err);
      setFormError(err.message || 'Could not create batch');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page cx-page">
      <h1>Batches</h1>
      <p className="page-sub">{getProgramLabel(program)} · create or open a batch</p>

      {error && <p className="cx-error">{error}</p>}

      <section className="cx-section">
        <div className="cx-section__head">
          <h2>Create batch</h2>
        </div>
        <form className="cx-form" onSubmit={handleCreate}>
          <input
            type="text"
            placeholder="Batch name (e.g. MBW June 2026)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <input
            type="text"
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <div className="cx-form__row">
            <span className="cx-program-badge">{adapter.shortLabel}</span>
            <button type="submit" className="btn btn-primary btn-sm" disabled={saving || !name.trim()}>
              {saving ? 'Creating…' : 'Create batch'}
            </button>
          </div>
          {formError && <p className="cx-error">{formError}</p>}
        </form>
      </section>

      <section className="cx-section">
        <div className="cx-section__head">
          <h2>All batches</h2>
          <button type="button" className="btn btn-outline btn-sm" onClick={refresh}>
            Refresh
          </button>
        </div>
        {loading ? (
          <p className="muted">Loading…</p>
        ) : batches.length === 0 ? (
          <p className="muted">No {adapter.shortLabel} batches yet.</p>
        ) : (
          <ul className="cx-batch-list">
            {batches.map((b) => (
              <li key={b.id}>
                <Link to={`/cx/batches/${b.id}`} className="cx-batch-row">
                  <span className="cx-batch-row__name">{b.name}</span>
                  {b.description && <span className="cx-batch-row__desc muted">{b.description}</span>}
                  <span className="cx-batch-row__count">
                    {(b.memberIds || []).length} in batch
                  </span>
                  <span className="cx-batch-row__hint muted">Manage members →</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
