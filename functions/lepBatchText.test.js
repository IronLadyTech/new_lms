import { describe, it, expect } from 'vitest';
import { lepBatchLeadFields, addOneMonth } from './lepBatchText.js';

/** She changes her batch in the app: her Zoho Lead must show the same batch CX would type. */
describe('LEP batch fields written to her Zoho Lead', () => {
  it('batch text in the CX style, start = Day 1, end one month later', () => {
    expect(lepBatchLeadFields('2026-11-14')).toEqual({
      LEP_Batch: '14 Nov 2026 – 14 Dec 2026',
      LEP_Reg_Date: '2026-11-14',
      LEP_End_Date: '2026-12-14',
    });
  });
  it('single-digit days are padded like the existing cohorts ("03 Oct 2026")', () => {
    expect(lepBatchLeadFields('2026-10-03').LEP_Batch).toBe('03 Oct 2026 – 03 Nov 2026');
  });
  it('crosses the year', () => {
    expect(lepBatchLeadFields('2026-12-12').LEP_Batch).toBe('12 Dec 2026 – 12 Jan 2027');
  });
  it('month end: 31 Jan → 28 Feb', () => {
    expect(addOneMonth('2027-01-31')).toBe('2027-02-28');
  });
  it('nothing for a bad date', () => {
    expect(lepBatchLeadFields('soon')).toEqual({});
    expect(lepBatchLeadFields('')).toEqual({});
  });
});
