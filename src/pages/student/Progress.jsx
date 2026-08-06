import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Film,
  FileText,
  Presentation,
  ClipboardList,
  ClipboardCheck,
  File,
  GraduationCap,
  TrendingUp,
  Activity,
  Lock,
  ExternalLink,
  Flame,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getCourses, getResourcesForCourses } from '../../services/courseService';
import { getUserActivities } from '../../services/userService';
import GuestLockedPanel from '../../components/GuestLockedPanel';
import ActivityLogList, { buildCourseMap } from '../../components/ActivityLogList';
import CourseProgressPanel from '../../components/course/CourseProgressPanel';
import ProgressStreakSummary from '../../components/progress/ProgressStreakSummary';
import ProgressStatsBar from '../../components/progress/ProgressStatsBar';
import ProgressProgramCard from '../../components/progress/ProgressProgramCard';
import PageHeader from '../../components/ui/PageHeader';
import EmptyState from '../../components/ui/EmptyState';
import SectionCard from '../../components/ui/SectionCard';
import DashboardSkeleton from '../../components/ui/DashboardSkeleton';
import useTaskEngine from '../../hooks/useTaskEngine';
import { useStreakAnalyticsContext } from '../../context/StreakAnalyticsContext';
import {
  computeSectionProgress,
  getTotalMilestones,
  getCompletedMilestones,
} from '../../utils/mbwProgramUtils';
import {
  canAccessProgram,
  getEnrolledCourses,
  isSyntheticCourse,
  resolveEnrolledFirestoreCourseIds,
} from '../../utils/programAccess';
import { getProgramTasksPath } from '../../utils/programTaskRoutes';
import { PROGRAMS } from '../../data/programTypes';

const RESOURCE_ICONS = {
  video: Film,
  pdf: FileText,
  ppt: Presentation,
  assignment: ClipboardList,
  mock_test: ClipboardCheck,
};

const resourceIcon = (type) => RESOURCE_ICONS[type] || File;

function attachCourseTitles(resources, courseById) {
  return resources.map((item) => ({
    ...item,
    courseTitle: courseById.get(item.courseId)?.title || 'Program',
  }));
}

function activityTimestamp(activity) {
  const ts = activity?.createdAt;
  if (ts?.toMillis) return ts.toMillis();
  if (ts?.seconds) return ts.seconds * 1000;
  const parsed = new Date(ts).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

function sortActivitiesNewestFirst(list = []) {
  return [...list].sort((a, b) => activityTimestamp(b) - activityTimestamp(a));
}

function getProgramCtaLabel(code) {
  if (code === 'MBW') return 'Continue MBW';
  if (code === '100BM') return 'Open tasks';
  return 'Open program';
}

export default function Progress() {
  const { user, profile, isGuest, loading: authLoading } = useAuth();
  const [allCourses, setAllCourses] = useState([]);
  const [resources, setResources] = useState([]);
  const [activities, setActivities] = useState([]);
  const [coursesLoading, setCoursesLoading] = useState(true);
  const [resourcesLoading, setResourcesLoading] = useState(true);
  const [activitiesLoading, setActivitiesLoading] = useState(true);
  const [resourceFilter, setResourceFilter] = useState('all');

  const streakAnalytics = useStreakAnalyticsContext() || {
    summary: null,
    events: [],
    loading: true,
    warning: null,
    isLive: false,
    retry: () => {},
  };

  const courses = useMemo(
    () => getEnrolledCourses(profile, allCourses),
    [profile, allCourses]
  );

  const enrolledCourseIds = useMemo(
    () => resolveEnrolledFirestoreCourseIds(profile, allCourses),
    [profile, allCourses]
  );

  const enrolledCourseIdSet = useMemo(() => new Set(enrolledCourseIds), [enrolledCourseIds]);

  const courseMap = useMemo(() => buildCourseMap(courses), [courses]);

  const enrollmentKey = useMemo(
    () =>
      [
        ...(profile?.enrolledCourses || []),
        profile?.program || '',
        ...(profile?.programs || []),
      ]
        .filter(Boolean)
        .join('|'),
    [profile?.enrolledCourses, profile?.program, profile?.programs]
  );

  const showMbw =
    !isGuest &&
    Boolean(user?.uid) &&
    Boolean(profile) &&
    (profile?.program === PROGRAMS.MBW ||
      (profile?.programs || []).includes(PROGRAMS.MBW) ||
      canAccessProgram(PROGRAMS.MBW, profile, allCourses));

  const engine = useTaskEngine(showMbw ? user?.uid : null);
  const { taskStates, loading: tasksLoading, nextTaskState } = engine;

  const sectionProgress = useMemo(
    () => (showMbw ? computeSectionProgress(taskStates, profile) : {}),
    [showMbw, taskStates, profile]
  );
  const totalMilestones = useMemo(
    () => (showMbw ? getTotalMilestones(sectionProgress) : 0),
    [showMbw, sectionProgress]
  );
  const completedMilestones = useMemo(
    () => (showMbw ? getCompletedMilestones(sectionProgress) : 0),
    [showMbw, sectionProgress]
  );
  const nextTaskId = nextTaskState?.task?.id || null;
  const resumeHref = nextTaskId ? `/app/mbw?lesson=${nextTaskId}` : '/app/mbw';

  const scrollToSection = useCallback((targetId) => {
    document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  useEffect(() => {
    if (authLoading || !user || isGuest || !profile) {
      if (!authLoading && (!user || isGuest)) {
        setCoursesLoading(false);
        setResourcesLoading(false);
        setActivitiesLoading(false);
      }
      return undefined;
    }

    let alive = true;

    (async () => {
      setCoursesLoading(true);
      setResourcesLoading(true);
      setActivitiesLoading(true);

      const courseResult = await getCourses()
        .then((list) => ({ list }))
        .catch((error) => {
          console.error('Progress: failed to load courses', error);
          return { list: [] };
        });

      if (!alive) return;

      setAllCourses(courseResult.list);
      setCoursesLoading(false);

      const courseIds = resolveEnrolledFirestoreCourseIds(profile, courseResult.list);

      const [resourceRows, acts] = await Promise.all([
        courseIds.length
          ? getResourcesForCourses(courseIds).catch((error) => {
              console.error('Progress: failed to load resources', error);
              return [];
            })
          : Promise.resolve([]),
        getUserActivities(user.uid, 30).catch((error) => {
          console.error('Progress: failed to load activities', error);
          return [];
        }),
      ]);

      if (!alive) return;

      const courseById = new Map(courseResult.list.map((c) => [c.id, c]));
      setResources(attachCourseTitles(resourceRows, courseById));
      setActivities(acts);
      setResourcesLoading(false);
      setActivitiesLoading(false);
    })();

    return () => {
      alive = false;
    };
  }, [authLoading, user?.uid, isGuest, profile, enrollmentKey]);

  useEffect(() => {
    if (resourceFilter !== 'all' && !enrolledCourseIdSet.has(resourceFilter)) {
      setResourceFilter('all');
    }
  }, [resourceFilter, enrolledCourseIdSet]);

  const enrolledActivities = useMemo(() => {
    const filtered = !enrolledCourseIdSet.size
      ? activities
      : activities.filter((activity) => {
          if (!activity.courseId) return true;
          return enrolledCourseIdSet.has(activity.courseId);
        });
    return sortActivitiesNewestFirst(filtered);
  }, [activities, enrolledCourseIdSet]);

  const filteredResources = useMemo(() => {
    if (resourceFilter === 'all') return resources;
    return resources.filter((resource) => resource.courseId === resourceFilter);
  }, [resources, resourceFilter]);

  const resourceFilterOptions = useMemo(() => {
    const options = [{ id: 'all', label: 'All programs' }];
    courses.forEach((course) => {
      const realId = isSyntheticCourse(course)
        ? allCourses.find((c) => c.code === course.code)?.id
        : course.id;
      if (realId && resources.some((r) => r.courseId === realId)) {
        options.push({ id: realId, label: course.title });
      }
    });
    return options;
  }, [courses, allCourses, resources]);

  const courseResourceStats = useMemo(() => {
    const map = {};
    resources.forEach((r) => {
      const id = r.courseId;
      if (!map[id]) map[id] = { total: 0, unlocked: 0 };
      map[id].total += 1;
      if (!r.locked) map[id].unlocked += 1;
    });
    return map;
  }, [resources]);

  const programMetrics = useMemo(() => {
    return courses.map((course) => {
      const isMbw = course.code === 'MBW';
      const realId = isSyntheticCourse(course)
        ? allCourses.find((c) => c.code === course.code)?.id || course.id
        : course.id;
      const stats = courseResourceStats[realId] || { total: 0, unlocked: 0 };
      const pct = isMbw
        ? totalMilestones
          ? Math.round((completedMilestones / totalMilestones) * 100)
          : 0
        : stats.total
          ? Math.round((stats.unlocked / stats.total) * 100)
          : 0;
      const label = isMbw
        ? `${completedMilestones} of ${totalMilestones} milestones complete`
        : resourcesLoading
          ? 'Loading resources…'
          : `${stats.unlocked} of ${stats.total} resource${stats.total !== 1 ? 's' : ''} unlocked`;
      const href = isMbw
        ? '/app/mbw'
        : isSyntheticCourse(course)
          ? '/app/home#courses'
          : getProgramTasksPath(course.code) || `/app/course/${course.id}`;

      return { course, pct, label, href, realId };
    });
  }, [
    courses,
    allCourses,
    courseResourceStats,
    totalMilestones,
    completedMilestones,
    resourcesLoading,
  ]);

  const overallPct = useMemo(() => {
    if (!programMetrics.length) return 0;
    const sum = programMetrics.reduce((acc, item) => acc + item.pct, 0);
    return Math.round(sum / programMetrics.length);
  }, [programMetrics]);

  const resourceTotals = useMemo(() => {
    const total = resources.length;
    const unlocked = resources.filter((r) => !r.locked).length;
    return { total, unlocked };
  }, [resources]);

  const currentStreak = streakAnalytics.summary?.currentStreak ?? profile?.streak ?? 0;

  const quickStats = [
    {
      id: 'programs',
      label: 'Programs',
      value: coursesLoading ? '—' : courses.length,
      hint: 'enrolled',
      targetId: 'progress-programs',
    },
    {
      id: 'progress',
      label: 'Overall',
      value: coursesLoading || resourcesLoading ? '—' : `${overallPct}%`,
      hint: 'avg. completion',
    },
    {
      id: 'resources',
      label: 'Resources',
      value: resourcesLoading ? '—' : resourceTotals.unlocked,
      hint: resourcesLoading ? '' : `of ${resourceTotals.total} open`,
      targetId: 'progress-resources',
    },
    {
      id: 'streak',
      label: 'Streak',
      value: streakAnalytics.loading ? '—' : currentStreak,
      hint: 'days active',
      targetId: 'progress-streak',
    },
  ];


  if (isGuest) {
    return (
      <div className="page progress-page">
        <PageHeader
          eyebrow="Your learning"
          icon={TrendingUp}
          title="Progress"
          subtitle="Track milestones, materials, and momentum across your Iron Lady programs."
        />
        <GuestLockedPanel title="Progress locked" />
      </div>
    );
  }

  return (
    <div className="page progress-page">
      <PageHeader
        eyebrow="Your learning"
        icon={TrendingUp}
        title="Progress"
        subtitle="Track milestones, materials, and momentum across your Iron Lady programs."
      />

      <ProgressStatsBar stats={quickStats} onStatClick={scrollToSection} />

      <div className="progress-shell">
        <div className="progress-shell__primary">
          {showMbw &&
            (tasksLoading && taskStates.length === 0 ? (
              <DashboardSkeleton rows={1} />
            ) : totalMilestones > 0 ? (
              <section className="progress-mbw-panel" aria-label="MBW program progress">
                <CourseProgressPanel
                  completedMilestones={completedMilestones}
                  totalMilestones={totalMilestones}
                  nextTaskState={nextTaskState}
                  taskStates={taskStates}
                  resumeHref={resumeHref}
                />
              </section>
            ) : null)}

          <SectionCard
            title="Enrolled programs"
            description="Your active Iron Lady tracks — LEP, 100BM, and MBW."
            icon={GraduationCap}
            className="progress-section progress-section--programs"
            as="section"
          >
            <div id="progress-programs" className="progress-section__anchor" tabIndex={-1} />
            {coursesLoading || authLoading ? (
              <div className="progress-program-grid">
                <DashboardSkeleton rows={2} />
              </div>
            ) : courses.length === 0 ? (
              <EmptyState
                icon={GraduationCap}
                title="No programs yet"
                message="Enroll in a program to start tracking your progress."
                action={
                  <Link to="/app/home#courses" className="btn btn-primary btn-sm">
                    Explore programs
                  </Link>
                }
              />
            ) : (
              <ul className="progress-program-grid">
                {programMetrics.map(({ course, pct, label, href }) => (
                  <li key={course.id}>
                    <ProgressProgramCard
                      course={course}
                      pct={pct}
                      label={label}
                      loading={resourcesLoading && course.code !== 'MBW'}
                      href={href}
                      ctaLabel={getProgramCtaLabel(course.code)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>

        <div className="progress-shell__secondary">
          <SectionCard
            title="Resources"
            description="Lesson materials from your enrolled programs."
            icon={FileText}
            className="progress-section progress-section--resources"
            as="section"
            actions={
              resourceFilterOptions.length > 1 ? (
                <div className="progress-filter mobile-scroll-row" role="tablist" aria-label="Filter resources by program">
                  {resourceFilterOptions.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      role="tab"
                      aria-selected={resourceFilter === option.id}
                      className={`progress-filter__btn${
                        resourceFilter === option.id ? ' progress-filter__btn--active' : ''
                      }`}
                      onClick={() => setResourceFilter(option.id)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              ) : null
            }
          >
            <div id="progress-resources" className="progress-section__anchor" tabIndex={-1} />
            {resourcesLoading ? (
              <DashboardSkeleton rows={2} />
            ) : filteredResources.length === 0 ? (
              <EmptyState
                icon={FileText}
                title={courses.length === 0 ? 'No resources yet' : 'No resources for this program'}
                message={
                  courses.length === 0
                    ? 'Lesson materials appear here once you enroll in a program.'
                    : 'Materials for this program will appear here when published.'
                }
                action={
                  courses.length === 0 ? (
                    <Link to="/app/home#courses" className="btn btn-primary btn-sm">
                      Explore programs
                    </Link>
                  ) : null
                }
              />
            ) : (
              <ul className="resource-list resource-list--cards">
                {filteredResources.map((r) => {
                  const Icon = resourceIcon(r.type);
                  const courseHref = r.courseId ? `/app/course/${r.courseId}` : null;
                  return (
                    <li key={r.id}>
                      <article
                        className={`resource-card${r.locked ? ' resource-card--locked' : ''}`}
                      >
                        <span className="resource-card__icon" aria-hidden="true">
                          <Icon size={18} />
                        </span>
                        <div className="resource-card__body">
                          {courseHref ? (
                            <Link to={courseHref} className="progress-resource-course-link">
                              {r.courseTitle}
                            </Link>
                          ) : (
                            <span className="progress-resource-course-link">{r.courseTitle}</span>
                          )}
                          <strong>{r.title}</strong>
                          <span className="resource-card__type muted">{r.type}</span>
                        </div>
                        {r.locked ? (
                          <span className="progress-resource-lock muted">
                            <Lock size={14} aria-hidden="true" />
                            Locked
                          </span>
                        ) : r.url ? (
                          <a
                            href={r.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-sm btn-outline progress-resource-open"
                          >
                            Open
                            <ExternalLink size={14} aria-hidden="true" />
                          </a>
                        ) : null}
                      </article>
                    </li>
                  );
                })}
              </ul>
            )}
          </SectionCard>

          <SectionCard
            title="Activity log"
            description="Recent actions in your enrolled programs."
            icon={Activity}
            className="progress-section progress-section--activity"
            as="section"
          >
            <div id="progress-activity" className="progress-section__anchor" tabIndex={-1} />
            {activitiesLoading ? (
              <DashboardSkeleton rows={1} />
            ) : (
              <ActivityLogList
                activities={enrolledActivities}
                courseMap={courseMap}
                emptyMessage={
                  courses.length === 0
                    ? 'No activity yet. Enroll in a program to start building momentum.'
                    : 'No activity in your enrolled programs yet. Open a resource or start a lesson.'
                }
              />
            )}
          </SectionCard>

          <SectionCard
            title="Streak"
            icon={Flame}
            className="progress-section progress-section--streak"
            as="section"
          >
            <div id="progress-streak" className="progress-section__anchor" tabIndex={-1} />
            <ProgressStreakSummary
              summary={streakAnalytics.summary}
              loading={streakAnalytics.loading}
            />
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
