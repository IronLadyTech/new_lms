/** Iron Lady program codes — used on batches and tracking. */
export const PROGRAMS = {
  MBW: 'mbw',
  LEP: 'lep',
  BM100: '100bm',
};

export const PROGRAM_OPTIONS = [
  { value: PROGRAMS.MBW, label: 'MBW — 1 year (weekly Q&A)' },
  { value: PROGRAMS.LEP, label: 'LEP — 4 weeks (2-day full session)' },
  { value: PROGRAMS.BM100, label: '100BM — 1 year (biweekly sections)' },
];

export function getProgramLabel(program) {
  return PROGRAM_OPTIONS.find((p) => p.value === program)?.label || program || '—';
}

const SHORT_LABELS = {
  [PROGRAMS.MBW]: 'MBW',
  [PROGRAMS.LEP]: 'LEP',
  [PROGRAMS.BM100]: '100BM',
};

export function getProgramShortLabel(program) {
  return SHORT_LABELS[program] || program || '—';
}
