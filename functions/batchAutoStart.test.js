import { describe, it, expect } from 'vitest';
import { autoStartReadyBatches, whyNotAutoStart, istToday } from './batchAutoStart.js';

/**
 * What goes wrong for CX and learners: a ready batch gets no reminders because nobody
 * pressed Start; a paused batch restarts on its own; an old batch suddenly sends again.
 */
const TODAY = '2026-11-05';
const ready = {
  status: 'draft',
  automationEnabled: false,
  day1Date: '2026-11-14',
  lmsGroupId: 'grp1',
  sessions: [{ code: 'S1', date: '2026-11-14' }, { code: 'S8', date: '2026-12-12' }],
};

describe('which batches start by themselves', () => {
  it('a ready batch starts', () => {
    expect(whyNotAutoStart(ready, TODAY)).toBeNull();
  });
  it('not a batch CX paused (live, reminders off)', () => {
    expect(whyNotAutoStart({ ...ready, status: 'live' }, TODAY)).toBe('already-started-or-paused');
    expect(whyNotAutoStart({ ...ready, remindersPaused: true }, TODAY)).toBe('paused-by-cx');
  });
  it('not until it is ready: dates, schedule, learners', () => {
    expect(whyNotAutoStart({ ...ready, day1Date: '' }, TODAY)).toBe('no-dates');
    expect(whyNotAutoStart({ ...ready, sessions: [] }, TODAY)).toBe('no-sessions');
    expect(whyNotAutoStart({ ...ready, sessions: [{ date: '2026-11-14', cancelled: true }] }, TODAY)).toBe('no-sessions');
    expect(whyNotAutoStart({ ...ready, lmsGroupId: '' }, TODAY)).toBe('not-linked');
  });
  it('never an old batch whose sessions are all over', () => {
    expect(whyNotAutoStart({ ...ready, sessions: [{ date: '2026-10-01' }] }, TODAY)).toBe('finished');
  });
  it('a batch whose last session is today still starts', () => {
    expect(whyNotAutoStart({ ...ready, sessions: [{ date: TODAY }] }, TODAY)).toBeNull();
  });
  it('India date, not UTC: 1 AM IST is already the next day', () => {
    expect(istToday(Date.UTC(2026, 10, 4, 19, 30))).toBe('2026-11-05');
  });
});

describe('the run', () => {
  it('switches on only the ready ones', async () => {
    const docs = {
      a: { ...ready },
      b: { ...ready, lmsGroupId: '' },
      c: { ...ready, status: 'live', automationEnabled: false },
    };
    const writes = {};
    const db = {
      collection: () => ({
        get: async () => ({
          docs: Object.entries(docs).map(([id, data]) => ({
            id,
            data: () => data,
            ref: { set: async (patch) => (writes[id] = patch) },
          })),
        }),
      }),
    };
    const started = await autoStartReadyBatches(db, Date.UTC(2026, 10, 5, 6, 0));
    expect(started).toEqual(['a']);
    expect(writes.a).toMatchObject({ status: 'live', automationEnabled: true });
    expect(writes.b).toBeUndefined();
    expect(writes.c).toBeUndefined();
  });
});
