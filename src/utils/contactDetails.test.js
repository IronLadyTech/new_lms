import { describe, it, expect } from 'vitest';
import {
  toE164,
  hasMessagingConsent,
  reachability,
  summariseReachability,
  CONSENT_SOURCES,
} from './contactDetails';

/**
 * A number that cannot be delivered to does not error — it just never arrives,
 * while the reminder shows as sent. So the cases here are the ways people
 * actually write numbers, not the way a form would like them written.
 */
describe('toE164', () => {
  const valid = [
    ['plain ten digits', '9876543210'],
    ['with country code', '919876543210'],
    ['with a plus', '+919876543210'],
    ['leading zero', '09876543210'],
    ['spaced', '+91 98765 43210'],
    ['dashed', '+91-98765-43210'],
    ['bracketed', '(+91) 9876543210'],
    ['trailing space', '9876543210 '],
    ['zero then country code', '0919876543210'],
  ];

  for (const [name, input] of valid) {
    it(`accepts ${name}`, () => {
      expect(toE164(input)).toEqual({ e164: '+919876543210', ok: true, reason: null });
    });
  }

  it('reports a missing number as missing, not as invalid', () => {
    // These need chasing by different people, so they must not collapse together.
    expect(toE164('').reason).toBe('missing');
    expect(toE164(null).reason).toBe('missing');
    expect(toE164(undefined).reason).toBe('missing');
  });

  it('rejects a number that is too short', () => {
    expect(toE164('98765').ok).toBe(false);
    expect(toE164('98765').reason).toBe('too short');
  });

  it('cannot tell a landline from a mobile, and does not pretend to', () => {
    /*
     * 08041234567 is a Bangalore landline: STD code 080 then eight digits. Drop
     * the leading zero, as we must for numbers written domestically, and what is
     * left is indistinguishable from a mobile. No rule separates them, so this
     * passes validation and will simply never be delivered to — which the
     * delivery receipts catch, and no amount of parsing here would.
     */
    expect(toE164('08041234567').ok).toBe(true);
  });

  it('rejects text that merely contains digits', () => {
    expect(toE164('call me').ok).toBe(false);
    expect(toE164('n/a').ok).toBe(false);
  });

  it('never returns a number it could not validate', () => {
    for (const bad of ['', '123', 'abc', '00000', '12345678901234']) {
      expect(toE164(bad).e164).toBeNull();
    }
  });
});

describe('hasMessagingConsent', () => {
  it('requires consent to be explicitly given', () => {
    expect(hasMessagingConsent({ messagingConsent: { granted: true } })).toBe(true);
  });

  it('treats anything else as not given', () => {
    // Silence is not consent — the point of asking is to be able to show a yes.
    expect(hasMessagingConsent({})).toBe(false);
    expect(hasMessagingConsent(null)).toBe(false);
    expect(hasMessagingConsent({ messagingConsent: {} })).toBe(false);
    expect(hasMessagingConsent({ messagingConsent: { granted: false } })).toBe(false);
    expect(hasMessagingConsent({ messagingConsent: { granted: 'yes' } })).toBe(false);
  });
});

describe('reachability', () => {
  const consented = { messagingConsent: { granted: true, source: CONSENT_SOURCES.ENROLMENT } };

  it('is reachable with consent and a usable number', () => {
    const r = reachability({ ...consented, phone: '+91 98765 43210' });
    expect(r).toEqual({ reachable: true, reason: null, e164: '+919876543210' });
  });

  it('says which of the two is missing', () => {
    expect(reachability({ phone: '9876543210' }).reason).toBe('no consent');
    expect(reachability(consented).reason).toBe('phone missing');
    expect(reachability({ ...consented, phone: '12345' }).reason).toBe('phone too short');
  });

  it('never yields a number for someone who did not consent', () => {
    expect(reachability({ phone: '9876543210' }).e164).toBeNull();
  });
});

describe('summariseReachability', () => {
  it('counts the cohort and groups what is blocking the rest', () => {
    const yes = { messagingConsent: { granted: true }, phone: '9876543210' };
    const summary = summariseReachability([
      yes,
      yes,
      { messagingConsent: { granted: true } },
      { phone: '9876543210' },
      { messagingConsent: { granted: true }, phone: '123' },
    ]);

    expect(summary.total).toBe(5);
    expect(summary.reachable).toBe(2);
    expect(summary.byReason['phone missing']).toBe(1);
    expect(summary.byReason['no consent']).toBe(1);
    expect(summary.byReason['phone too short']).toBe(1);
  });

  it('handles an empty cohort', () => {
    expect(summariseReachability([])).toEqual({ total: 0, reachable: 0, byReason: {} });
  });
});
