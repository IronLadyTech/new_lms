import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { useStreakAnalytics } from '../../hooks/useStreakAnalytics';
import { useAttendanceAnalytics } from '../../hooks/useAttendanceAnalytics';
import CurrentStreakCard from './CurrentStreakCard';
import StreakSummaryCards from './StreakSummaryCards';
import SubmissionHeatmap from './SubmissionHeatmap';
import AttendanceSection from './AttendanceSection';
import AnalyticsInsights from './AnalyticsInsights';

export default function StreakAnalyticsModule({
  learnerId,
  courses = [],
  showBrowseLink = true,
  homeVariant = false,
}) {
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

  const hasActivity =
    (summary?.totalCorrect || 0) > 0 ||
    (summary?.currentStreak || 0) > 0 ||
    (summary?.longestStreak || 0) > 0;

  const hasAttendanceData = attendance.gridMonths?.length > 0;

  const handleResumePractice = useCallback(() => {
    const enrolled = courses.filter((c) => c.id && c.id !== 'general');
    const mbw = enrolled.find((c) => c.code === 'MBW');
    if (mbw) {
      navigate('/app/mbw');
      return;
    }
    if (enrolled.length === 1) {
      navigate(`/app/course/${enrolled[0].id}`);
      return;
    }
    const scrollToCourses = () => {
      document.getElementById('home-courses')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    if (window.location.pathname.endsWith('/home')) {
      scrollToCourses();
    } else {
      navigate('/app/home#courses');
    }
  }, [courses, navigate]);

  if (homeVariant && !loading && !hasActivity && !hasAttendanceData) {
    return (
      <section className="home-get-started" aria-label="Getting started">
        <span className="home-get-started__icon" aria-hidden>
          <Sparkles size={22} strokeWidth={2} />
        </span>
        <div>
          <h3 className="home-get-started__title">Start building your streak</h3>
          <p className="home-get-started__text muted">
            Complete your first MBW task or lesson — consistency unlocks streaks, attendance, and
            progress insights here.
          </p>
        </div>
        <button type="button" className="btn btn-primary btn-sm" onClick={handleResumePractice}>
          Start learning
        </button>
      </section>
    );
  }

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

      {(!homeVariant || hasAttendanceData) && (
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
      )}

      {hasActivity && (
        <div className="streak-block">
          <SubmissionHeatmap dailyCounts={summary?.dailyCounts || []} loading={loading} />
          {!loading && <CurrentStreakCard currentStreak={summary?.currentStreak || 0} />}
        </div>
      )}

      <AnalyticsInsights
        insights={mergedInsights}
        streakBroken={streakBroken}
        onResume={handleResumePractice}
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
