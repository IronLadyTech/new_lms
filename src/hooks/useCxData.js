import { useCallback, useEffect, useMemo, useState } from 'react';
import { getGroupsByProgram } from '../services/groupService';
import { getUsersForCxProgram, getUsersByIds } from '../services/userService';
import { filterStudentsForBatches } from '../utils/batchScope';
import { filterCxTasks } from '../utils/cxMetrics';
import { PROGRAMS } from '../data/programTypes';
import { useAuth } from '../context/AuthContext';
import { isFullAdmin } from '../utils/roles';

function scopeBatchesForUser(batches, userId, fullAccess) {
  if (fullAccess || !userId) return batches;
  return batches.filter((b) => (b.moderatorIds || []).includes(userId) || b.createdBy === userId);
}

/**
 * Loads CX data scoped to one program.
 * Users + submissions are queried by batch/program/status — not full collection dumps.
 */
export function useCxData(program, adapter) {
  const { user, role } = useAuth();
  const fullBatchAccess = isFullAdmin(role);
  const [batches, setBatches] = useState([]);
  const [users, setUsers] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [allSubmissions, setAllSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const failures = [];

      const [groupsResult, tasksResult] = await Promise.allSettled([
        getGroupsByProgram(program),
        adapter.getTasks(),
      ]);

      let programBatches = groupsResult.status === 'fulfilled' ? groupsResult.value : [];
      const taskList = tasksResult.status === 'fulfilled' ? tasksResult.value : [];
      if (groupsResult.status === 'rejected') failures.push('batches');
      if (tasksResult.status === 'rejected') failures.push('tasks');

      programBatches = scopeBatchesForUser(programBatches, user?.uid, fullBatchAccess);

      const batchIds = programBatches.map((b) => b.id).filter(Boolean);

      setBatches(programBatches);
      setTasks(taskList || []);

      const loadSubmissions =
        !batchIds.length && adapter.getAllSubmissions
          ? adapter.getAllSubmissions()
          : adapter.getSubmissions
            ? adapter.getSubmissions({ batchIds, includePending: true })
            : Promise.resolve([]);

      const [usersResult, subsResult] = await Promise.allSettled([
        getUsersForCxProgram(program, programBatches),
        loadSubmissions,
      ]);

      let scopedUsers = usersResult.status === 'fulfilled' ? usersResult.value : [];
      let subs = subsResult.status === 'fulfilled' ? subsResult.value : [];
      if (usersResult.status === 'rejected') failures.push('learners');
      if (subsResult.status === 'rejected') failures.push('submissions');

      if (!subs?.length && adapter.getAllSubmissions) {
        try {
          subs = await adapter.getAllSubmissions();
        } catch {
          /* keep scoped (empty) result */
        }
      }

      const knownIds = new Set(scopedUsers.map((u) => u.id));
      const missingIds = [...new Set((subs || []).map((s) => s.userId))].filter(
        (id) => id && !knownIds.has(id)
      );
      if (missingIds.length) {
        try {
          const extra = await getUsersByIds(missingIds);
          scopedUsers = [...scopedUsers, ...extra];
        } catch {
          /* submissions from unknown users stay hidden */
        }
      }

      setUsers(scopedUsers);
      setAllSubmissions(subs || []);

      if (failures.length) {
        setError(
          `Could not load ${failures.join(', ')}. If you are a moderator, deploy the latest Firestore rules.`
        );
      }
    } catch (e) {
      console.error(e);
      setError(e.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [program, adapter, user?.uid, fullBatchAccess]);

  useEffect(() => {
    load();
  }, [load]);

  const students = useMemo(() => {
    const scoped = filterStudentsForBatches(users, batches, 'all', { program });
    const scopedIds = new Set(scoped.map((s) => s.id));

    const authorIds = new Set((allSubmissions || []).map((s) => s.userId).filter(Boolean));
    const extraAuthors = users.filter(
      (u) => !scopedIds.has(u.id) && authorIds.has(u.id) && (!u.role || u.role === 'student')
    );

    return [...scoped, ...extraAuthors];
  }, [users, batches, program, allSubmissions]);

  const submissions = useMemo(() => {
    const studentIds = new Set(students.map((s) => s.id));
    return allSubmissions.filter((s) => studentIds.has(s.userId));
  }, [allSubmissions, students]);

  const activeTasks = useMemo(() => filterCxTasks(tasks, program), [tasks, program]);

  return {
    batches,
    users,
    students,
    tasks,
    activeTasks,
    submissions,
    allSubmissions,
    loading,
    error,
    refresh: load,
  };
}
