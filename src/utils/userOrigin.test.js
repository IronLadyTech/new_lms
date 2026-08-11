import { describe, it, expect } from 'vitest';
import { formatUserCreatedAt, inferUserOrigin } from './userOrigin';

describe('formatUserCreatedAt', () => {
  it('renders a Firestore timestamp', () => {
    const ts = { toDate: () => new Date('2026-03-04T10:00:00Z') };
    expect(formatUserCreatedAt(ts)).not.toBe('—');
  });

  it('accepts a plain date or ISO string', () => {
    expect(formatUserCreatedAt(new Date('2026-03-04T10:00:00Z'))).not.toBe('—');
    expect(formatUserCreatedAt('2026-03-04T10:00:00Z')).not.toBe('—');
  });

  it('shows a dash rather than "Invalid Date" for bad input', () => {
    expect(formatUserCreatedAt(null)).toBe('—');
    expect(formatUserCreatedAt(undefined)).toBe('—');
    expect(formatUserCreatedAt('not a date')).toBe('—');
    expect(formatUserCreatedAt({ toDate: () => new Date('nonsense') })).toBe('—');
  });
});

describe('inferUserOrigin', () => {
  it('ranks an explicit Zoho provision above any other signal', () => {
    expect(inferUserOrigin({ provisionedFromZoho: true, zohoLeadId: 'L1' })).toBe(
      'Zoho provision / webhook'
    );
  });

  it('reports a linked account when a Zoho id is present', () => {
    expect(inferUserOrigin({ zohoLeadId: 'L1' })).toBe('LMS account, Zoho linked');
    expect(inferUserOrigin({ zohoContactId: 'C1' })).toBe('LMS account, Zoho linked');
  });

  it('flags obvious test accounts', () => {
    expect(inferUserOrigin({ email: 'test@iamironlady.com' })).toBe('Likely test / manual');
    expect(inferUserOrigin({ email: 'demo@iamironlady.com' })).toBe('Likely test / manual');
    expect(inferUserOrigin({ email: 'someone@example.com' })).toBe('Likely test / manual');
  });

  it('does not mistake a real learner for a test account', () => {
    expect(inferUserOrigin({ email: 'priya.sharma@gmail.com' })).toBe('LMS signup or login');
    // "test" inside the local part must not trigger the prefix rule.
    expect(inferUserOrigin({ email: 'greatest@gmail.com' })).toBe('LMS signup or login');
  });

  it('falls back safely for an empty profile', () => {
    expect(inferUserOrigin()).toBe('LMS signup or login');
    expect(inferUserOrigin({})).toBe('LMS signup or login');
  });
});
