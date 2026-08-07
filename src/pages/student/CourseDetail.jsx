import { useEffect, useMemo, useState } from 'react';

import { useParams, Link, useNavigate } from 'react-router-dom';

import { Clock, Layers, PlayCircle } from 'lucide-react';

import { useAuth } from '../../context/AuthContext';

import { getCourse, getCourses, getResources } from '../../services/courseService';

import { getEvents } from '../../services/eventService';

import { logUserActivity, getUserProfile } from '../../services/userService';

import { getGroup } from '../../services/groupService';

import CourseContactPanel from '../../components/course/CourseContactPanel';

import CourseUpcomingPanel from '../../components/course/CourseUpcomingPanel';

import CourseRecordingsPanel from '../../components/course/CourseRecordingsPanel';

import GuestLockedPanel from '../../components/GuestLockedPanel';
import ProgramLockedPanel from '../../components/ProgramLockedPanel';

import CourseThumbnail from '../../components/CourseThumbnail';

import CourseHowItWorks from '../../components/course/CourseHowItWorks';

import CourseProgressPanel from '../../components/course/CourseProgressPanel';

import MBWProgramJourney from '../../components/mbw/program/MBWProgramJourney';

import useTaskEngine from '../../hooks/useTaskEngine';

import useMbwEnrollment from '../../hooks/useMbwEnrollment';

import {

  computeSectionProgress,

  getCurrentSectionId,

  getTotalMilestones,

  getCompletedMilestones,

} from '../../utils/mbwProgramUtils';

import { getCourseProgramMeta } from '../../utils/courseDisplay';
import { getProgramAccessState } from '../../utils/programAccess';
import EmptyState from '../../components/ui/EmptyState';
import { RefreshCw } from 'lucide-react';



export default function CourseDetail() {

  const { courseId } = useParams();

  const navigate = useNavigate();

  const { user, isGuest, profile } = useAuth();

  const [course, setCourse] = useState(null);

  const [resources, setResources] = useState([]);

  const [expandedSectionId, setExpandedSectionId] = useState('pre-preparation');

  const [moderators, setModerators] = useState([]);

  const [recordings, setRecordings] = useState([]);

  const [events, setEvents] = useState([]);

  const [allCourses, setAllCourses] = useState([]);
  const [courseLoading, setCourseLoading] = useState(true);
  const [courseError, setCourseError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);



  const isMbwCourse = course?.code === 'MBW';

  const { isEnrolled: mbwEnrolled } = useMbwEnrollment();

  const showMbwTasks = isMbwCourse && mbwEnrolled && !isGuest;



  const engine = useTaskEngine(showMbwTasks ? user?.uid : null);

  const { taskStates, loading: tasksLoading, completedCount, nextTaskState } = engine;



  const sectionProgress = useMemo(

    () => (showMbwTasks ? computeSectionProgress(taskStates, profile) : {}),

    [showMbwTasks, taskStates, profile]

  );

  const currentSectionId = useMemo(

    () => (showMbwTasks ? getCurrentSectionId(sectionProgress) : null),

    [showMbwTasks, sectionProgress]

  );

  const totalMilestones = useMemo(

    () => (showMbwTasks ? getTotalMilestones(sectionProgress) : 0),

    [showMbwTasks, sectionProgress]

  );

  const completedMilestones = useMemo(

    () => (showMbwTasks ? getCompletedMilestones(sectionProgress) : 0),

    [showMbwTasks, sectionProgress]

  );

  const nextTaskId = nextTaskState?.task?.id || null;



  const upcomingEvents = useMemo(() => {

    const now = new Date();

    const pad = (n) => String(n).padStart(2, '0');

    const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

    return (events || [])

      .filter((e) => e.date && e.date >= todayStr)

      .sort((a, b) => `${a.date}${a.time || ''}`.localeCompare(`${b.date}${b.time || ''}`))

      .slice(0, 3);

  }, [events]);



  useEffect(() => {

    if (isGuest) {
      setCourseLoading(false);
      return undefined;
    }

    let cancelled = false;

    (async () => {
      setCourseLoading(true);
      setCourseError('');
      setCourse(null);

      try {
        const c = await getCourse(courseId);
        if (cancelled) return;
        setCourse(c);
        if (!c) {
          setCourseError('This course could not be found. It may have been removed.');
          return;
        }

        getCourses().then((list) => {
          if (!cancelled) setAllCourses(list);
        }).catch(() => {
          if (!cancelled) setAllCourses([]);
        });

        const r = await getResources(courseId);
        if (cancelled) return;
        setResources(r);

        const ev = await getEvents().catch(() => []);
        if (cancelled) return;
        setEvents(ev);
      } catch (e) {
        console.error(e);
        if (!cancelled) {
          setCourseError('We could not load this course. Check your connection and try again.');
        }
      } finally {
        if (!cancelled) setCourseLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };

  }, [courseId, isGuest, reloadKey]);



  useEffect(() => {

    if (isGuest || !profile?.batchId) {

      setModerators([]);

      setRecordings([]);

      return undefined;

    }

    let alive = true;

    (async () => {

      const group = await getGroup(profile.batchId).catch(() => null);

      if (alive) setRecordings(group?.recordings || []);

      const ids = group?.moderatorIds || [];

      if (!ids.length) {

        if (alive) setModerators([]);

        return;

      }

      const mods = (

        await Promise.all(ids.map((id) => getUserProfile(id).catch(() => null)))

      ).filter(Boolean);

      if (alive) setModerators(mods);

    })();

    return () => {

      alive = false;

    };

  }, [isGuest, profile?.batchId]);



  useEffect(() => {

    if (currentSectionId) {

      setExpandedSectionId(currentSectionId);

    }

  }, [currentSectionId]);



  const trackView = async (resource) => {

    if (!user || isGuest) return;

    await logUserActivity(user.uid, {

      type: 'resource_view',

      courseId,

      title: resource.title,

      metadata: { resourceType: resource.type },

    });

  };



  const openMbwLesson = (taskId) => {

    navigate(`/app/mbw?lesson=${taskId}`);

  };



  const resumeHref = nextTaskId

    ? `/app/mbw?lesson=${nextTaskId}`

    : completedCount === 0

      ? '/app/mbw'

      : '/app/mbw';



  if (isGuest) {

    return (

      <div className="page course-detail">

        <Link to="/app/home" className="back-link">

          ← Programs

        </Link>

        <GuestLockedPanel title="Course content locked" />

      </div>

    );

  }



  if (!courseLoading && (courseError || !course)) {

    return (

      <div className="page course-detail">

        <Link to="/app/home" className="back-link">

          ← Programs

        </Link>

        <EmptyState
          icon={RefreshCw}
          title={courseError ? 'Course unavailable' : 'Course not found'}
          message={courseError || 'This program may no longer be available.'}
          action={
            courseError ? (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => {
                  setCourseError('');
                  setCourseLoading(true);
                  setReloadKey((k) => k + 1);
                }}
              >
                Try again
              </button>
            ) : (
              <Link to="/app/home" className="btn btn-outline btn-sm">
                Back to programs
              </Link>
            )
          }
        />

      </div>

    );

  }



  if (courseLoading || !course) {

    return (

      <div className="page course-detail">

        <div className="dashboard-skeleton dashboard-skeleton--inline" aria-busy="true">

          <div className="dashboard-skeleton__block course-detail-skeleton" />

        </div>

      </div>

    );

  }



  
  const programAccess = getProgramAccessState(course.code, profile, allCourses.length ? allCourses : [course]);

  if (!isGuest && !programAccess.canAccess) {
    return (
      <div className="page course-detail">
        <Link to="/app/home" className="back-link">
          ← Programs
        </Link>
        <ProgramLockedPanel
          title={`${course.code || 'Program'} is locked for your account`}
          message={programAccess.message}
          state={programAccess.state}
          programLabel={course.code || 'this program'}
        />
      </div>
    );
  }

  const meta = getCourseProgramMeta(course.code);

  const codeKey = (course.code || '').toLowerCase();

  const isEnrolled = programAccess.enrolled || profile?.enrolledCourses?.includes(course.id);

  const openResources = resources.filter((r) => !r.locked && r.url).length;

  const progressPct = totalMilestones

    ? Math.round((completedMilestones / totalMilestones) * 100)

    : 0;



  return (

    <div className="page course-detail">

      <Link to="/app/home#courses" className="back-link">

        ← Programs

      </Link>



      <header className={`course-detail-hero course-detail-hero--${codeKey}`}>

        <div className="course-detail-hero__media">

          <CourseThumbnail course={course} size="hero" />

        </div>

        <div className="course-detail-hero__body">

          <div className="course-card__tags">

            <span className={`course-card__tag course-card__tag--${codeKey}`}>{meta.tag}</span>

            {isEnrolled && <span className="course-card__tag course-card__tag--enrolled">Enrolled</span>}

          </div>

          <h1 className="course-detail-hero__title">{course.title}</h1>

          <p className="course-detail-hero__desc">{course.description}</p>

          <ul className="course-card__meta">

            <li>

              <Clock size={14} aria-hidden />

              {meta.duration}

            </li>

            <li>

              <Layers size={14} aria-hidden />

              {meta.format}

            </li>

            {showMbwTasks && totalMilestones > 0 ? (

              <li>

                <PlayCircle size={14} aria-hidden />

                {completedMilestones} of {totalMilestones} milestones complete

              </li>

            ) : resources.length > 0 ? (

              <li>

                <PlayCircle size={14} aria-hidden />

                {openResources} resource{openResources !== 1 ? 's' : ''} available

              </li>

            ) : null}

          </ul>

          {showMbwTasks && totalMilestones > 0 && (

            <div className="course-detail-hero__progress" aria-label={`${progressPct}% complete`}>

              <div className="course-card__progress-bar">

                <div className="course-card__progress-fill" style={{ width: `${progressPct}%` }} />

              </div>

              <span className="course-card__progress-label">{progressPct}% complete</span>

            </div>

          )}

          {isMbwCourse && (

            <Link to={resumeHref} className="btn btn-primary course-detail-hero__cta">

              {showMbwTasks && completedCount > 0 ? 'Continue MBW journey' : 'Open MBW tasks'}

            </Link>

          )}

        </div>

      </header>



      <CourseContactPanel moderators={moderators} />

      <CourseHowItWorks variant={isMbwCourse ? 'mbw' : 'default'} />



      {showMbwTasks && (

        <div className="course-detail-body">

          <section className="course-detail-modules" aria-labelledby="course-modules-heading">

            <h2 id="course-modules-heading" className="home-section-title">

              Program modules

            </h2>

            <p className="page-sub">

              Expand each section to see lessons and assignments — tap a row to open it in your task workspace.

            </p>

            {tasksLoading && taskStates.length === 0 ? (

              <div className="dashboard-skeleton dashboard-skeleton--inline" aria-busy="true">

                <div className="dashboard-skeleton__block" style={{ minHeight: '12rem' }} />

              </div>

            ) : (

              <MBWProgramJourney

                sectionProgress={sectionProgress}

                profile={profile}

                expandedSectionId={expandedSectionId}

                currentSectionId={currentSectionId}

                onToggleSection={(id) =>

                  setExpandedSectionId((prev) => (prev === id ? null : id))

                }

                taskStates={taskStates}

                activeTaskId={nextTaskId}

                nextTaskId={nextTaskId}

                onSelectLesson={openMbwLesson}

                autoScroll={false}

              />

            )}

          </section>



          <div className="course-detail-aside">

            <CourseProgressPanel

              completedMilestones={completedMilestones}

              totalMilestones={totalMilestones}

              nextTaskState={nextTaskState}

              taskStates={taskStates}

              resumeHref={resumeHref}

            />

            <CourseUpcomingPanel events={upcomingEvents} />

          </div>

        </div>

      )}



      <CourseRecordingsPanel recordings={recordings} program={profile?.program} />

      <section className="section course-detail-resources">

        <h2 className="home-section-title">Lesson resources</h2>

        <p className="page-sub">Short async materials — open to watch or download</p>

        {resources.length === 0 ? (

          <p className="muted">No resources published yet for this program.</p>

        ) : (

          <ul className="resource-list resource-list--cards">

            {resources.map((r) => (

              <li key={r.id} className={`resource-card${r.locked ? ' resource-card--locked' : ''}`}>

                <div className="resource-card__icon" aria-hidden>

                  <PlayCircle size={20} />

                </div>

                <div className="resource-card__body">

                  <strong>{r.title}</strong>

                  <span className="muted resource-card__type">{r.type}</span>

                  {r.locked && <span className="badge badge-locked">Locked</span>}

                </div>

                {r.locked ? (

                  <span className="resource-locked-label muted">Contact Iron Lady for access</span>

                ) : r.url ? (

                  <a

                    href={r.url}

                    target="_blank"

                    rel="noreferrer"

                    className="btn btn-sm btn-primary"

                    onClick={() => trackView(r)}

                  >

                    Open

                  </a>

                ) : (

                  <span className="muted">No URL</span>

                )}

              </li>

            ))}

          </ul>

        )}

      </section>

    </div>

  );

}

