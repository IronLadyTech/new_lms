import { useMemo, useState } from 'react';
import { Video, ExternalLink, Trash2, Pencil, Plus, ChevronDown } from 'lucide-react';
import {
  addBatchRecording,
  updateBatchRecording,
  removeBatchRecording,
} from '../../services/groupService';
import { normalizeEventLink } from '../../utils/eventLinks';
import {
  getBatchRecordingPhases,
  RECORDING_PHASE_OTHER,
} from '../../data/batchRecordingPhases';
import ConfirmDialog from '../ConfirmDialog';
import { useConfirm } from '../../hooks/useConfirm';

const emptyForm = { title: '', url: '', date: '' };

/**
 * CX session recordings grouped by program phase.
 * CX pastes unlisted YouTube (or Drive/Zoom) links under the correct phase.
 */
export default function BatchRecordingsPanel({ batch, program, userId, onChange }) {
  const { confirm, dialogProps } = useConfirm();
  const phases = useMemo(() => getBatchRecordingPhases(program || batch?.program), [program, batch?.program]);

  const [openPhaseId, setOpenPhaseId] = useState(phases[0]?.id || null);
  const [addingPhaseId, setAddingPhaseId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const recordings = useMemo(
    () => [...(batch.recordings || [])].sort((a, b) =>
      (b.date || b.addedAt || '').localeCompare(a.date || a.addedAt || '')
    ),
    [batch.recordings]
  );

  const byPhase = useMemo(() => {
    const map = Object.fromEntries(phases.map((p) => [p.id, []]));
    const other = [];
    recordings.forEach((rec) => {
      if (rec.phaseId && map[rec.phaseId]) map[rec.phaseId].push(rec);
      else other.push(rec);
    });
    return { map, other };
  }, [recordings, phases]);

  const resetForm = () => {
    setForm(emptyForm);
    setAddingPhaseId(null);
    setEditingId(null);
    setError('');
  };

  const startAdd = (phaseId) => {
    setOpenPhaseId(phaseId);
    setAddingPhaseId(phaseId);
    setEditingId(null);
    setForm(emptyForm);
    setError('');
  };

  const startEdit = (rec) => {
    setOpenPhaseId(rec.phaseId || RECORDING_PHASE_OTHER.id);
    setEditingId(rec.id);
    setAddingPhaseId(null);
    setForm({
      title: rec.title || '',
      url: rec.url || '',
      date: rec.date || '',
    });
    setError('');
  };

  const handleSaveAdd = async (e, phaseId) => {
    e.preventDefault();
    if (!form.title.trim() || !form.url.trim()) return;
    setSaving(true);
    setError('');
    try {
      await addBatchRecording(batch.id, {
        title: form.title.trim(),
        url: normalizeEventLink(form.url.trim()),
        date: form.date,
        phaseId,
        addedBy: userId,
      });
      resetForm();
      onChange?.();
    } catch (err) {
      setError(err.message || 'Could not save the recording.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingId || !form.title.trim() || !form.url.trim()) return;
    setSaving(true);
    setError('');
    try {
      await updateBatchRecording(batch.id, editingId, {
        title: form.title.trim(),
        url: normalizeEventLink(form.url.trim()),
        date: form.date,
      });
      resetForm();
      onChange?.();
    } catch (err) {
      setError(err.message || 'Could not update the recording.');
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (rec) => {
    const ok = await confirm({
      title: 'Remove recording',
      message: `Remove “${rec.title}” from this batch?`,
      confirmLabel: 'Remove',
      variant: 'danger',
    });
    if (!ok) return;
    setError('');
    try {
      await removeBatchRecording(batch.id, rec);
      if (editingId === rec.id) resetForm();
      onChange?.();
    } catch (err) {
      setError(err.message || 'Could not remove the recording.');
    }
  };

  const renderForm = (onSubmit, submitLabel) => (
    <form className="cx-form cx-recording-phase__form" onSubmit={onSubmit}>
      <input
        type="text"
        placeholder="Session title (e.g. Orientation, Week 1 live)"
        value={form.title}
        onChange={(e) => setForm({ ...form, title: e.target.value })}
        required
        aria-label="Recording title"
      />
      <input
        type="url"
        placeholder="Unlisted YouTube / Drive / Zoom link (https://…)"
        value={form.url}
        onChange={(e) => setForm({ ...form, url: e.target.value })}
        required
        aria-label="Recording link"
      />
      <div className="cx-form__row">
        <input
          type="date"
          value={form.date}
          onChange={(e) => setForm({ ...form, date: e.target.value })}
          aria-label="Session date (optional)"
        />
        <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
          {saving ? 'Saving…' : submitLabel}
        </button>
        <button type="button" className="btn btn-outline btn-sm" onClick={resetForm} disabled={saving}>
          Cancel
        </button>
      </div>
    </form>
  );

  const renderRecordingRow = (rec) => {
    if (editingId === rec.id) {
      return (
        <li key={rec.id} className="cx-recording-item cx-recording-item--editing">
          {renderForm(handleSaveEdit, 'Save changes')}
        </li>
      );
    }

    return (
      <li key={rec.id} className="cx-recording-item">
        <span className="cx-recording-item__icon" aria-hidden="true">
          <Video size={18} />
        </span>
        <div className="cx-recording-item__body">
          <strong>{rec.title}</strong>
          {rec.date && <span className="muted">{rec.date}</span>}
        </div>
        <a
          href={rec.url}
          target="_blank"
          rel="noreferrer"
          className="btn btn-outline btn-sm cx-recording-watch"
        >
          <ExternalLink size={14} aria-hidden="true" />
          Open
        </a>
        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={() => startEdit(rec)}
          aria-label={`Edit ${rec.title}`}
        >
          <Pencil size={14} aria-hidden="true" />
          Edit
        </button>
        <button
          type="button"
          className="btn btn-sm cx-recording-remove"
          onClick={() => handleRemove(rec)}
          aria-label={`Remove ${rec.title}`}
        >
          <Trash2 size={14} aria-hidden="true" />
        </button>
      </li>
    );
  };

  const phaseBlocks = [
    ...phases.map((phase) => ({
      ...phase,
      items: byPhase.map[phase.id] || [],
    })),
    ...(byPhase.other.length
      ? [{ ...RECORDING_PHASE_OTHER, items: byPhase.other }]
      : []),
  ];

  return (
    <section className="cx-section">
      <div className="cx-section__head">
        <h2>Session recordings by phase</h2>
      </div>
      <p className="muted cx-recording-hint">
        Paste an unlisted YouTube (or Drive / Zoom) link under the correct phase for this batch.
        Only learners in this batch will see these videos.
      </p>

      {error && <p className="cx-error" role="alert">{error}</p>}

      <div className="cx-recording-phases">
        {phaseBlocks.map((phase) => {
          const isOpen = openPhaseId === phase.id;
          const count = phase.items.length;
          return (
            <div key={phase.id} className={`cx-recording-phase${isOpen ? ' is-open' : ''}`}>
              <button
                type="button"
                className="cx-recording-phase__toggle"
                aria-expanded={isOpen}
                onClick={() => setOpenPhaseId(isOpen ? null : phase.id)}
              >
                <span className="cx-recording-phase__meta">
                  <strong>{phase.title}</strong>
                  {phase.subtitle && <span className="muted">{phase.subtitle}</span>}
                </span>
                <span className="cx-recording-phase__count">{count}</span>
                <ChevronDown
                  size={18}
                  className={`cx-recording-phase__chevron${isOpen ? ' is-open' : ''}`}
                  aria-hidden
                />
              </button>

              {isOpen && (
                <div className="cx-recording-phase__body">
                  {phase.items.length === 0 && addingPhaseId !== phase.id && (
                    <p className="muted">No recordings in this phase yet.</p>
                  )}

                  {phase.items.length > 0 && (
                    <ul className="cx-recording-list">{phase.items.map(renderRecordingRow)}</ul>
                  )}

                  {addingPhaseId === phase.id ? (
                    renderForm((e) => handleSaveAdd(e, phase.id), 'Add recording')
                  ) : phase.id !== RECORDING_PHASE_OTHER.id ? (
                    <button
                      type="button"
                      className="btn btn-outline btn-sm cx-recording-phase__add"
                      onClick={() => startAdd(phase.id)}
                    >
                      <Plus size={16} aria-hidden="true" />
                      Add video link
                    </button>
                  ) : null}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <ConfirmDialog {...dialogProps} />
    </section>
  );
}
