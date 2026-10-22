/*
 * Stitch student dashboard — /app/home-next
 * Same UI shell; data from Auth + existing LMS services (courses, tasks, events, streak).
 */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { LogIn, RefreshCw, ShieldAlert } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getCourses } from '../../services/courseService';
import {
  getAnnouncements,
  getActiveAnnouncementsForUser,
} from '../../services/announcementService';
import { getUserActivities } from '../../services/userService';
import { getEvents } from '../../services/eventService';
import { resolveVisibleEvents } from '../../utils/eventVisibility';
import useModeratedBatchIds from '../../hooks/useModeratedBatchIds';
import useMbwEnrollment from '../../hooks/useMbwEnrollment';
import useTaskEngine from '../../hooks/useTaskEngine';
import useBm100TaskEngine from '../../hooks/useBm100TaskEngine';
import useLepTaskEngine from '../../hooks/useLepTaskEngine';
import { useStreakAnalytics } from '../../hooks/useStreakAnalytics';
import { canAccessProgram } from '../../utils/programAccess';
import { PROGRAMS } from '../../data/programTypes';
import { buildStitchHomeDashboard } from '../../services/stitchHomeDashboardService';
import StitchDashboard from '../../components/stitchHome/StitchDashboard';
import StitchSchedule from '../../components/stitchHome/StitchSchedule';
import StitchBrowse from '../../components/stitchHome/StitchBrowse';
import StitchProgress from '../../components/stitchHome/StitchProgress';
import DashboardSkeleton from '../../components/ui/DashboardSkeleton';
import EmptyState from '../../components/ui/EmptyState';
import '../../styles/stitchHome.css';

/**
 * @param {object} props
 * @param {'dashboard'|'schedule'|'browse'|'progress'} [props.view] - which body to render inside
 *   the Stitch chrome. Both need the same data, the same auth guards and the
 *   same loading and error states, so they share this loader rather than the
 *   schedule page growing its own copy of all of it.
 */
export default function HomeNext({ view = 'dashboard' }) {
  const { user, profile, role, loading: authLoading, isGuest, isBlocked, signOut } = useAuth();
  const { batchIds: moderatedBatchIds } = useModeratedBatchIds();
  const moderatedKey = moderatedBatchIds.join(',');

  const [courses, setCourses] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [activities, setActivities] = useState([]);
  const [visibleEvents, setVisibleEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  const { isEnrolled: mbwEnrolled } = useMbwEnrollment();
  const canOpenMbw = canAccessProgram(PROGRAMS.MBW, profile, courses) || mbwEnrolled;
  const canOpenBm100 = canAccessProgram(PROGRAMS.BM100, profile, courses);
  const canOpenLep = canAccessProgram(PROGRAMS.LEP, profile, courses);

  const mbwEngine = useTaskEngine(canOpenMbw && !isGuest ? user?.uid : null);
  const bm100Engine = useBm100TaskEngine(canOpenBm100 && !isGuest ? user?.uid : null);
  const lepEngine = useLepTaskEngine(canOpenLep && !isGuest ? user?.uid : null);
  const streak = useStreakAnalytics(!isGuest && user?.uid ? user.uid : null);

  useEffect(() => {
    if (authLoading) return undefined;
    if (!user || isGuest || isBlocked) {
      setLoading(false);
      return undefined;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError('');
      try {
        const [list, allAnnouncements, acts, events] = await Promise.all([
          getCourses(),
          getAnnouncements(),
          getUserActivities(user.uid, 40),
          getEvents(),
        ]);
        if (cancelled) return;

        setCourses(list);
        setAnnouncements(getActiveAnnouncementsForUser(allAnnouncements, user.uid));
        setActivities(acts);
        setVisibleEvents(
          resolveVisibleEvents(events, {
            role,
            batchId: profile?.batchId || '',
            moderatedBatchIds,
          })
        );
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setLoadError('We could not load your dashboard. Check your connection and try again.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    authLoading,
    user,
    isGuest,
    isBlocked,
    user?.uid,
    profile?.batchId,
    profile?.enrolledCourses,
    role,
    moderatedKey,
    reloadKey,
  ]);

  const enginesReady =
    (!canOpenMbw || !mbwEngine.loading) &&
    (!canOpenBm100 || !bm100Engine.loading) &&
    (!canOpenLep || !lepEngine.loading) &&
    !streak.loading;

  const data = useMemo(() => {
    if (!user || isGuest || isBlocked || loading || loadError) return null;
    return buildStitchHomeDashboard({
      user,
      profile,
      role,
      courses,
      announcements,
      activities,
      visibleEvents,
      engines: {
        mbw: mbwEngine,
        bm100: bm100Engine,
        lep: lepEngine,
      },
      streakSummary: streak.summary,
    });
  }, [
    user,
    isGuest,
    isBlocked,
    loading,
    loadError,
    profile,
    role,
    courses,
    announcements,
    activities,
    visibleEvents,
    mbwEngine,
    bm100Engine,
    lepEngine,
    streak.summary,
  ]);

  if (authLoading || (user && !isGuest && !isBlocked && (loading || !enginesReady) && !loadError)) {
    return (
      <div className="page">
        <DashboardSkeleton />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="page">
        <EmptyState
          icon={LogIn}
          title="Sign in required"
          message="Sign in to see your programmes, progress, and practice streak."
          action={
            <Link className="btn btn-primary" to="/auth/login">
              Sign in
            </Link>
          }
        />
      </div>
    );
  }

  if (isGuest) {
    return (
      <div className="page">
        <EmptyState
          icon={LogIn}
          title="Guest preview"
          message="Create an account or sign in to unlock courses, lessons, enrollment, and progress tracking."
          action={
            <Link className="btn btn-primary" to="/auth/login">
              Sign in to continue
            </Link>
          }
        />
      </div>
    );
  }

  if (isBlocked) {
    return (
      <div className="page">
        <EmptyState
          icon={ShieldAlert}
          title="Access restricted"
          message="Your account cannot open the learner dashboard. Contact admin@iamironlady.com if you need help."
        />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="page">
        <EmptyState
          title="Dashboard unavailable"
          message={loadError}
          action={
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setLoading(true);
                setReloadKey((k) => k + 1);
              }}
            >
              <RefreshCw size={16} strokeWidth={2} aria-hidden />
              Try again
            </button>
          }
        />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="page">
        <EmptyState
          title="No dashboard data"
          message="We could not build your home view yet. Try refreshing."
          action={
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setReloadKey((k) => k + 1)}
            >
              Refresh
            </button>
          }
        />
      </div>
    );
  }

  if (view === 'progress') {
    return <StitchProgress data={data} onLogout={signOut} />;
  }

  if (view === 'browse') {
    return <StitchBrowse data={data} onLogout={signOut} />;
  }

  if (view === 'schedule') {
    /*
     * `data.events`, not the raw `visibleEvents`. The raw records have no
     * `program`, so the schedule fell back to a generic "Session" tag with no
     * dot — the mapped ones carry programme, dateLabel and the deep link.
     */
    return <StitchSchedule data={data} events={data.events} onLogout={signOut} />;
  }

  return <StitchDashboard data={data} onLogout={signOut} />;
}
