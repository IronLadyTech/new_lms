import { describe, it, expect } from 'vitest';
// functions/ is CommonJS; Vite's interop exposes module.exports as the default.
import zohoBatchSync from './zohoBatchSync.js';

const { classifyBatchValue } = zohoBatchSync;

/*
 * The batch string is whatever Zoho holds — typed by staff, imported, or
 * written by an automation. The LMS never writes it, so this parser is the only
 * thing standing between bad CRM data and a wrong cohort assignment. These
 * cases are taken from a live preview: 57 end-before-start, 16 literal
 * "undefined", 7 spans over two years.
 */
describe('classifyBatchValue', () => {
  it('accepts a normal date range', () => {
    const r = classifyBatchValue('01/01/2025 - 01/12/2025');
    expect(r.ok).toBe(true);
    expect(r.kind).toBe('range');
  });

  it('accepts a month-name batch', () => {
    expect(classifyBatchValue('January 2026').ok).toBe(true);
    expect(classifyBatchValue('January 2026').kind).toBe('month');
  });

  it('treats writer junk as a placeholder, not a broken format', () => {
    // There is no format to correct here — the record has no batch at all.
    for (const junk of ['undefined', 'UNDEFINED', 'null', 'NaN', 'n/a', '-', '#batch']) {
      const r = classifyBatchValue(junk);
      expect(r.ok, `${junk} should not be usable`).toBe(false);
      expect(r.reason, `${junk} should be a placeholder`).toBe('placeholder-value');
    }
  });

  it('still flags an unreplaced template as a placeholder', () => {
    expect(classifyBatchValue('${startDate} - ${endDate}').reason).toBe('placeholder-value');
  });

  it('rejects a range that ends before it starts', () => {
    expect(classifyBatchValue('06/04/2024 - 05/04/2024').reason).toBe('end-before-start');
    expect(classifyBatchValue('20/04/2024 - 14/04/2024').reason).toBe('end-before-start');
  });

  it('rejects an implausibly long span', () => {
    const r = classifyBatchValue('13/01/2024 - 14/01/2027');
    expect(r.reason).toBe('implausible-span');
    expect(r.days).toBeGreaterThan(800);
  });

  it('rejects text that is neither a range nor a month', () => {
    expect(classifyBatchValue('sometime next year').reason).toBe('unrecognised-format');
  });

  it('reports an empty value as empty rather than as junk', () => {
    // Distinct from a placeholder: nothing was ever written, wrongly or not.
    for (const blank of ['', '   ', null, undefined]) {
      expect(classifyBatchValue(blank).reason).toBe('empty');
    }
  });
});
