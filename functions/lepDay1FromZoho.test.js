import { describe, it, expect } from 'vitest';
import { lepDay1FromBatchText, lepDay1FromZoho } from './lepBatchText.js';

/** CX edit the LEP Batch text, the LEP Start Date, or both: her Day 1 must follow the change. */
describe('her Day 1 after a Zoho sync', () => {
  it('reads both batch text styles', () => {
    expect(lepDay1FromBatchText('28/11/2026 - 28/12/2026')).toBe('2026-11-28');
    expect(lepDay1FromBatchText('14 Nov 2026 – 14 Dec 2026')).toBe('2026-11-14');
    expect(lepDay1FromBatchText('nonsense')).toBe('');
  });
  it('an older Thursday orientation start maps to its Saturday', () => {
    expect(lepDay1FromBatchText('12/11/2026 - 12/12/2026')).toBe('2026-11-14');
  });
  it('Sunitha: batch text set, no start date in Zoho — the batch decides', () => {
    const batch = '28/11/2026 - 28/12/2026';
    expect(lepDay1FromZoho({ lepBatch: batch, lepStart: '', prevBatch: batch })).toBe('2026-11-28');
  });
  it('CX changed only the batch text: it beats an old start date, and holds on the next sync', () => {
    const a = {
      lepBatch: '14 Nov 2026 – 14 Dec 2026',
      lepStart: '2026-10-24',
      prevBatch: '24 Oct 2026 – 24 Nov 2026',
      prevStart: '2026-10-24',
    };
    expect(lepDay1FromZoho(a)).toBe('2026-11-14');
    expect(lepDay1FromZoho({ ...a, prevBatch: a.lepBatch })).toBe('');
  });
  it('CX changed only the start date: it wins', () => {
    expect(
      lepDay1FromZoho({ lepBatch: 'x', lepStart: '2026-11-21', prevBatch: 'x', prevStart: '2026-11-14' })
    ).toBe('2026-11-21');
  });
  it('nothing changed: her Day 1 is left alone', () => {
    const batch = '24 Oct 2026 – 24 Nov 2026';
    expect(
      lepDay1FromZoho({ lepBatch: batch, lepStart: '2026-10-31', prevBatch: batch, prevStart: '2026-10-31' })
    ).toBe('');
  });
});
