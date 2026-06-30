import { useCallback, useEffect, useMemo, useState } from 'react';
import { getGroups } from '../services/groupService';
import { getAllUsers } from '../services/userService';
import { memberIdsForBatches, filterStudentsForBatches } from '../utils/batchScope';
import { filterCxTasks } from '../utils/cxMetrics';
import { PROGRAMS } from '../data/programTypes';

/**
 * Loads everything the CX pages need, scoped to one program:
 * batches of that program, their learners, and the program's tasks + submissions.
 */
export function useCxData(program, adapter) {
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
      const [groupsResult, usersResult, tasksResult, subsResult] = await Promise.allSettled([
        getGroups(),
        getAllUsers(),
        adapter.getTasks(),
        adapter.getSubmissions(),
      ]);

      const failures = [];
      const groups = groupsResult.status === 'fulfilled' ? groupsResult.value : [];
      const allUsers = usersResult.status === 'fulfilled' ? usersResult.value : [];
      const taskList = tasksResult.status === 'fulfilled' ? tasksResult.value : [];
      const subs = subsResult.status === 'fulfilled' ? subsResult.value : [];

      if (groupsResult.status === 'rejected') failures.push('batches');
      if (usersResult.status === 'rejected') failures.push('learners');
      if (tasksResult.status === 'rejected') failures.push('tasks');
      if (subsResult.status === 'rejected') failures.push('submissions');

      const programBatches = groups.filter((g) => (g.program || PROGRAMS.MBW) === program);
      setBatches(programBatches);
      setUsers(allUsers);
      setTasks(filterCxTasks(taskList, program));
      setAllSubmissions(subs);

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
  }, [program, adapter]);

  useEffect(() => {
    load();
  }, [load]);

  const students = useMemo(
    () => filterStudentsForBatches(users, batches, 'all', { program }),
    [users, batches, program]
  );

  const submissions = useMemo(() => {
    const studentIds = new Set(students.map((s) => s.id));
    return allSubmissions.filter((s) => studentIds.has(s.userId));
  }, [allSubmissions, students]);

  return { batches, users, students, tasks, submissions, loading, error, refresh: load };
}
