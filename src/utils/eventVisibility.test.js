import { describe, expect, test } from 'vitest';
import {
  filterEventsForBatchOnly,
  filterEventsForLearner,
  filterEventsForStaff,
  isGlobalEvent,
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
