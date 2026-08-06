import { createContext, useContext, useMemo } from 'react';
import { useAuth } from './AuthContext';
import { useStreakAnalytics } from '../hooks/useStreakAnalytics';

const StreakAnalyticsContext = createContext(null);

/** One streak listener per student session — avoids duplicate reads on every page. */
export function StreakAnalyticsProvider({ children }) {
  const { user, isGuest } = useAuth();
  const learnerId = isGuest ? null : user?.uid ?? null;
  const analytics = useStreakAnalytics(learnerId, { activityLimit: 90 });

  const value = useMemo(
    () => analytics,
    [analytics.summary, analytics.events, analytics.loading, analytics.warning, analytics.isLive, analytics.retry]
  );

  return (
    <StreakAnalyticsContext.Provider value={value}>{children}</StreakAnalyticsContext.Provider>
  );
}

export function useStreakAnalyticsContext() {
  return useContext(StreakAnalyticsContext);
}
