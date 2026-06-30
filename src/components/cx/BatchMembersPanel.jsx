import { useMemo, useState } from 'react';
import {
  addMemberToGroup,
  moveMemberToGroup,
  removeMemberFromGroup,
  updateGroup,
  deleteGroup,
} from '../../services/groupService';
import { isProgramLearner, studentsInBatch } from '../../utils/batchScope';
import { isFullAdmin } from '../../utils/roles';

export default function BatchMembersPanel({
  batch,
  batches = [],
  users = [],
  program,
  role,
  onUpdated,
  onDeleted,
}) {
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(batch?.name || '');
  const [editDesc, setEditDesc] = useState(batch?.description || '');

  const members = useMemo(() => studentsInBatch(batch, users), [batch, users]);

  const memberIdSet = useMemo(() => new Set(batch?.memberIds || []), [batch]);

  const addableLearners = useMemo(
    () =>
      (users || []).filter(
        (u) => isProgramLearner(u, program) && !memberIdSet.has(u.id) && u.batchId !== batch?.id
      ),
    [users, program, memberIdSet, batch?.id]
  );

  const otherBatches = useMemo(
    () => batches.filter((b) => b.id !== batch?.id),
    [batches, batch?.id]
  );

  const run = async (key, fn) => {
    setBusy(key);
    setError('');
    try {
      await fn();
      await onUpdated?.();
    } catch (e) {
      console.error(e);
      setError(e.message || 'Action failed');
    } finally {
      setBusy('');
    }
  };

  const handleSaveMeta = async (e) => {
    e.preventDefault();
    if (!editName.trim()) return;
    await run('save', () =>
      updateGroup(batch.id, { name: editName.trim(), description: editDesc.trim() })
    );
    setEditing(false);
  };

  if (!batch) return null;

  return (
    <section className="cx-section cx-batch-members">
      <div className="cx-section__head">
        <h2>Manage batch</h2>
      </div>

      {error && <p className="cx-error">{error}</p>}

      {editing ? (
        <form className="cx-form" onSubmit={handleSaveMeta}>
          <input
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            placeholder="Batch name"
            required
          />
          <input
            type="text"
            value={editDesc}
            onChange={(e) => setEditDesc(e.target.value)}
            placeholder="Description (optional)"
          />
          <div className="cx-form__row">
            <button type="submit" className="btn btn-primary btn-sm" disabled={busy === 'save'}>
              {busy === 'save' ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => {
                setEditing(false);
                setEditName(batch.name || '');
                setEditDesc(batch.description || '');
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="cx-batch-members__meta">
          <p className="muted">{batch.description || 'No description'}</p>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => setEditing(true)}>
            Edit name / description
          </button>
        </div>
      )}

      <div className="cx-batch-members__toolbar">
        <label className="cx-board__filter">
          Add learner{' '}
          <select
            defaultValue=""
            disabled={!!busy || addableLearners.length === 0}
            onChange={(e) => {
              const uid = e.target.value;
              if (!uid) return;
              run(`add-${uid}`, () => addMemberToGroup(batch.id, uid));
              e.target.value = '';
            }}
          >
            <option value="">
              {addableLearners.length === 0 ? 'No learners available' : 'Select learner…'}
            </option>
            {addableLearners.map((u) => (
              <option key={u.id} value={u.id}>
                {u.displayName || u.email}
                {u.batchName ? ` (from ${u.batchName})` : ''}
              </option>
            ))}
          </select>
        </label>
      </div>

      {members.length === 0 ? (
        <p className="muted">No learners in this batch yet. Add learners above.</p>
      ) : (
        <ul className="cx-batch-members__list">
          {members.map((m) => (
            <li key={m.id} className="cx-batch-members__row">
              <div>
                <strong>{m.displayName || m.email}</strong>
                <span className="muted cx-batch-members__email">{m.email}</span>
              </div>
              <div className="cx-batch-members__actions">
                {otherBatches.length > 0 && (
                  <select
                    className="cx-batch-members__move"
                    defaultValue=""
                    disabled={!!busy}
                    title="Move to another batch"
                    onChange={(e) => {
                      const targetId = e.target.value;
                      if (!targetId) return;
                      run(`move-${m.id}`, () => moveMemberToGroup(m.id, targetId));
                      e.target.value = '';
                    }}
                  >
                    <option value="">Move to…</option>
                    {otherBatches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                )}
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  disabled={!!busy}
                  onClick={() =>
                    run(`remove-${m.id}`, () => removeMemberFromGroup(batch.id, m.id))
                  }
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {isFullAdmin(role) && (
        <div className="cx-batch-members__danger">
          <button
            type="button"
            className="btn btn-danger btn-sm"
            disabled={!!busy}
            onClick={() => {
              if (!window.confirm(`Delete batch "${batch.name}"? Learners will be unlinked.`)) return;
              run('delete', async () => {
                await deleteGroup(batch.id);
                onDeleted?.();
              });
            }}
          >
            Delete batch
          </button>
        </div>
      )}
    </section>
  );
}
