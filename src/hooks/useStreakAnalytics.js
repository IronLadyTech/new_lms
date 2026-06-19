import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  getSubmissionEvents,
  subscribeSubmissionEvents,
  mapActivitiesToSubmissionEvents,
  mapMbwSubmissionsToEvents,
  mergeSubmissionEvents,
} from '../services/submissionEventService';
import { computeStreakSummary } from '../services/streakAnalyticsService';
import { getUserActivities } from '../services/userService';
import { getUserSubmissions } from '../services/mbwService';

const POLL_MS = 45000;

export function useStreakAnalytics(learnerId) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [warning, setWarning] = useState(null);
  const [isLive, setIsLive] = useState(true);
  const legacyRef = useRef([]);
  const pollRef = useRef(null);

  const loadLegacy = useCallback(async () => {
    if (!learnerId) return [];
    try {
      const [activities, mbwSubs] = await Promise.all([
        getUserActivities(learnerId, 500),
        getUserSubmissions(learnerId).catch(() => ({})),
      ]);
      return mergeSubmissionEvents(
        mapActivitiesToSubmissionEvents(activities),
        mapMbwSubmissionsToEvents(mbwSubs, learnerId)
      );
    } catch (err) {
      console.warn('Legacy streak data load failed', err);
      return [];
    }
  }, [learnerId]);

  const refreshData = useCallback(async () => {
    if (!learnerId) {
      setLoading(false);
      return;
    }

    const legacy = await loadLegacy();
    legacyRef.current = legacy;

    let liveEvents = [];
    let liveUnavailable = false;

    try {
      liveEvents = await getSubmissionEvents(learnerId);
    } catch (err) {
      liveUnavailable = true;
      console.warn('learner_submissions read failed — using activity history', err);
    }

    setEvents(mergeSubmissionEvents(liveEvents, legacy));
    setIsLive(!liveUnavailable);
    setWarning(
      liveUnavailable
        ? 'Live sync unavailable — showing your course activity and MBW submissions. Deploy Firestore rules for instant updates.'
        : null
    );
    setLoading(false);
  }, [learnerId, loadLegacy]);

  useEffect(() => {
    if (!learnerId) {
      setLoading(false);
      return undefined;
    }

    let cancelled = false;
    const unsubRef = { current: () => {} };

    (async () => {
      setLoading(true);
      await refreshData();
      if (cancelled) return;

      unsubRef.current = subscribeSubmissionEvents(
        learnerId,
        (liveEvents) => {
          if (cancelled) return;
          setEvents(mergeSubmissionEvents(liveEvents, legacyRef.current));
          setLoading(false);
          setWarning(null);
          setIsLive(true);
        },
        (err) => {
          if (cancelled) return;
          console.warn('Submission listener failed — polling activity history', err);
          setIsLive(false);
          if (!pollRef.current) {
            pollRef.current = window.setInterval(() => {
              if (!cancelled) refreshData();
            }, POLL_MS);
          }
        }
      );
    })();

    return () => {
      cancelled = true;
      unsubRef.current();
      if (pollRef.current) {
        window.clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [learnerId, refreshData]);

  const summary = useMemo(() => computeStreakSummary(events), [events]);

  return { summary, events, loading, warning, isLive, retry: refreshData };
}
