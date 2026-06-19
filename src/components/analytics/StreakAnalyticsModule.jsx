import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useStreakAnalytics } from '../../hooks/useStreakAnalytics';
import { useAttendanceAnalytics } from '../../hooks/useAttendanceAnalytics';
import CurrentStreakCard from './CurrentStreakCard';
import StreakSummaryCards from './StreakSummaryCards';
import SubmissionHeatmap from './SubmissionHeatmap';
import AttendanceSection from './AttendanceSection';
import AnalyticsInsights from './AnalyticsInsights';

export default function StreakAnalyticsModule({ learnerId, courses = [], showBrowseLink = true }) {
  const navigate = useNavigate();
  const { summary, loading, warning, isLive, retry } = useStreakAnalytics(learnerId);

  const enrolledCourses = useMemo(
    () => (courses.length ? courses : [{ id: 'general', code: 'ALL', title: 'All courses' }]),
    [courses]
  );

  const [courseId, setCourseId] = useState(enrolledCourses[0]?.id || 'general');

  useEffect(() => {
    if (enrolledCourses.length && !enrolledCourses.some((c) => c.id === courseId)) {
      setCourseId(enrolledCourses[0].id);
    }
  }, [enrolledCourses, courseId]);

  const attendance = useAttendanceAnalytics(learnerId, courseId);

  const mergedInsights = useMemo(() => {
    const set = new Set([...(summary?.insights || []), ...(attendance.analytics?.insights || [])]);
    return [...set].slice(0, 4);
  }, [summary?.insights, attendance.analytics?.insights]);

  const streakBroken =
    (summary?.currentStreak || 0) === 0 && (summary?.daysSinceLastActivity || 0) >= 1;

  return (
    <section className="streak-analytics" aria-label="Streak and attendance analytics">
      {warning && (
        <p className="streak-warning" role="status">
          {warning}
        </p>
      )}

      <div className="streak-analytics__summary">
        {loading ? (
          <>
            <div className="streak-skeleton streak-skeleton--summary" />
            <div className="streak-skeleton streak-skeleton--summary" />
          </>
        ) : (
          <StreakSummaryCards
            totalCorrect={summary?.totalCorrect}
            longestStreak={summary?.longestStreak}
          />
        )}
      </div>

      <AttendanceSection
        courses={enrolledCourses}
        courseId={courseId}
        onCourseChange={setCourseId}
        range={attendance.range}
        onRangeChange={attendance.setRange}
        gridMonths={attendance.gridMonths}
        analytics={attendance.analytics}
        loading={attendance.loading}
        error={attendance.error}
        onRetry={attendance.retry}
      />

      <div className="streak-block">
        <SubmissionHeatmap dailyCounts={summary?.dailyCounts || []} loading={loading} />
        {!loading && (
          <CurrentStreakCard currentStreak={summary?.currentStreak || 0} />
        )}
      </div>

      <AnalyticsInsights
        insights={mergedInsights}
        streakBroken={streakBroken}
        onResume={() => navigate('/app/home')}
      />

      {showBrowseLink && (
        <div className="streak-analytics__foot">
          <Link to="/app/home" className="btn btn-sm btn-outline">
            Browse courses
          </Link>
          {!isLive && (
            <span className="streak-analytics__sub muted">Live data · polling every 45s</span>
          )}
        </div>
      )}
    </section>
  );
}
