import { useEffect, useMemo, useState } from 'react';
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
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getCourses, getResources } from '../../services/courseService';
import { getUserActivities } from '../../services/userService';
import GuestLockedPanel from '../../components/GuestLockedPanel';
import ActivityLogList, { buildCourseMap } from '../../components/ActivityLogList';
import CourseProgressPanel from '../../components/course/CourseProgressPanel';
import PageHeader from '../../components/ui/PageHeader';
import EmptyState from '../../components/ui/EmptyState';
import SectionCard from '../../components/ui/SectionCard';
import DashboardSkeleton from '../../components/ui/DashboardSkeleton';
import useTaskEngine from '../../hooks/useTaskEngine';
import useMbwEnrollment from '../../hooks/useMbwEnrollment';
import {
  computeSectionProgress,
  getTotalMilestones,
  getCompletedMilestones,
} from '../../utils/mbwProgramUtils';
import { getCourseProgramMeta } from '../../utils/courseDisplay';

const RESOURCE_ICONS = {
  video: Film,
  pdf: FileText,
  ppt: Presentation,
  assignment: ClipboardList,
  mock_test: ClipboardCheck,
};

const resourceIcon = (type) => RESOURCE_ICONS[type] || File;

export default function Progress() {
  const { user, profile, isGuest } = useAuth();
  const [courses, setCourses] = useState([]);
  const [courseMap, setCourseMap] = useState({});
  const [resources, setResources] = useState([]);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  // MBW milestone progress — same data path as CourseDetail (no API change)
  const { isEnrolled: mbwEnrolled } = useMbwEnrollment();
  const showMbw = mbwEnrolled && !isGuest;
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

  useEffect(() => {
    if (!user || isGuest) {
      setLoading(false);
      return undefined;
    }
    let alive = true;
    (async () => {
      setLoading(true);
      const all = await getCourses();
      if (!alive) return;
      setCourseMap(buildCourseMap(all));
      const enrolled = all.filter((c) => profile?.enrolledCourses?.includes(c.id));
      setCourses(enrolled);

      const [resArrays, acts] = await Promise.all([
        Promise.all(
          enrolled.map((c) =>
            getResources(c.id).then((r) =>
              r.map((item) => ({ ...item, courseId: c.id, courseTitle: c.title }))
            )
          )
        ),
        getUserActivities(user.uid, 30),
      ]);
      if (!alive) return;
      setResources(resArrays.flat());
      setActivities(acts);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [user, isGuest, profile]);

  // Real per-course resource availability (non-MBW courses have no completion data)
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

  if (isGuest) {
    return (
      <div className="page progress-page">
        <PageHeader
          eyebrow="Your learning"
          icon={TrendingUp}
          title="Progress"
          subtitle="Track your Iron Lady journey — milestones, resources, and recent activity."
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
        subtitle="Track your Iron Lady journey — milestones, resources, and recent activity."
      />

      {loading ? (
        <DashboardSkeleton rows={2} />
      ) : (
        <>
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

          <SectionCard title="Enrolled programs" icon={GraduationCap} className="progress-section">
            {courses.length === 0 ? (
              <EmptyState
                icon={GraduationCap}
                title="No programs yet"
                message="Enroll in a program to start tracking your progress."
                action={
                  <Link to="/app/home#courses" className="btn btn-primary btn-sm">
                    Browse programs
                  </Link>
                }
              />
            ) : (
              <ul className="progress-course-list">
                {courses.map((c) => {
                  const meta = getCourseProgramMeta(c.code);
                  const codeKey = (c.code || '').toLowerCase();
                  const isMbw = c.code === 'MBW';
                  const stats = courseResourceStats[c.id] || { total: 0, unlocked: 0 };
                  const pct = isMbw
                    ? totalMilestones
                      ? Math.round((completedMilestones / totalMilestones) * 100)
                      : 0
                    : stats.total
                      ? Math.round((stats.unlocked / stats.total) * 100)
                      : 0;
                  const label = isMbw
                    ? `${completedMilestones} of ${totalMilestones} milestones complete`
                    : `${stats.unlocked} of ${stats.total} resource${stats.total !== 1 ? 's' : ''} unlocked`;
                  return (
                    <li key={c.id} className="progress-course-row">
                      <div className="progress-course-row__head">
                        <span className={`course-card__tag course-card__tag--${codeKey}`}>
                          {meta.tag}
                        </span>
                        <Link
                          to={isMbw ? '/app/mbw' : `/app/course/${c.id}`}
                          className="progress-course-row__title"
                        >
                          {c.title}
                        </Link>
                      </div>
                      <div
                        className="progress-course-row__bar"
                        aria-label={`${pct}% — ${label}`}
                      >
                        <div className="course-card__progress-bar">
                          <div
                            className="course-card__progress-fill"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="course-card__progress-label">{label}</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </SectionCard>

          <SectionCard title="Resources" icon={FileText} className="progress-section">
            {resources.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="No resources yet"
                message="Lesson materials will appear here once your program publishes them."
              />
            ) : (
              <ul className="resource-list">
                {resources.map((r) => {
                  const Icon = resourceIcon(r.type);
                  return (
                    <li
                      key={r.id}
                      className={`resource-item${r.locked ? ' resource-item--locked' : ''}`}
                    >
                      <span className="resource-item__icon" aria-hidden="true">
                        <Icon size={18} />
                      </span>
                      <div>
                        <strong>{r.title}</strong>
                        <span className="muted">
                          {r.type} · {r.courseTitle}
                        </span>
                        {r.locked && <span className="badge badge-locked">Locked</span>}
                      </div>
                      {r.locked ? (
                        <span className="resource-locked-label muted">Locked</span>
                      ) : r.url ? (
                        <a
                          href={r.url}
                          target="_blank"
                          rel="noreferrer"
                          className="btn btn-sm btn-outline"
                        >
                          Open
                        </a>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </SectionCard>

          <SectionCard title="Activity log" icon={Activity} className="progress-section">
            <ActivityLogList
              activities={activities}
              courseMap={courseMap}
              emptyMessage="No activity recorded yet. Open a resource or enroll in a course to get started."
            />
          </SectionCard>
        </>
      )}
    </div>
  );
}
