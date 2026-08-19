import { describe, it, expect } from 'vitest';
import { groupFailures, buildFailureDigest, ALERT_TO } from './syncAlerts.js';

/**
 * The sync failure digest.
 *
 * The outbound sync failed for every learner for weeks and nobody knew, because
 * failures went to the Cloud Function log and nowhere else. These tests hold
 * down the two ways an alert stops being useful: saying nothing when something
 * is wrong, and saying so much that it gets filtered.
 */

const fail = (email, message) => ({ email, message });

const BULK = Array.from({ length: 500 }, (_, i) =>
  fail(`learner${i}@example.com`, 'invalid data ({"api_name":"LMS_Password_Updated_At"})')
);

describe('digest · when it stays quiet', () => {
  it('sends nothing when there is nothing wrong', () => {
    // An hourly "0 failures" mail trains people to ignore the alert entirely.
    for (const empty of [[], null, undefined, [null, undefined]]) {
      expect(buildFailureDigest(empty)).toBeNull();
    }
  });
});

describe('digest · when it speaks up', () => {
  it('goes to the address that is watching', () => {
    expect(buildFailureDigest([fail('a@x.com', 'boom')]).to).toBe(ALERT_TO);
  });

  it('collapses a whole failed cohort into one mail', () => {
    /*
     * The case that matters: a bulk sync fails identically for everybody. One
     * mail, one cause, the real count — not 500 mails.
     */
    const digest = buildFailureDigest(BULK);
    expect(digest.total).toBe(500);
    expect(digest.groups).toHaveLength(1);
    expect(digest.groups[0].count).toBe(500);
  });

  it('puts the count and the number of causes in the subject', () => {
    // The subject has to carry the situation; nobody opens every alert.
    const digest = buildFailureDigest([...BULK, fail('z@x.com', 'timeout')]);
    expect(digest.subject).toContain('501');
    expect(digest.subject).toContain('2 causes');
  });

  it('names the offending field, which is the whole point', () => {
    const digest = buildFailureDigest(BULK);
    expect(digest.text).toContain('LMS_Password_Updated_At');
    expect(digest.html).toContain('LMS_Password_Updated_At');
  });

  it('shows the biggest cause first', () => {
    const digest = buildFailureDigest([
      fail('a@x.com', 'rare'),
      ...BULK,
      fail('b@x.com', 'rare'),
    ]);
    expect(digest.groups[0].count).toBe(500);
    expect(digest.groups[1].count).toBe(2);
  });

  it('gives a few examples but not the whole cohort', () => {
    const digest = buildFailureDigest(BULK);
    expect(digest.groups[0].examples).toHaveLength(3);
  });
});

describe('digest · hostile and malformed input', () => {
  it('does not let an error message inject markup into the mail', () => {
    // Error text is not ours; some of it is echoed from Zoho.
    const digest = buildFailureDigest([fail('a@x.com', '<script>alert(1)</script>')]);
    expect(digest.html).not.toContain('<script>');
    expect(digest.html).toContain('&lt;script&gt;');
  });

  it('still reports a failure that arrived with no message', () => {
    const digest = buildFailureDigest([{ email: 'a@x.com' }]);
    expect(digest.total).toBe(1);
    expect(digest.text).toContain('Unknown error');
  });

  it('still reports a failure that arrived with no email', () => {
    const digest = buildFailureDigest([{ message: 'boom' }]);
    expect(digest.total).toBe(1);
    expect(digest.groups[0].examples).toEqual([]);
  });

  it('does not throw on anything a caller might pass', () => {
    for (const bad of [[{}], [[]], ['string'], [42]]) {
      expect(() => buildFailureDigest(bad)).not.toThrow();
    }
  });
});

describe('grouping', () => {
  it('treats the same cause as one group regardless of who it hit', () => {
    expect(groupFailures([fail('a@x.com', 'boom'), fail('b@x.com', 'boom')])).toHaveLength(1);
  });

  it('keeps genuinely different causes apart', () => {
    expect(groupFailures([fail('a@x.com', 'boom'), fail('b@x.com', 'bang')])).toHaveLength(2);
  });
});
