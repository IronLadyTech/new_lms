import { Video, ExternalLink } from 'lucide-react';
import {
  getBatchRecordingPhases,
  getRecordingPhaseTitle,
  RECORDING_PHASE_OTHER,
} from '../../data/batchRecordingPhases';
import {
  getBatchRecordingSessions,
  getSessionTitle,
  sortRecordingsBySessionOrder,
} from '../../utils/batchRecordingSessions';

/**
 * Learner-facing batch session recordings (added by CX), grouped by phase and session.
 * Read-only. Renders nothing when the batch has no recordings.
 */
export default function CourseRecordingsPanel({ recordings = [], program }) {
  if (!recordings.length) return null;

  const phases = getBatchRecordingPhases(program);
  const sorted = [...recordings].sort((a, b) =>
    (b.date || b.addedAt || '').localeCompare(a.date || a.addedAt || '')
  );

  const byPhase = Object.fromEntries(phases.map((p) => [p.id, []]));
  const other = [];
  sorted.forEach((rec) => {
    if (rec.phaseId && byPhase[rec.phaseId]) byPhase[rec.phaseId].push(rec);
    else other.push(rec);
  });

  const blocks = [
    ...phases
      .map((p) => ({
        ...p,
        items: sortRecordingsBySessionOrder(byPhase[p.id], program, p.id),
        sessions: getBatchRecordingSessions(program, p.id),
      }))
      .filter((p) => p.items.length > 0),
    ...(other.length ? [{ ...RECORDING_PHASE_OTHER, items: other, sessions: [] }] : []),
  ];

  const displayTitle = (rec, sessions) => {
    const session = sessions.find((s) => s.id === rec.sessionId);
    return session?.title || rec.title || getSessionTitle(program, rec.sessionId);
  };

  const displayWeek = (rec, sessions) => {
    const session = sessions.find((s) => s.id === rec.sessionId);
    return session?.week || '';
  };

  return (
    <section className="section course-recordings" aria-labelledby="course-recordings-title">
      <h2 id="course-recordings-title" className="home-section-title">
        Session recordings
      </h2>
      <p className="page-sub">Catch up on live sessions from your batch</p>

      <div className="course-recordings__phases">
        {blocks.map((phase) => (
          <div key={phase.id} className="course-recordings__phase">
            <h3 className="course-recordings__phase-title">
              {phase.title || getRecordingPhaseTitle(program, phase.id)}
            </h3>
            <ul className="cx-recording-list">
              {phase.items.map((rec) => (
                <li key={rec.id} className="cx-recording-item">
                  <span className="cx-recording-item__icon" aria-hidden="true">
                    <Video size={18} />
                  </span>
                  <div className="cx-recording-item__body">
                    {displayWeek(rec, phase.sessions) && (
                      <span className="muted cx-recording-item__week">
                        {displayWeek(rec, phase.sessions)}
                      </span>
                    )}
                    <strong>{displayTitle(rec, phase.sessions)}</strong>
                    {rec.date && <span className="muted">{rec.date}</span>}
                  </div>
                  <a
                    href={rec.url}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-primary btn-sm cx-recording-watch"
                  >
                    <ExternalLink size={14} aria-hidden="true" />
                    Watch
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
