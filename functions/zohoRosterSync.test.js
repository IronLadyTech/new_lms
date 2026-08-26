import { describe, expect, test } from 'vitest';
import {
  paymentFromStatusAndProgram,
  registrationMember,
  normalizeEmail,
} from './zohoRosterSync.js';

describe('zohoRosterSync helpers', () => {
  test('normalizeEmail trims and lowercases', () => {
    expect(normalizeEmail('  Ada@IronLady.com ')).toBe('ada@ironlady.com');
  });

  test('paymentFromStatusAndProgram maps 100 BM statuses', () => {
    expect(paymentFromStatusAndProgram('100 BM Enrolled', '')).toBe('register');
    expect(paymentFromStatusAndProgram('100 BM started', '')).toBe('paid');
  });

  test('paymentFromStatusAndProgram treats program list as register', () => {
    expect(paymentFromStatusAndProgram('', '100 Board Members Program')).toBe('register');
  });

  test('paymentFromStatusAndProgram defaults unpaid', () => {
    expect(paymentFromStatusAndProgram('', '')).toBe('unpaid');
  });

  test('registrationMember builds roster row', () => {
    const member = registrationMember({
      id: '1',
      email: 'Learner@Example.com',
      name: 'Learner',
      batch: '100BM',
      program: '100BM',
      status: '100 BM Enrolled',
    });
    expect(member).toMatchObject({
      email: 'learner@example.com',
      paymentStatus: 'register',
      _source: 'il_registration',
    });
  });

  test('registrationMember drops rows without email', () => {
    expect(registrationMember({ id: '1', email: '', name: 'X' })).toBeNull();
  });
});
