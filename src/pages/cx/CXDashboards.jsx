import { useEffect, useMemo, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  RefreshCw,
  Layers,
  Users,
  ClipboardCheck,
  BarChart3,
  Activity,
  Video,
  CalendarCheck,
} from 'lucide-react';
import { useProgramAdapter } from '../../hooks/useProgramAdapter';
import { useCxData } from '../../hooks/useCxData';
import { getProgramLabel } from '../../data/programTypes';
import { resolveCxDrilldown, buildTaskStatusChartData } from '../../utils/cxDrilldown';
import {
  filterStudentsForBatches,
  studentsInBatch,
  countBatchAssignedLearners,
} from '../../utils/batchScope';
import { buildModuleTaskBreakdown, countCompletedCells } from '../../utils/cxMetrics';
import {
  countActiveParticipants,
  countPendingReviews,
  countAwaitingResubmit,
  computeRecordingCoverage,
  buildRecentActivity,
  aggregateAttendanceStats,
} from '../../utils/cxAnalytics';
import { getBatchAttendanceSummary } from '../../services/attendanceService';
import { getTodayKey, addDaysToKey } from '../../utils/streakTimezone';
import ParticipantListModal from '../../components/cx/ParticipantListModal';
import CxOverviewDashboard from '../../components/cx/CxOverviewDashboard';
import {
  buildBatchStatusChart,
  buildPaymentStatusChart,
  buildActiveStatusChart,
  buildEnrollmentAssignmentChart,
} from '../../utils/cxCrmDashboard';
import CxCharts from '../../components/cx/CxCharts';
import CxKpiStrip from '../../components/cx/CxKpiStrip';
import CxActivityFeed, { CxActivityFeedFooter } from '../../components/cx/CxActivityFeed';
import CxProgramEnrollmentBar from '../../components/cx/CxProgramEnrollmentBar';
import DashboardSkeleton from '../../components/ui/DashboardSkeleton';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'batches', label: 'By batch' },
  { id: 'tasks', label: 'By task' },
];

export default function CXDashboards() {
  const { program, adapter, canSwitchProgram } = useProgramAdapter();
  const { batches, users, students, activeTasks: tasks, submissions, loading, error, refresh } =
    useCxData(program, adapter);
  const [modal, setModal] = useState(null);
  const [taskBatchFilter, setTaskBatchFilter] = useState('all');
  const [activeTab, setActiveTab] = useState('overview');
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceStats, setAttendanceStats] = useState(null);

  const assignedLearnerCount = useMemo(
    () => countBatchAssignedLearners(students, batches, users),
    [students, batches, users]
  );
  const unassignedLearnerCount = Math.max(0, students.length - assignedLearnerCount);

  const active7 = useMemo(() => countActiveParticipants(students, 7), [students]);
  const active30 = useMemo(() => countActiveParticipants(students, 30), [students]);
  const pendingReviews = useMemo(() => countPendingReviews(submissions), [submissions]);
  const awaitingResubmit = useMemo(() => countAwaitingResubmit(submissions), [submissions]);
  const recordingStats = useMemo(
    () => computeRecordingCoverage(batches, program),
    [batches, program]
  );
  const recentActivity = useMemo(
    () => buildRecentActivity(students, submissions, 8),
    [students, submissions]
  );

  const stats = useMemo(() => {
    const completedCells = countCompletedCells(students, tasks, submissions);
    const possible = students.length * tasks.length;
    return {
      completed: completedCells,
      completionRate: possible ? Math.round((completedCells / possible) * 100) : 0,
    };
  }, [submissions, students, tasks]);

  useEffect(() => {
    const batchesWithCourses = batches.filter((b) => b.courseIds?.length);
    if (!batchesWithCourses.length) {
      setAttendanceStats(null);
      return undefined;
    }

    let cancelled = false;
    setAttendanceLoading(true);
    const today = getTodayKey();
    const start = addDaysToKey(today, -30);

    (async () => {
      try {
        const summaries = {};
        await Promise.all(
          batchesWithCourses.map(async (batch) => {
            const members = studentsInBatch(batch, users).map((m) => m.id);
            if (!members.length) return;
            summaries[batch.id] = await getBatchAttendanceSummary(
              members,
              batch.courseIds,
              start,
              today
            );
          })
        );
        if (!cancelled) setAttendanceStats(aggregateAttendanceStats(summaries));
      } catch {
        if (!cancelled) setAttendanceStats(null);
      } finally {
        if (!cancelled) setAttendanceLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [batches, users]);

  const perBatch = useMemo(
    () =>
      batches.map((b) => {
        const batchLearners = studentsInBatch(b, users);
        const batchSubs = submissions.filter((s) =>
          batchLearners.some((learner) => learner.id === s.userId)
        );
        const done = countCompletedCells(batchLearners, tasks, batchSubs);
        const possible = batchLearners.length * tasks.length;
        const recCount = (b.recordings || []).filter((r) => r.url).length;
        return {
          batch: b,
          learners: batchLearners.length,
          pct: possible ? Math.round((done / possible) * 100) : 0,
          recordings: recCount,
        };
      }),
    [batches, submissions, tasks, users]
  );

  const taskWiseStudents = useMemo(
    () => filterStudentsForBatches(students, batches, taskBatchFilter),
    [students, batches, taskBatchFilter]
  );

  const selectedBatchLabel = useMemo(() => {
    if (taskBatchFilter === 'all') return 'All batches';
    return batches.find((b) => b.id === taskBatchFilter)?.name || 'Selected batch';
  }, [taskBatchFilter, batches]);

  const perModuleBreakdown = useMemo(
    () => buildModuleTaskBreakdown(taskWiseStudents, tasks, submissions),
    [tasks, taskWiseStudents, submissions]
  );

  const overviewCharts = useMemo(
    () => ({
      batchStatus: buildBatchStatusChart(batches, users, tasks, submissions),
      paymentByMonth: buildPaymentStatusChart(students),
      activeStatus: buildActiveStatusChart(students),
      enrollmentAssignment: buildEnrollmentAssignmentChart(students, assignedLearnerCount),
    }),
    [batches, users, tasks, submissions, students, assignedLearnerCount]
  );

  const taskStatusData = useMemo(() => {
    if (!adapter.hasTasks) return [];
    return buildTaskStatusChartData(students, tasks, submissions);
  }, [adapter.hasTasks, tasks, students, submissions]);

  const batchCompletionData = useMemo(
    () => perBatch.map(({ batch, learners, pct }) => ({
      name: batch.name,
      batchId: batch.id,
      learners,
      pct,
    })),
    [perBatch]
  );

  const drillContext = useMemo(
    () => ({ batches, users, students, tasks, submissions, assignedLearnerCount }),
    [batches, users, students, tasks, submissions, assignedLearnerCount]
  );

  const handleDrill = useCallback(
    (descriptor) => {
      const result = resolveCxDrilldown(descriptor, drillContext);
      if (!result?.participants?.length) return;
      setModal({ title: result.title, participants: result.participants });
    },
    [drillContext]
  );

  const kpiItems = [
    {
      id: 'participants',
      label: 'Participants',
      value: students.length,
      icon: Users,
      to: '/cx/batches',
      hint: `${assignedLearnerCount} in batches`,
    },
    {
      id: 'active7',
      label: 'Active (7d)',
      value: active7,
      icon: Activity,
      hint: `${active30} active in 30d`,
    },
    {
      id: 'batches',
      label: 'Batches',
      value: batches.length,
      icon: Layers,
      to: '/cx/batches',
    },
    ...(adapter.hasTasks
      ? [
          {
            id: 'completion',
            label: 'Task completion',
            value: `${stats.completionRate}%`,
            icon: BarChart3,
          },
          {
            id: 'pending',
            label: 'Pending reviews',
            value: pendingReviews,
            icon: ClipboardCheck,
            to: '/cx/reviews',
            tone: pendingReviews > 0 ? 'warning' : undefined,
            badge: pendingReviews,
          },
          {
            id: 'resubmit',
            label: 'Awaiting resubmit',
            value: awaitingResubmit,
            icon: ClipboardCheck,
            to: '/cx/reviews',
            tone: awaitingResubmit > 0 ? 'warning' : undefined,
          },
        ]
      : []),
    {
      id: 'recordings',
      label: 'Session videos',
      value: recordingStats.expected
        ? `${recordingStats.pct}%`
        : recordingStats.uploaded,
      icon: Video,
      hint: recordingStats.expected
        ? `${recordingStats.uploaded}/${recordingStats.expected} uploaded`
        : `${recordingStats.uploaded} links`,
      to: batches[0] ? `/cx/batches/${batches[0].id}` : '/cx/batches',
    },
    ...(attendanceStats
      ? [
          {
            id: 'attendance',
            label: 'Avg attendance',
            value: attendanceStats.avgPct != null ? `${attendanceStats.avgPct}%` : '—',
            icon: CalendarCheck,
            hint:
              attendanceStats.atRisk > 0
                ? `${attendanceStats.atRisk} at risk (<60%)`
                : `${attendanceStats.tracked} tracked`,
          },
        ]
      : []),
  ];

  return (
    <div className="page cx-page cx-analytics-page">
      <header className="cx-analytics-hero">
        <div className="cx-analytics-hero__text">
          <p className="cx-analytics-hero__eyebrow">{adapter.shortLabel} program</p>
          <h1 className="cx-analytics-hero__title">Analytics</h1>
          <p className="cx-analytics-hero__subtitle">
            Cohort health, payments, activity, and task progress for your program.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-outline btn-sm cx-analytics-hero__refresh"
          onClick={refresh}
          disabled={loading}
        >
          <RefreshCw size={14} aria-hidden />
          Refresh
        </button>
      </header>

      <CxKpiStrip items={kpiItems} loading={loading || attendanceLoading} />

      {error && (
        <p className="cx-error" role="alert">
          {error}
        </p>
      )}

      {!loading && students.length > 0 && unassignedLearnerCount > 0 && (
        <p className="cx-hint muted" role="status">
          {assignedLearnerCount} participant{assignedLearnerCount === 1 ? '' : 's'} in batches ·{' '}
          {unassignedLearnerCount} enrolled on {getProgramLabel(program)} but not assigned to a batch
          yet — assign from{' '}
          <Link to="/cx/batches">Participants</Link>.
        </p>
      )}

      {modal && (
        <ParticipantListModal
          title={modal.title}
          participants={modal.participants}
          onClose={() => setModal(null)}
        />
      )}

      <CxProgramEnrollmentBar enabled={canSwitchProgram} />

      {adapter.hasTasks && (
        <div className="cx-tab-bar mobile-scroll-row" role="tablist" aria-label="Analytics views">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              className={`cx-tab-bar__tab${activeTab === tab.id ? ' is-active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <DashboardSkeleton rows={6} />
      ) : (
        <>
          {activeTab === 'overview' && (
            <>
              <CxOverviewDashboard
                batchStatus={overviewCharts.batchStatus}
                paymentByMonth={overviewCharts.paymentByMonth}
                activeStatus={overviewCharts.activeStatus}
                taskStatusData={taskStatusData}
                taskCompletionPct={stats.completionRate}
                hasTasks={adapter.hasTasks}
                enrollmentAssignment={overviewCharts.enrollmentAssignment}
                onDrill={handleDrill}
              />

              <div className="cx-analytics-grid">
              {adapter.hasTasks && (pendingReviews > 0 || awaitingResubmit > 0) && (
                <section className="cx-panel cx-analytics-grid__wide">
                  <div className="cx-panel__head">
                    <h2 className="cx-panel__title">Review queue</h2>
                  </div>
                  <div className="cx-panel__body">
                    <p className="cx-analytics-summary">
                      {pendingReviews > 0 && (
                        <>
                          <strong>{pendingReviews}</strong> submission
                          {pendingReviews === 1 ? '' : 's'} ready to review.
                        </>
                      )}
                      {pendingReviews > 0 && awaitingResubmit > 0 && ' '}
                      {awaitingResubmit > 0 && (
                        <>
                          <strong>{awaitingResubmit}</strong> awaiting learner resubmit.
                        </>
                      )}{' '}
                      <Link to="/cx/reviews">Open reviews</Link>
                    </p>
                  </div>
                </section>
              )}

              <section className="cx-panel">
                <div className="cx-panel__head">
                  <h2 className="cx-panel__title">Session content</h2>
                </div>
                <div className="cx-panel__body">
                  {recordingStats.expected > 0 ? (
                    <>
                      <div className="cx-inline-progress cx-inline-progress--lg">
                        <div className="cx-inline-progress__track">
                          <div
                            className="cx-inline-progress__fill"
                            style={{ width: `${recordingStats.pct}%` }}
                          />
                        </div>
                        <span className="cx-inline-progress__label">{recordingStats.pct}%</span>
                      </div>
                      <p className="muted cx-analytics-summary">
                        {recordingStats.uploaded} of {recordingStats.expected} session slots have
                        videos uploaded.
                        {recordingStats.batchesWithGaps > 0 && (
                          <>
                            {' '}
                            {recordingStats.batchesWithGaps} batch
                            {recordingStats.batchesWithGaps === 1 ? '' : 'es'} need content.
                          </>
                        )}
                      </p>
                    </>
                  ) : (
                    <p className="muted" style={{ margin: 0 }}>
                      {recordingStats.uploaded > 0
                        ? `${recordingStats.uploaded} recording link${recordingStats.uploaded === 1 ? '' : 's'} across batches.`
                        : 'No session recordings uploaded yet. Add videos from a batch detail page.'}
                    </p>
                  )}
                </div>
              </section>

              {attendanceLoading ? (
                <section className="cx-panel">
                  <div className="cx-panel__body">
                    <DashboardSkeleton rows={2} />
                  </div>
                </section>
              ) : attendanceStats ? (
                <section className="cx-panel">
                  <div className="cx-panel__head">
                    <h2 className="cx-panel__title">Attendance (30d)</h2>
                  </div>
                  <div className="cx-panel__body cx-engagement-stats">
                    <div className="cx-engagement-stat">
                      <span className="cx-engagement-stat__value">
                        {attendanceStats.avgPct != null ? `${attendanceStats.avgPct}%` : '—'}
                      </span>
                      <span className="cx-engagement-stat__label">Average</span>
                    </div>
                    <div className="cx-engagement-stat">
                      <span className="cx-engagement-stat__value">{attendanceStats.tracked}</span>
                      <span className="cx-engagement-stat__label">Tracked</span>
                    </div>
                    <div className="cx-engagement-stat">
                      <span className="cx-engagement-stat__value">{attendanceStats.atRisk}</span>
                      <span className="cx-engagement-stat__label">At risk (&lt;60%)</span>
                    </div>
                  </div>
                </section>
              ) : batches.some((b) => b.courseIds?.length) ? null : (
                <section className="cx-panel">
                  <div className="cx-panel__head">
                    <h2 className="cx-panel__title">Attendance</h2>
                  </div>
                  <div className="cx-panel__body">
                    <p className="muted" style={{ margin: 0 }}>
                      Link courses to batches in Admin to track attendance here.
                    </p>
                  </div>
                </section>
              )}

              <section className="cx-panel cx-analytics-grid__wide">
                <div className="cx-panel__head">
                  <h2 className="cx-panel__title">Recent activity</h2>
                </div>
                <div className="cx-panel__body">
                  <CxActivityFeed
                    items={recentActivity}
                    loading={false}
                    emptyMessage="Activity appears when participants submit tasks or use the LMS."
                  />
                </div>
                <CxActivityFeedFooter to="/cx/reviews" label="Open review queue" />
              </section>
              </div>
            </>
          )}

          {(activeTab === 'batches' || activeTab === 'tasks') && (
            <section className="cx-panel">
              <div className="cx-panel__head">
                <h2 className="cx-panel__title">Batches at a glance</h2>
              </div>
              <div className="cx-panel__body">
                {perBatch.length === 0 ? (
                  <p className="muted">No {adapter.shortLabel} batches yet.</p>
                ) : (
                  <div className="cx-batch-table-wrap">
                    <table className="cx-data-table">
                      <thead>
                        <tr>
                          <th scope="col">Batch</th>
                          <th scope="col">Participants</th>
                          {adapter.hasTasks && <th scope="col">Tasks</th>}
                          <th scope="col">Videos</th>
                          <th scope="col" />
                        </tr>
                      </thead>
                      <tbody>
                        {perBatch.map(({ batch, learners, pct, recordings }) => (
                          <tr key={batch.id}>
                            <td>
                              <Link to={`/cx/batches/${batch.id}`} className="cx-data-table__link">
                                {batch.name}
                              </Link>
                            </td>
                            <td>{learners}</td>
                            {adapter.hasTasks && (
                              <td>
                                <div className="cx-inline-progress">
                                  <div className="cx-inline-progress__track">
                                    <div
                                      className="cx-inline-progress__fill"
                                      style={{ width: `${pct}%` }}
                                    />
                                  </div>
                                  <span className="cx-inline-progress__label">{pct}%</span>
                                </div>
                              </td>
                            )}
                            <td>{recordings}</td>
                            <td className="cx-data-table__actions-cell">
                              <Link to={`/cx/batches/${batch.id}`} className="btn btn-outline btn-sm">
                                Open
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
          )}

          {adapter.hasTasks && activeTab === 'tasks' && (
            <section className="cx-panel">
              <div className="cx-panel__head">
                <h2 className="cx-panel__title">Completion by batch</h2>
              </div>
              <div className="cx-panel__body">
                <CxCharts
                  statusData={[]}
                  batchData={batchCompletionData}
                  donutPct={0}
                  batchOnly
                  onDrill={handleDrill}
                />
              </div>
            </section>
          )}

          {adapter.hasTasks && (activeTab === 'tasks') && (
            <section className="cx-panel">
              <div className="cx-panel__head">
                <h2 className="cx-panel__title">Task-by-task progress</h2>
                <label className="cx-board__filter">
                  Batch{' '}
                  <select
                    value={taskBatchFilter}
                    onChange={(e) => setTaskBatchFilter(e.target.value)}
                  >
                    <option value="all">All batches</option>
                    {batches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="cx-panel__body">
                <p className="muted cx-taskwise-sub">
                  {selectedBatchLabel} · {taskWiseStudents.length} participants · click a count for
                  details
                </p>
                {perModuleBreakdown.length === 0 ? (
                  <p className="muted">No tasks defined.</p>
                ) : (
                  <div className="cx-module-stack">
                    {perModuleBreakdown.map((mod) => (
                      <div key={mod.id} className="cx-module cx-module--open cx-module--static">
                        <div className="cx-module__head cx-module__head--static">
                          <div className="cx-module__titles">
                            <span className="cx-module__title">{mod.title}</span>
                            {mod.subtitle && (
                              <span className="cx-module__subtitle muted">{mod.subtitle}</span>
                            )}
                          </div>
                          <div className="cx-module__meta">
                            <span className="cx-module__count">{mod.tasks.length} tasks</span>
                            <span className="cx-module__pct">{mod.completionPct}% done</span>
                          </div>
                        </div>
                        <div className="cx-module__body">
                          <div className="cx-taskwise-table">
                            <div className="cx-taskwise-head">
                              <span>Task</span>
                              <span>Completed</span>
                              <span>Not completed</span>
                            </div>
                            {mod.taskRows.map(({ task, completed, notCompleted }) => (
                              <div key={task.id} className="cx-taskwise-row">
                                <button
                                  type="button"
                                  className="cx-taskwise-name cx-taskwise-name--btn"
                                  onClick={() =>
                                    setModal({
                                      title: `${mod.title} · ${task.title} — Not completed (${selectedBatchLabel})`,
                                      participants: notCompleted,
                                    })
                                  }
                                >
                                  {task.title}
                                </button>
                                <button
                                  type="button"
                                  className="cx-count-btn cx-count-btn--done"
                                  onClick={() =>
                                    setModal({
                                      title: `${mod.title} · ${task.title} — Completed (${selectedBatchLabel})`,
                                      participants: completed,
                                    })
                                  }
                                >
                                  {completed.length}
                                </button>
                                <button
                                  type="button"
                                  className="cx-count-btn cx-count-btn--pending"
                                  onClick={() =>
                                    setModal({
                                      title: `${mod.title} · ${task.title} — Not completed (${selectedBatchLabel})`,
                                      participants: notCompleted,
                                    })
                                  }
                                >
                                  {notCompleted.length}
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          )}

          {!adapter.hasTasks && activeTab === 'overview' && (
            <section className="cx-panel">
              <div className="cx-panel__body">
                <p className="muted" style={{ margin: 0 }}>
                  Task analytics for {adapter.shortLabel} will appear when task tracking is enabled.
                  Batch, attendance, and session metrics are available above.
                </p>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
