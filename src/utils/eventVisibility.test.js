import { describe, expect, test } from 'vitest';
import {
  filterEventsForBatchOnly,
  filterEventsForLearner,
  filterEventsForStaff,
  isGlobalEvent,
  resolveVisibleEvents,
  isStaffRole,
} from './eventVisibility.js';

describe('eventVisibility', () => {
  const events = [
    { id: '1', title: 'All-hands', audience: 'all' },
    { id: '2', title: 'Legacy', date: '2026-01-01' },
    { id: '3', title: 'Batch A session', audience: 'batch', batchId: 'batch-a' },
    { id: '4', title: 'Batch B session', audience: 'batch', batchId: 'batch-b' },
  ];

  test('isGlobalEvent treats missing batch as global', () => {
    expect(isGlobalEvent(events[0])).toBe(true);
    expect(isGlobalEvent(events[1])).toBe(true);
    expect(isGlobalEvent(events[2])).toBe(false);
  });

  test('filterEventsForBatchOnly returns only that batch', () => {
    expect(filterEventsForBatchOnly(events, 'batch-a').map((e) => e.id)).toEqual(['3']);
    expect(filterEventsForBatchOnly(events, null)).toEqual([]);
  });

  test('filterEventsForLearner includes global + own batch', () => {
    expect(filterEventsForLearner(events, { batchId: 'batch-a' }).map((e) => e.id)).toEqual([
      '1',
      '2',
      '3',
    ]);
  });

  test('filterEventsForStaff includes moderated batches', () => {
    expect(
      filterEventsForStaff(events, { moderatedBatchIds: ['batch-b'] }).map((e) => e.id)
    ).toEqual(['1', '2', '4']);
  });
});

describe('resolveVisibleEvents — one answer for Home and Calendar', () => {
  const GLOBAL = { id: 'g1', title: 'All-hands', date: '2026-09-01', audience: 'all' };
  const JULY = {
    id: 'j1',
    title: 'Session 3',
    date: '2026-09-05',
    batchId: 'batch-july',
    audience: 'batch',
  };
  const SEPT = {
    id: 's1',
    title: 'Other cohort',
    date: '2026-09-06',
    batchId: 'batch-sept',
    audience: 'batch',
  };
  const ALL = [GLOBAL, JULY, SEPT];
  const ids = (list) => list.map((e) => e.id).sort();

  test('gives a learner their own batch and the global events', () => {
    expect(ids(resolveVisibleEvents(ALL, { role: 'student', batchId: 'batch-july' }))).toEqual([
      'g1',
      'j1',
    ]);
  });

  test('never gives a learner another batch s sessions', () => {
    const seen = resolveVisibleEvents(ALL, { role: 'student', batchId: 'batch-sept' });
    expect(seen.some((e) => e.batchId === 'batch-july')).toBe(false);
  });

  test('gives a learner with no batch only the global events', () => {
    expect(ids(resolveVisibleEvents(ALL, { role: 'student', batchId: '' }))).toEqual(['g1']);
  });

  test('gives a moderator the batches they moderate, not the one they belong to', () => {
    const seen = resolveVisibleEvents(ALL, {
      role: 'moderator',
      batchId: 'batch-sept',
      moderatedBatchIds: ['batch-july'],
    });
    expect(ids(seen)).toEqual(['g1', 'j1']);
  });

  test('gives an admin every batch handed to it', () => {
    const seen = resolveVisibleEvents(ALL, {
      role: 'admin',
      batchId: 'batch-2020',
      moderatedBatchIds: ['batch-july', 'batch-sept'],
    });
    expect(ids(seen)).toEqual(['g1', 'j1', 's1']);
  });

  test('falls back to global only when a staff viewer has no batches yet', () => {
    // The batch list loads after first render; until it arrives, staff must not
    // see a stranger's batch, and must not see the batch they merely belong to.
    expect(ids(resolveVisibleEvents(ALL, { role: 'admin', batchId: 'batch-july' }))).toEqual([
      'g1',
    ]);
  });

  test('answers identically however the two pages ask', () => {
    // The regression this exists for: Home filtered as a learner while the
    // Calendar filtered as staff, so a moderator saw a session on one page and
    // "No live sessions scheduled" on the other.
    const viewer = {
      role: 'moderator',
      batchId: 'batch-2020',
      moderatedBatchIds: ['batch-july'],
    };
    const home = resolveVisibleEvents(ALL, viewer);
    const calendar = resolveVisibleEvents(ALL, viewer);
    expect(ids(home)).toEqual(ids(calendar));
    expect(ids(home)).toEqual(['g1', 'j1']);
  });

  test('knows which roles are staff', () => {
    expect(['moderator', 'admin', 'superadmin'].every(isStaffRole)).toBe(true);
    expect([undefined, '', 'student', 'learner', 'guest'].some(isStaffRole)).toBe(false);
  });
});
