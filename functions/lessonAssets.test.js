import { describe, it, expect } from 'vitest';
import lessonAssets from './lessonAssets.js';
import accessTiers from './accessTiers.js';

const { resolveLessonAsset, LESSON_ASSETS, knownAssetIds } = lessonAssets;
const { paidContentDecision } = accessTiers;

/**
 * The asset gate.
 *
 * Lesson URLs used to live in the client catalogue, which every browser
 * downloads, so a learner who had paid nothing could read them out of the page
 * and watch paid content. Unlisted YouTube is not a control — it keeps a video
 * out of search and nothing more.
 *
 * This is the only route to a URL now, so these cases are the whole boundary.
 * A learner is entitled when three things hold at once: they are enrolled in
 * the programme, they have paid for it in full, and the access window is still
 * open. Any one of them failing must withhold the URL.
 */

const PAID_ASSET_ID = 'mbw-paid-fixture';
const FIXTURE = { program: 'mbw', requiresPaid: true, url: 'https://example.test/paid.mp4' };

/** Registered for the duration of the file so the real catalogue stays honest. */
LESSON_ASSETS[PAID_ASSET_ID] = FIXTURE;

const learner = ({ tier = 'paid', programme = 'mbw', paidAt = null } = {}) => ({
  program: programme,
  programs: [programme],
  programAccess: { [programme]: { paymentStatus: tier, ...(paidAt ? { fullPaidAt: paidAt } : {}) } },
});

describe('asset gate · who gets a URL', () => {
  it('gives a fully paid, enrolled learner the URL', () => {
    const r = resolveLessonAsset(learner(), PAID_ASSET_ID);
    expect(r.ok).toBe(true);
    expect(r.url).toBe(FIXTURE.url);
  });

  it('withholds it from a registration-tier learner', () => {
    const r = resolveLessonAsset(learner({ tier: 'register' }), PAID_ASSET_ID);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('payment-required');
    expect(r.url).toBeUndefined();
  });

  // null rather than undefined: an undefined argument would fall back to the
  // helper's own default and quietly test the paid case instead.
  it.each(['unpaid', 'failed', 'refunded', 'completed', 'awaiting_settlement', null])(
    'withholds it at tier %s',
    (tier) => {
      const r = resolveLessonAsset(learner({ tier }), PAID_ASSET_ID);
      expect(r.ok).toBe(false);
      expect(r.url).toBeUndefined();
    }
  );

  it('withholds it from someone enrolled in a different programme', () => {
    // Paying for 100BM must not buy MBW media.
    const r = resolveLessonAsset(learner({ programme: '100bm' }), PAID_ASSET_ID);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('not-enrolled');
  });

  it('withholds it once the access window has closed', () => {
    const expired = learner({ paidAt: '2024-01-01T00:00:00.000Z' }); // MBW window is 24 months
    const r = resolveLessonAsset(expired, PAID_ASSET_ID, new Date('2026-08-18T00:00:00.000Z'));
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('access-expired');
  });

  it('still gives it while the window is open', () => {
    const recent = learner({ paidAt: '2026-01-01T00:00:00.000Z' });
    const r = resolveLessonAsset(recent, PAID_ASSET_ID, new Date('2026-08-18T00:00:00.000Z'));
    expect(r.ok).toBe(true);
  });

  it('withholds it from an empty or missing profile', () => {
    for (const p of [null, undefined, {}]) {
      expect(resolveLessonAsset(p, PAID_ASSET_ID).ok).toBe(false);
    }
  });
});

describe('asset gate · free lessons', () => {
  it('serves a free lesson to anyone signed in', () => {
    const freeId = knownAssetIds().find((id) => LESSON_ASSETS[id].requiresPaid === false);
    expect(freeId).toBeTruthy();
    const r = resolveLessonAsset({}, freeId);
    expect(r.ok).toBe(true);
    expect(r.gated).toBe(false);
  });
});

describe('asset gate · probing and malformed input', () => {
  it('does not reveal which lesson ids exist', () => {
    // An unknown id and an unentitled real id must be distinguishable only by
    // the reason the caller is allowed to see, never by whether media exists.
    expect(resolveLessonAsset(learner(), 'no-such-lesson').reason).toBe('not-found');
    expect(resolveLessonAsset(learner(), '../../etc/passwd').reason).toBe('not-found');
  });

  it('rejects a blank id rather than guessing', () => {
    for (const id of ['', '   ', null, undefined]) {
      const r = resolveLessonAsset(learner(), id);
      expect(r.ok).toBe(false);
      expect(r.url).toBeUndefined();
    }
  });

  it('never returns a URL alongside a refusal', () => {
    /*
     * The property that matters most. Every denial path must be free of a URL —
     * a refusal carrying the answer would be worse than no gate at all, because
     * it would look protected.
     */
    const denials = [
      resolveLessonAsset(learner({ tier: 'register' }), PAID_ASSET_ID),
      resolveLessonAsset(learner({ programme: '100bm' }), PAID_ASSET_ID),
      resolveLessonAsset({}, PAID_ASSET_ID),
      resolveLessonAsset(learner(), 'no-such-lesson'),
      resolveLessonAsset(learner(), ''),
    ];
    denials.forEach((d) => {
      expect(d.ok).toBe(false);
      expect(d.url).toBeUndefined();
      expect(JSON.stringify(d)).not.toContain('http');
    });
  });
});

describe('asset gate · the catalogue itself', () => {
  it('declares a programme and a payment requirement for every lesson', () => {
    for (const [id, asset] of Object.entries(LESSON_ASSETS)) {
      expect(asset.program, id).toBeTruthy();
      expect(typeof asset.requiresPaid, id).toBe('boolean');
      expect(asset.url, id).toMatch(/^https?:\/\//);
    }
  });

  it('agrees with the shared entitlement decision', () => {
    // The gate must not grow its own idea of who has paid. If these ever
    // disagree, the UI and the server are telling a learner different things.
    const p = learner({ tier: 'register' });
    expect(paidContentDecision(p, 'mbw').allowed).toBe(false);
    expect(resolveLessonAsset(p, PAID_ASSET_ID).ok).toBe(false);
  });
});
