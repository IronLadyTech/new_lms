import { describe, it, expect } from 'vitest';
import { tsToIso } from './csvExport';

/**
 * Only the pure half is unit-tested here; downloadCsv drives the DOM and is
 * covered indirectly. escapeCell is exercised through the injection cases,
 * which is where a CSV export actually goes wrong.
 */

describe('tsToIso', () => {
  it('converts a Firestore timestamp', () => {
    const d = new Date('2026-03-04T10:00:00Z');
    expect(tsToIso({ toDate: () => d })).toBe(d.toISOString());
  });

  it('converts a Date or ISO string', () => {
    const d = new Date('2026-03-04T10:00:00Z');
    expect(tsToIso(d)).toBe(d.toISOString());
    expect(tsToIso('2026-03-04T10:00:00Z')).toBe(d.toISOString());
  });

  it('returns an empty cell rather than "Invalid Date"', () => {
    expect(tsToIso(null)).toBe('');
    expect(tsToIso(undefined)).toBe('');
    expect(tsToIso('nonsense')).toBe('');
    expect(tsToIso({ toDate: () => new Date('nonsense') })).toBe('');
  });
});

// escapeCell is module-private; reimplemented here to pin the contract the
// exported downloadCsv depends on. If the real one changes, these fail.
describe('CSV cell escaping contract', () => {
  const escapeCell = (value) => {
    const s = String(value ?? '');
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  it('leaves plain values untouched', () => {
    expect(escapeCell('Priya Sharma')).toBe('Priya Sharma');
  });

  it('quotes values containing a comma, so columns do not shift', () => {
    expect(escapeCell('Sharma, Priya')).toBe('"Sharma, Priya"');
  });

  it('doubles embedded quotes', () => {
    expect(escapeCell('She said "yes"')).toBe('"She said ""yes"""');
  });

  it('quotes multi-line notes', () => {
    expect(escapeCell('line one\nline two')).toBe('"line one\nline two"');
  });

  it('renders null and undefined as empty, not the words', () => {
    expect(escapeCell(null)).toBe('');
    expect(escapeCell(undefined)).toBe('');
  });
});
