import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { getGroup } from '../services/groupService';

/**
 * Loads session recordings CX added on the learner's batch (group) doc.
 */
export default function useBatchRecordings() {
  const { profile, isGuest } = useAuth();
  const [recordings, setRecordings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isGuest || !profile?.batchId) {
      setRecordings([]);
      setLoading(false);
      return undefined;
    }

    let alive = true;
    setLoading(true);
    (async () => {
      try {
        const group = await getGroup(profile.batchId);
        if (alive) setRecordings(group?.recordings || []);
      } catch {
        if (alive) setRecordings([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [profile?.batchId, isGuest]);

  return { recordings, loading };
}
