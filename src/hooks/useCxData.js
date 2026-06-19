import { useCallback, useEffect, useMemo, useState } from 'react';
import { getGroups } from '../services/groupService';
import { getAllUsers } from '../services/userService';
import { memberIdsForBatches, filterStudentsForBatches } from '../utils/batchScope';
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
      const [groups, allUsers, taskList, subs] = await Promise.all([
        getGroups(),
        getAllUsers(),
        adapter.getTasks(),
        adapter.getSubmissions(),
      ]);
      setBatches(groups.filter((g) => (g.program || PROGRAMS.MBW) === program));
      setUsers(allUsers);
      setTasks(taskList);
      setAllSubmissions(subs);
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
    () => filterStudentsForBatches(users, batches, 'all'),
    [users, batches]
  );

  const submissions = useMemo(() => {
    const memberIds = new Set(memberIdsForBatches(batches));
    students.forEach((s) => memberIds.add(s.id));
    return allSubmissions.filter((s) => memberIds.has(s.userId));
  }, [allSubmissions, batches, students]);

  return { batches, users, students, tasks, submissions, loading, error, refresh: load };
}
