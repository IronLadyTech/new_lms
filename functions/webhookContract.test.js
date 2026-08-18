import { describe, it, expect } from 'vitest';
import provisioning from './zohoProvisioning.js';
import accessTiers from './accessTiers.js';

const { mergeProvisioningRecord, parseEntitlementsFromRecord, isValidBatchName } = provisioning;
const { paymentStatusFromRegistrationPayload, normalizeProgram } = accessTiers;

/**
 * The Zoho → LMS webhook contract.
 *
 * This boundary is where every serious defect of the last week was found, and
 * it had no tests at all. The payloads below are copied from the Deluge that
 * runs in production — `registartion1` and `ConvertPreContacttoContact` — not
 * invented for the test, because the whole class of bug being guarded against
 * is a mismatch between what Zoho sends and what this code expects.
 *
 * The two-stage model is the thing to protect. Registration and enrolment both
 * send the word "Completed"; which field carries it is the only thing
 * separating partial access from full. The enrolment Deluge even carries a
 * comment warning against sending the registration field, because getting this
 * backwards silently hands the whole programme to someone who paid a deposit.
 */

/** Posted when the registration fee clears. Partial access. */
const REGISTRATION_PAYLOAD = {
  email: 'learner@example.com',
  username: 'learner@example.com',
  password: 'Secret123-xX',
  program: '100 Board Members Program',
  paymentstatus: 'Completed',
  fullname: 'A Learner',
  phone: '9999999999',
  lmsUserId: '4321',
};

/** Posted when the programme fee clears. Full access. */
const ENROLMENT_PAYLOAD = {
  email: 'learner@example.com',
  program: '100 Board Members Program',
  fullname: 'A Learner',
  hundredBMPaymentStatus: 'Completed',
  batch: '08/08/2026 - 08/02/2027',
};

/** Posted when CX edits Lead Status. Entitlements only. */
const STATUS_PAYLOAD = {
  mode: 'entitlements',
  email: 'learner@example.com',
  Lead_Status: '100 BM started',
  Program: '100 Board Members Program',
};

const tierOf = (body) => parseEntitlementsFromRecord(mergeProvisioningRecord(null, null, body)).paymentStatus;

describe('contract · the two payment stages', () => {
  it('registration grants the registration tier, not the programme', () => {
    expect(paymentStatusFromRegistrationPayload(REGISTRATION_PAYLOAD)).toBe('register');
    expect(tierOf(REGISTRATION_PAYLOAD)).toBe('register');
  });

  it('enrolment grants the full programme', () => {
    expect(paymentStatusFromRegistrationPayload(ENROLMENT_PAYLOAD)).toBe('paid');
    expect(tierOf(ENROLMENT_PAYLOAD)).toBe('paid');
  });

  it('accepts the programme field for each programme by name', () => {
    for (const field of [
      'lepPaymentStatus',
      'hundredBMPaymentStatus',
      'MBWPaymentStatus',
      'programPaymentStatus',
    ]) {
      expect(paymentStatusFromRegistrationPayload({ [field]: 'Completed' }), field).toBe('paid');
    }
  });

  it('reads the registration field under either spelling', () => {
    expect(paymentStatusFromRegistrationPayload({ paymentstatus: 'Completed' })).toBe('register');
    expect(paymentStatusFromRegistrationPayload({ paymentStatus: 'Completed' })).toBe('register');
  });

  it('ignores a field name that only looks right', () => {
    /*
     * Field names are matched exactly. A Deluge edit to LEP_Payment_Status or
     * lep_payment_status would be silently ignored — no error, no effect, and
     * the learner simply never gets full access. Pinning it here means such a
     * rename fails a test instead of a customer.
     */
    for (const wrong of ['LEP_Payment_Status', 'lep_payment_status', 'PaymentStatusProgram']) {
      expect(paymentStatusFromRegistrationPayload({ [wrong]: 'Completed' }), wrong).toBeNull();
    }
  });

  it('treats a payment that has not completed as no signal at all', () => {
    for (const v of ['Pending', 'Failed', '', 'processing']) {
      expect(paymentStatusFromRegistrationPayload({ hundredBMPaymentStatus: v }), v).toBeNull();
      expect(paymentStatusFromRegistrationPayload({ paymentstatus: v }), v).toBeNull();
    }
  });
});

describe('contract · programme naming', () => {
  it('understands the full course names the Deluge sends', () => {
    expect(normalizeProgram('Leadership Essentials Program')).toBe('lep');
    expect(normalizeProgram('100 Board Members Program')).toBe('100bm');
    expect(normalizeProgram('Master of Business Warfare')).toBe('mbw');
  });

  it('understands the short codes too', () => {
    expect(normalizeProgram('LEP')).toBe('lep');
    expect(normalizeProgram('100BM')).toBe('100bm');
    expect(normalizeProgram('MBW')).toBe('mbw');
  });

  it('carries the programme through the merge', () => {
    const record = mergeProvisioningRecord(null, null, ENROLMENT_PAYLOAD);
    expect(parseEntitlementsFromRecord(record).program).toBe('100bm');
  });

  it('refuses to guess at a programme it does not recognise', () => {
    expect(normalizeProgram('Executive Bootcamp')).not.toBe('lep');
    expect(normalizeProgram('')).toBeFalsy();
  });
});

describe('contract · lead status payloads', () => {
  const statusTier = (status) =>
    parseEntitlementsFromRecord(
      mergeProvisioningRecord(null, null, { ...STATUS_PAYLOAD, Lead_Status: status })
    ).paymentStatus;

  it.each([
    ['100 BM Enrolled', 'register'],
    ['100 BM started', 'paid'],
    ['MBW started', 'paid'],
    ['MBW Enrolled', 'register'],
    ['Follow up', 'unpaid'],
    ['100 BM Refund Completed', 'unpaid'],
  ])('%s → %s', (status, expected) => {
    expect(statusTier(status)).toBe(expected);
  });

  it('marks a completed refund so the ratchet can be overridden', () => {
    const ent = parseEntitlementsFromRecord(
      mergeProvisioningRecord(null, null, { ...STATUS_PAYLOAD, Lead_Status: '100 BM Refund Completed' })
    );
    expect(ent.refund).toBe('completed');
    expect(ent.program).toBe('100bm');
  });

  it('does not mark initiated or cancelled as a revocation', () => {
    for (const status of ['100 BM Refund Initiated', '100 BM Refund Cancelled']) {
      const ent = parseEntitlementsFromRecord(
        mergeProvisioningRecord(null, null, { ...STATUS_PAYLOAD, Lead_Status: status })
      );
      expect(ent.refund, status).not.toBe('completed');
    }
  });
});

describe('contract · identity and required fields', () => {
  it('takes the email under either casing', () => {
    expect(mergeProvisioningRecord(null, null, { email: 'a@b.com' }).Email).toBe('a@b.com');
    expect(mergeProvisioningRecord(null, null, { Email: 'a@b.com' }).Email).toBe('a@b.com');
  });

  it('trims a padded email rather than creating a second learner', () => {
    expect(mergeProvisioningRecord(null, null, { email: '  a@b.com  ' }).Email).toBe('a@b.com');
  });

  it('produces no entitlement without an email', () => {
    // The handler rejects with 400 before this point; this guards the layer
    // beneath it, so a future caller cannot provision an anonymous record.
    expect(parseEntitlementsFromRecord(mergeProvisioningRecord(null, null, {})).email).toBeFalsy();
  });

  it('carries the credential and Moodle id through', () => {
    const r = mergeProvisioningRecord(null, null, REGISTRATION_PAYLOAD);
    expect(r.Password).toBe('Secret123-xX');
    expect(r.Username).toBe('learner@example.com');
  });
});

describe('contract · batch hygiene', () => {
  it('accepts a real cohort string', () => {
    expect(isValidBatchName('08/08/2026 - 08/02/2027')).toBe(true);
    expect(mergeProvisioningRecord(null, null, ENROLMENT_PAYLOAD).batch).toBe(
      '08/08/2026 - 08/02/2027'
    );
  });

  it('rejects the placeholders Zoho leaves behind', () => {
    // '#batch' is the sentinel and '$' means an unreplaced ${...} template.
    // Both have reached production before.
    for (const bad of ['#batch', '${batch}', 'Batch $x', '', '   ']) {
      expect(isValidBatchName(bad), bad).toBe(false);
    }
  });
});

describe('contract · replay and ordering', () => {
  /*
   * Webhooks arrive more than once and not always in order. Zoho retries, an
   * admin re-saves, and the two Deluge functions can fire close together.
   */
  it('is stable when the same payload arrives twice', () => {
    expect(tierOf(ENROLMENT_PAYLOAD)).toBe(tierOf(ENROLMENT_PAYLOAD));
  });

  it('resolves each payload independently of the other', () => {
    // Ordering is reconciled by maxPaymentStatus at apply time, not here; what
    // matters is that neither payload's meaning depends on what came before.
    expect(tierOf(REGISTRATION_PAYLOAD)).toBe('register');
    expect(tierOf(ENROLMENT_PAYLOAD)).toBe('paid');
    expect(tierOf(REGISTRATION_PAYLOAD)).toBe('register');
  });

  it('lets an explicit LMS_Payment_Status override the status-derived tier', () => {
    const record = mergeProvisioningRecord(null, null, {
      email: 'a@b.com',
      Lead_Status: 'Follow up',
      LMS_Payment_Status: 'paid',
    });
    expect(parseEntitlementsFromRecord(record).paymentStatus).toBe('paid');
  });
});

describe('contract · malformed and hostile input', () => {
  it('does not throw on any shape a caller might send', () => {
    for (const body of [null, undefined, {}, { email: null }, { program: 123 }, []]) {
      expect(() => mergeProvisioningRecord(null, null, body)).not.toThrow();
      expect(() => paymentStatusFromRegistrationPayload(body)).not.toThrow();
    }
  });

  it('ignores unexpected extra fields rather than acting on them', () => {
    const tier = tierOf({
      ...ENROLMENT_PAYLOAD,
      role: 'superadmin',
      paymentStatusOverride: 'paid',
      isAdmin: true,
    });
    // Privilege must never be settable from a webhook body.
    expect(tier).toBe('paid');
    const record = mergeProvisioningRecord(null, null, {
      email: 'a@b.com',
      role: 'superadmin',
    });
    expect(record.role).not.toBe('superadmin');
  });
});
