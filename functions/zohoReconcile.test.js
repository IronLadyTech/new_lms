import { describe, it, expect } from 'vitest';
import reconcile from './zohoReconcile.js';

const { queryFloor, toCoqlTime, buildQuery, decideAction, runReconcile, OVERLAP_MS } = reconcile;

/**
 * The reconciler.
 *
 * It exists because every other path into the LMS is Zoho deciding to push, so
 * when Zoho does not fire, nothing tries again. That makes two properties
 * load-bearing, and both are easy to break without noticing:
 *
 *   - a failed record must not be stepped over, or the reconciler quietly
 *     becomes the same fire-and-forget it was built to replace;
 *   - a record modified in the seam between two runs must still be seen.
 *
 * The rest is about not spending Zoho's API credits on records that need
 * nothing, since IL Users is touched constantly by edits unrelated to access.
 */

const NOW = new Date('2026-08-22T10:00:00.000Z');

const row = (over = {}) => ({
  id: '1',
  Email: 'learner@example.com',
  Program_Registration_Details: 'Leadership Essentials Program',
  Program_Enrollment_Details: '',
  Modified_Time: '2026-08-22T09:59:00+00:00',
  ...over,
});

function harness(rows, over = {}) {
  const calls = { provisioned: [], refreshed: [], failures: [], watermarks: [] };
  const deps = {
    readWatermark: async () => over.watermark ?? '2026-08-22T09:00:00.000Z',
    queryIlUsers: async () => rows,
    hasAccount: async (email) => (over.accounts || []).includes(email),
    provision: async (email) => {
      calls.provisioned.push(email);
      return over.provisionResult || { ok: true };
    },
    applyEntitlements: async (email) => {
      calls.refreshed.push(email);
      return over.entitlementResult || { ok: true };
    },
    recordFailure: async (email, err) => calls.failures.push({ email, err }),
    writeWatermark: async (v) => calls.watermarks.push(v),
  };
  return { deps, calls };
}

describe('watermark · not missing records in the seam', () => {
  it('reads from slightly before the last run, not exactly from it', () => {
    /*
     * Zoho stamps Modified_Time with its own clock and indexing is not instant,
     * so a record saved in the same second the last run ended can surface just
     * after it. Querying from the exact watermark drops that record forever.
     */
    const floor = queryFloor('2026-08-22T09:00:00.000Z', NOW);
    expect(new Date(floor).getTime()).toBe(new Date('2026-08-22T09:00:00.000Z').getTime() - OVERLAP_MS);
  });

  it('falls back to a bounded window on a first ever run', () => {
    // Not the beginning of time: a full sweep would exhaust Zoho's credits and
    // leave the watermark unset, so the next run would do it again.
    const floor = new Date(queryFloor(null, NOW));
    const hoursBack = (NOW - floor) / 3600000;
    expect(hoursBack).toBeGreaterThan(1);
    expect(hoursBack).toBeLessThanOrEqual(24);
  });

  it('never reads into the future, whatever was stored', () => {
    const floor = new Date(queryFloor('2099-01-01T00:00:00.000Z', NOW));
    expect(floor.getTime()).toBeLessThanOrEqual(NOW.getTime());
  });

  it('survives a corrupted watermark', () => {
    for (const bad of ['not-a-date', '', undefined, null]) {
      expect(() => queryFloor(bad, NOW)).not.toThrow();
      expect(new Date(queryFloor(bad, NOW)).getTime()).not.toBeNaN();
    }
  });
});

describe('query · the shape Zoho accepts', () => {
  it('formats time with an offset and no milliseconds', () => {
    // The same rule that silently blocked the whole outbound sync.
    const t = toCoqlTime('2026-08-22T10:00:00.123Z');
    expect(t).toBe('2026-08-22T10:00:00+00:00');
    expect(t).not.toMatch(/\.\d{3}/);
    expect(t).not.toMatch(/Z$/);
  });

  it('orders ascending so the watermark advances monotonically', () => {
    // Descending order would advance the watermark past records not yet handled.
    const q = buildQuery('2026-08-22T09:00:00.000Z', 'IL_Users', 200);
    expect(q).toContain('order by Modified_Time asc');
    expect(q).toContain('limit 200');
  });

  it('asks for the two programme fields that decide access', () => {
    const q = buildQuery('2026-08-22T09:00:00.000Z', 'IL_Users', 10);
    expect(q).toContain('Program_Registration_Details');
    expect(q).toContain('Program_Enrollment_Details');
  });
});

describe('deciding what a record needs', () => {
  it('provisions a registered learner with no account', () => {
    // The gap this whole thing exists to close.
    const d = decideAction(row(), false);
    expect(d.action).toBe('provision');
  });

  it('refreshes entitlements for a learner who already has one', () => {
    expect(decideAction(row(), true).action).toBe('entitlements');
  });

  it('skips a record naming no programme', () => {
    /*
     * IL Users is edited constantly for names and phone numbers. Acting on
     * those would spend two Zoho lookups a head for nothing.
     */
    const d = decideAction(row({ Program_Registration_Details: '', Program_Enrollment_Details: '' }), false);
    expect(d.action).toBe('skip');
    expect(d.reason).toBe('no-programme');
  });

  it('skips a record with no email — there is nothing to provision against', () => {
    expect(decideAction(row({ Email: '' }), false).action).toBe('skip');
    expect(decideAction(row({ Email: null }), false).action).toBe('skip');
  });

  it('acts on an enrolment-only record, not just registration', () => {
    const d = decideAction(
      row({ Program_Registration_Details: '', Program_Enrollment_Details: 'Master of Business Warfare' }),
      false
    );
    expect(d.action).toBe('provision');
  });

  it('does not throw on a malformed row', () => {
    for (const bad of [null, undefined, {}, { Email: 42 }]) {
      expect(() => decideAction(bad, false)).not.toThrow();
    }
  });
});

describe('a run · what it does', () => {
  it('provisions the missing and refreshes the present', async () => {
    const rows = [
      row({ id: '1', Email: 'new@example.com' }),
      row({ id: '2', Email: 'existing@example.com' }),
    ];
    const { deps, calls } = harness(rows, { accounts: ['existing@example.com'] });
    const r = await runReconcile(deps, { now: NOW });

    expect(calls.provisioned).toEqual(['new@example.com']);
    expect(calls.refreshed).toEqual(['existing@example.com']);
    expect(r.provisioned).toBe(1);
    expect(r.refreshed).toBe(1);
    expect(r.failed).toBe(0);
  });

  it('advances the watermark to the newest record handled', async () => {
    const rows = [
      row({ id: '1', Modified_Time: '2026-08-22T09:30:00+00:00' }),
      row({ id: '2', Email: 'b@example.com', Modified_Time: '2026-08-22T09:45:00+00:00' }),
    ];
    const { deps, calls } = harness(rows);
    await runReconcile(deps, { now: NOW });
    expect(calls.watermarks).toEqual(['2026-08-22T09:45:00+00:00']);
  });
});

describe('a run · when something fails', () => {
  it('leaves the watermark behind the failed record', async () => {
    /*
     * The property that separates a reconciler from the fire-and-forget it
     * replaces. Advancing past a failure means nothing ever retries it, which
     * is exactly the behaviour that lost thirty-one learners.
     */
    const rows = [row({ id: '1', Email: 'boom@example.com' })];
    const { deps, calls } = harness(rows, { provisionResult: { ok: false, reason: 'no password' } });
    const r = await runReconcile(deps, { now: NOW });

    expect(r.failed).toBe(1);
    expect(calls.watermarks).toEqual([]);
  });

  it('records the failure so the digest reports it', async () => {
    const { deps, calls } = harness([row({ Email: 'boom@example.com' })], {
      provisionResult: { ok: false, reason: 'no password on IL_Registration' },
    });
    await runReconcile(deps, { now: NOW });
    expect(calls.failures).toHaveLength(1);
    expect(calls.failures[0].err).toContain('no password');
  });

  it('stops at the first failure rather than stepping over it', async () => {
    const rows = [
      row({ id: '1', Email: 'boom@example.com', Modified_Time: '2026-08-22T09:10:00+00:00' }),
      row({ id: '2', Email: 'later@example.com', Modified_Time: '2026-08-22T09:20:00+00:00' }),
    ];
    const { deps, calls } = harness(rows, { provisionResult: { ok: false, reason: 'x' } });
    await runReconcile(deps, { now: NOW });
    // The second record is not attempted, and the watermark stays put, so the
    // next run retries both in order.
    expect(calls.provisioned).toEqual(['boom@example.com']);
    expect(calls.watermarks).toEqual([]);
  });

  it('survives a dependency throwing', async () => {
    const { deps } = harness([row()]);
    deps.provision = async () => {
      throw new Error('Zoho timeout');
    };
    const r = await runReconcile(deps, { now: NOW });
    expect(r.failed).toBe(1);
    expect(r.ok).toBe(true);
  });
});

describe('a run · dry run', () => {
  it('writes nothing at all', async () => {
    const rows = [row({ Email: 'new@example.com' })];
    const { deps, calls } = harness(rows);
    const r = await runReconcile(deps, { dryRun: true, now: NOW });

    expect(calls.provisioned).toEqual([]);
    expect(calls.refreshed).toEqual([]);
    expect(calls.watermarks).toEqual([]);
    expect(r.dryRun).toBe(true);
  });

  it('still reports what it would have done', async () => {
    const { deps } = harness([row({ Email: 'new@example.com' })]);
    const r = await runReconcile(deps, { dryRun: true, now: NOW });
    expect(r.sample[0].action).toBe('provision');
    expect(r.scanned).toBe(1);
  });

  it('does not move the watermark, so live work is not hidden', async () => {
    // A dry run that advanced the watermark would make the next live run skip
    // exactly the records the dry run just found.
    const { deps } = harness([row()], { watermark: '2026-08-22T09:00:00.000Z' });
    const r = await runReconcile(deps, { dryRun: true, now: NOW });
    expect(r.watermark).toBe('2026-08-22T09:00:00.000Z');
  });
});

describe('a run · quiet periods', () => {
  it('does nothing and writes nothing when Zoho returns no changes', async () => {
    const { deps, calls } = harness([]);
    const r = await runReconcile(deps, { now: NOW });
    expect(r.scanned).toBe(0);
    expect(calls.watermarks).toEqual([]);
  });
});
