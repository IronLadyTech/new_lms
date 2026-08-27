import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { getGroupsByProgram } from '../services/groupService';
import { isStaffRole } from '../utils/eventVisibility';
import { PROGRAMS } from '../data/programTypes';

/**
 * The batches a staff viewer is entitled to see.
 *
 * A full admin gets every batch in their programme; a moderator gets only the
 * ones they moderate or created. Learners get none — their visibility comes
 * from the batch they belong to, not one they run.
 *
 * Lifted out of the Calendar page so the dashboard can ask the same question
 * and get the same answer. Asking it twice is what let the two pages disagree.
 */
export default function useModeratedBatchIds() {
  const { user, profile, role, isGuest } = useAuth();
  const [batchIds, setBatchIds] = useState([]);
  const [loading, setLoading] = useState(false);

  const isStaff = isStaffRole(role);
  const isFullAdmin = role === 'admin' || role === 'superadmin';
  const program = profile?.program || PROGRAMS.MBW;
  const uid = user?.uid;

  const load = useCallback(async () => {
    if (isGuest || !isStaff || !uid) {
      setBatchIds([]);
      return;
    }
    setLoading(true);
    try {
      const groups = await getGroupsByProgram(program);
      setBatchIds(
        isFullAdmin
          ? groups.map((g) => g.id)
          : groups
              .filter((g) => (g.moderatorIds || []).includes(uid) || g.createdBy === uid)
              .map((g) => g.id)
      );
    } catch (err) {
      console.error(err);
      // An empty list is the safe failure: staff fall back to seeing only
      // global events rather than to seeing every batch.
      setBatchIds([]);
    } finally {
      setLoading(false);
    }
  }, [isGuest, isStaff, uid, isFullAdmin, program]);

  useEffect(() => {
    load();
  }, [load]);

  return { batchIds, isStaff, loading, reload: load };
}
