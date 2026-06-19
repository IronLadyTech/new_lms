import { useId } from 'react';
import {
  ATTENDANCE_STATUS,
  attendanceTooltip,
} from '../../services/attendanceService';
import { getTodayKey } from '../../utils/streakTimezone';

const LEGEND = [
  { status: ATTENDANCE_STATUS.PRESENT, label: 'Present', icon: '✓', className: 'present' },
  { status: ATTENDANCE_STATUS.ABSENT, label: 'Absent', icon: '✗', className: 'absent' },
  { status: ATTENDANCE_STATUS.WEEK_OFF, label: 'Week-off', icon: '—', className: 'weekoff' },
];

export default function AttendanceSection({
  courses = [],
  courseId,
  onCourseChange,
  range,
  onRangeChange,
  gridMonths,
  analytics,
  loading,
  error,
  onRetry,
}) {
  const courseSelectId = useId();
  const startId = useId();
  const endId = useId();

  if (loading) {
    return (
      <section className="streak-attendance streak-attendance--loading" aria-busy="true">
        <div className="streak-skeleton streak-skeleton--grid" />
      </section>
    );
  }

  if (error) {
    return (
      <section className="streak-attendance">
        <p className="streak-error">
          {error}{' '}
          <button type="button" className="btn btn-sm btn-outline" onClick={onRetry}>
            Retry
          </button>
        </p>
      </section>
    );
  }

  return (
    <section className="streak-attendance" aria-labelledby="attendance-heading">
      <div className="streak-attendance__head">
        <div>
          <h2 id="attendance-heading">My Attendance</h2>
          {analytics.attendancePct != null && (
            <span className="streak-attendance__chip">{analytics.attendancePct}% present</span>
          )}
        </div>
        <div className="streak-attendance__filters">
          <label htmlFor={courseSelectId} className="sr-only">
            Course
          </label>
          <select
            id={courseSelectId}
            className="streak-attendance__select"
            value={courseId}
            onChange={(e) => onCourseChange(e.target.value)}
          >
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} — {c.title}
              </option>
            ))}
          </select>
          <label htmlFor={startId} className="sr-only">
            Start date
          </label>
          <input
            id={startId}
            type="date"
            className="streak-attendance__date"
            value={range.start}
            max={range.end}
            onChange={(e) => onRangeChange({ ...range, start: e.target.value })}
          />
          <span className="streak-attendance__range-sep">to</span>
          <label htmlFor={endId} className="sr-only">
            End date
          </label>
          <input
            id={endId}
            type="date"
            className="streak-attendance__date"
            value={range.end}
            min={range.start}
            max={getTodayKey()}
            onChange={(e) => onRangeChange({ ...range, end: e.target.value })}
          />
        </div>
      </div>

      {analytics.insights?.length > 0 && (
        <ul className="streak-insights__list streak-insights__list--compact">
          {analytics.insights.map((text) => (
            <li key={text}>{text}</li>
          ))}
        </ul>
      )}

      {!gridMonths.length ? (
        <p className="streak-empty">
          {courseId === 'general'
            ? 'Enroll in a course to track attendance.'
            : 'No attendance records for this course in the selected date range.'}
        </p>
      ) : (
        <>
          <div className="streak-attendance__scroll">
            <table className="streak-attendance__table">
              <thead>
                <tr>
                  <th scope="col">Month</th>
                  {Array.from({ length: 31 }, (_, i) => (
                    <th key={i + 1} scope="col">
                      {i + 1}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {gridMonths.map((row) => (
                  <tr key={`${row.year}-${row.month}`}>
                    <th scope="row">{row.label}</th>
                    {Array.from({ length: 31 }, (_, i) => {
                      const day = i + 1;
                      const status = row.cells[day];
                      const dateKey = `${row.year}-${String(row.month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                      if (!status) {
                        return (
                          <td key={day} className="streak-attendance__cell streak-attendance__cell--empty">
                            <span className="sr-only">No session on day {day}</span>
                          </td>
                        );
                      }
                      const legend = LEGEND.find((l) => l.status === status);
                      return (
                        <td key={day}>
                          <button
                            type="button"
                            className={`streak-attendance__mark streak-attendance__mark--${legend?.className || 'empty'}`}
                            title={attendanceTooltip(dateKey, status)}
                            aria-label={attendanceTooltip(dateKey, status)}
                          >
                            <span aria-hidden>{legend?.icon}</span>
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="streak-attendance__legend">
            {LEGEND.map((item) => (
              <span key={item.status} className="streak-attendance__legend-item">
                <span className={`streak-attendance__mark streak-attendance__mark--${item.className}`}>
                  {item.icon}
                </span>
                {item.label}
              </span>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
