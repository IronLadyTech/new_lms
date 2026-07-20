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
import {
  findRecordingForSession,
  getBatchRecordingSessions,
  getSessionTitle,
  hasProgramRecordingSessions,
  sortRecordingsBySessionOrder,
} from '../../utils/batchRecordingSessions';
import ConfirmDialog from '../ConfirmDialog';
import { useConfirm } from '../../hooks/useConfirm';

const emptyForm = { sessionId: '', title: '', url: '', date: '' };

/**
 * CX session recordings grouped by program phase and session.
 * CX pastes unlisted YouTube (or Drive/Zoom) links under the correct session.
 */
export default function BatchRecordingsPanel({ batch, program, userId, onChange }) {
  const { confirm, dialogProps } = useConfirm();
  const resolvedProgram = program || batch?.program;
  const phases = useMemo(() => getBatchRecordingPhases(resolvedProgram), [resolvedProgram]);
  const useSessionSlots = hasProgramRecordingSessions(resolvedProgram);

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
    Object.keys(map).forEach((phaseId) => {
      map[phaseId] = sortRecordingsBySessionOrder(map[phaseId], resolvedProgram, phaseId);
    });
    return { map, other };
  }, [recordings, phases, resolvedProgram]);

  const resetForm = () => {
    setForm(emptyForm);
    setAddingPhaseId(null);
    setEditingId(null);
    setError('');
  };

  const startAdd = (phaseId, sessionId = '') => {
    setOpenPhaseId(phaseId);
    setAddingPhaseId(phaseId);
    setEditingId(null);
    setForm({
      ...emptyForm,
      sessionId,
      title: sessionId ? getSessionTitle(resolvedProgram, sessionId) : '',
    });
    setError('');
  };

  const startEdit = (rec) => {
    setOpenPhaseId(rec.phaseId || RECORDING_PHASE_OTHER.id);
    setEditingId(rec.id);
    setAddingPhaseId(null);
    setForm({
      sessionId: rec.sessionId || '',
      title: rec.title || getSessionTitle(resolvedProgram, rec.sessionId) || '',
      url: rec.url || '',
      date: rec.date || '',
    });
    setError('');
  };

  const resolveTitle = (phaseId, sessionId, fallbackTitle) => {
    if (sessionId) return getSessionTitle(resolvedProgram, sessionId) || fallbackTitle.trim();
    return fallbackTitle.trim();
  };

  const confirmReplaceIfNeeded = async (phaseId, sessionId, editingId) => {
    if (!sessionId) return true;
    const existing = findRecordingForSession(recordings, phaseId, sessionId);
    if (!existing || existing.id === editingId) return true;

    return confirm({
      title: 'Replace existing video?',
      message: 'A video already exists for this session. Are you sure you want to replace it?',
      confirmLabel: 'Replace',
      cancelLabel: 'Cancel',
      variant: 'primary',
    });
  };

  const handleSaveAdd = async (e, phaseId) => {
    e.preventDefault();
    if (!form.url.trim()) return;
    if (useSessionSlots && !form.sessionId) {
      setError('Select a session for this recording.');
      return;
    }
    if (!useSessionSlots && !form.title.trim()) return;

    const title = resolveTitle(phaseId, form.sessionId, form.title);
    if (!title) {
      setError('Enter a session title.');
      return;
    }

    const existing = form.sessionId
      ? findRecordingForSession(recordings, phaseId, form.sessionId)
      : null;

    if (existing) {
      const ok = await confirmReplaceIfNeeded(phaseId, form.sessionId, null);
      if (!ok) return;

      setSaving(true);
      setError('');
      try {
        await updateBatchRecording(batch.id, existing.id, {
          title,
          url: normalizeEventLink(form.url.trim()),
          date: form.date,
          sessionId: form.sessionId,
        });
        resetForm();
        onChange?.();
      } catch (err) {
        setError(err.message || 'Could not replace the recording.');
      } finally {
        setSaving(false);
      }
      return;
    }

    setSaving(true);
    setError('');
    try {
      await addBatchRecording(batch.id, {
        title,
        url: normalizeEventLink(form.url.trim()),
        date: form.date,
        phaseId,
        sessionId: form.sessionId,
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
    if (!editingId || !form.url.trim()) return;
    if (useSessionSlots && !form.sessionId) {
      setError('Select a session for this recording.');
      return;
    }
    if (!useSessionSlots && !form.title.trim()) return;

    const rec = recordings.find((r) => r.id === editingId);
    const phaseId = rec?.phaseId || addingPhaseId;
    const title = resolveTitle(phaseId, form.sessionId, form.title);

    if (form.sessionId && form.sessionId !== rec?.sessionId) {
      const ok = await confirmReplaceIfNeeded(phaseId, form.sessionId, editingId);
      if (!ok) return;

      const existing = findRecordingForSession(recordings, phaseId, form.sessionId);
      if (existing && existing.id !== editingId) {
        setSaving(true);
        setError('');
        try {
          await updateBatchRecording(batch.id, existing.id, {
            title,
            url: normalizeEventLink(form.url.trim()),
            date: form.date,
            sessionId: form.sessionId,
          });
          await removeBatchRecording(batch.id, rec);
          resetForm();
          onChange?.();
        } catch (err) {
          setError(err.message || 'Could not replace the recording.');
        } finally {
          setSaving(false);
        }
        return;
      }
    }

    setSaving(true);
    setError('');
    try {
      await updateBatchRecording(batch.id, editingId, {
        title,
        url: normalizeEventLink(form.url.trim()),
        date: form.date,
        sessionId: form.sessionId,
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
    const displayTitle = rec.title || getSessionTitle(resolvedProgram, rec.sessionId) || 'Recording';
    const ok = await confirm({
      title: 'Remove recording',
      message: `Remove “${displayTitle}” from this batch?`,
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

  const renderSessionSelect = (phaseId) => {
    const sessions = getBatchRecordingSessions(resolvedProgram, phaseId);
    if (!sessions.length) return null;

    return (
      <label className="field cx-recording-phase__session-field">
        <span className="field__label">Session</span>
        <select
          value={form.sessionId}
          onChange={(e) => {
            const sessionId = e.target.value;
            setForm({
              ...form,
              sessionId,
              title: getSessionTitle(resolvedProgram, sessionId),
            });
          }}
          required
          aria-label="Session"
        >
          <option value="">Select a session…</option>
          {sessions.map((session) => {
            const taken = findRecordingForSession(recordings, phaseId, session.id);
            const isEditingThis = editingId && taken?.id === editingId;
            const suffix = taken && !isEditingThis ? ' (has video)' : '';
            return (
              <option key={session.id} value={session.id}>
                {session.week ? `${session.week} — ` : ''}{session.title}{suffix}
              </option>
            );
          })}
        </select>
      </label>
    );
  };

  const renderForm = (onSubmit, submitLabel, phaseId) => (
    <form className="cx-form cx-recording-phase__form" onSubmit={onSubmit}>
      {useSessionSlots ? (
        renderSessionSelect(phaseId)
      ) : (
        <input
          type="text"
          placeholder="Session title (e.g. Orientation, Week 1 live)"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          required
          aria-label="Recording title"
        />
      )}
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

  const renderRecordingRow = (rec, sessionMeta) => {
    const displayTitle =
      sessionMeta?.title || rec.title || getSessionTitle(resolvedProgram, rec.sessionId);
    const weekLabel = sessionMeta?.week;

    if (editingId === rec.id) {
      return (
        <li key={rec.id} className="cx-recording-item cx-recording-item--editing">
          {renderForm(handleSaveEdit, 'Save changes', rec.phaseId)}
        </li>
      );
    }

    return (
      <li key={rec.id} className="cx-recording-item">
        <span className="cx-recording-item__icon" aria-hidden="true">
          <Video size={18} />
        </span>
        <div className="cx-recording-item__body">
          {weekLabel && <span className="muted cx-recording-item__week">{weekLabel}</span>}
          <strong>{displayTitle}</strong>
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
          aria-label={`Edit ${displayTitle}`}
        >
          <Pencil size={14} aria-hidden="true" />
          Edit
        </button>
        <button
          type="button"
          className="btn btn-sm cx-recording-remove"
          onClick={() => handleRemove(rec)}
          aria-label={`Remove ${displayTitle}`}
        >
          <Trash2 size={14} aria-hidden="true" />
        </button>
      </li>
    );
  };

  const renderSessionSlot = (phaseId, session) => {
    const rec = findRecordingForSession(recordings, phaseId, session.id);
    if (rec) return renderRecordingRow(rec, session);

    if (addingPhaseId === phaseId && form.sessionId === session.id) {
      return (
        <li key={session.id} className="cx-recording-item cx-recording-item--editing">
          {renderForm((e) => handleSaveAdd(e, phaseId), 'Add recording', phaseId)}
        </li>
      );
    }

    return (
      <li key={session.id} className="cx-recording-item cx-recording-item--empty">
        <span className="cx-recording-item__icon" aria-hidden="true">
          <Video size={18} />
        </span>
        <div className="cx-recording-item__body">
          {session.week && <span className="muted cx-recording-item__week">{session.week}</span>}
          <strong>{session.title}</strong>
          <span className="muted">No recording yet</span>
        </div>
        <button
          type="button"
          className="btn btn-outline btn-sm cx-recording-phase__add"
          onClick={() => startAdd(phaseId, session.id)}
        >
          <Plus size={14} aria-hidden="true" />
          Add video link
        </button>
      </li>
    );
  };

  const countUploadedInPhase = (phaseId, items) => {
    if (!useSessionSlots) return items.length;
    const sessions = getBatchRecordingSessions(resolvedProgram, phaseId);
    if (!sessions.length) return items.length;
    const uploaded = sessions.filter((s) =>
      findRecordingForSession(recordings, phaseId, s.id)
    ).length;
    return `${uploaded}/${sessions.length}`;
  };

  const renderPhaseBody = (phase) => {
    const sessions = useSessionSlots ? getBatchRecordingSessions(resolvedProgram, phase.id) : [];
    const legacyItems = (byPhase.map[phase.id] || []).filter((rec) => !rec.sessionId);

    if (sessions.length > 0) {
      return (
        <div className="cx-recording-phase__body">
          <ul className="cx-recording-list">
            {sessions.map((session) => renderSessionSlot(phase.id, session))}
          </ul>

          {legacyItems.length > 0 && (
            <>
              <p className="muted cx-recording-legacy-label">Other recordings in this phase</p>
              <ul className="cx-recording-list">
                {legacyItems.map((rec) => renderRecordingRow(rec))}
              </ul>
            </>
          )}

          {addingPhaseId === phase.id && !form.sessionId && (
            renderForm((e) => handleSaveAdd(e, phase.id), 'Add recording', phase.id)
          )}
        </div>
      );
    }

    const items = byPhase.map[phase.id] || [];
    return (
      <div className="cx-recording-phase__body">
        {items.length === 0 && addingPhaseId !== phase.id && (
          <p className="muted">No recordings in this phase yet.</p>
        )}

        {items.length > 0 && (
          <ul className="cx-recording-list">{items.map((rec) => renderRecordingRow(rec))}</ul>
        )}

        {addingPhaseId === phase.id ? (
          renderForm((e) => handleSaveAdd(e, phase.id), 'Add recording', phase.id)
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
        {useSessionSlots
          ? 'Paste an unlisted YouTube (or Drive / Zoom) link under the correct session within each phase. Only learners in this batch will see these videos.'
          : 'Paste an unlisted YouTube (or Drive / Zoom) link under the correct phase for this batch. Only learners in this batch will see these videos.'}
      </p>

      {error && <p className="cx-error" role="alert">{error}</p>}

      <div className="cx-recording-phases">
        {phaseBlocks.map((phase) => {
          const isOpen = openPhaseId === phase.id;
          const count = countUploadedInPhase(phase.id, phase.items);
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

              {isOpen && renderPhaseBody(phase)}
            </div>
          );
        })}
      </div>

      <ConfirmDialog {...dialogProps} />
    </section>
  );
}
