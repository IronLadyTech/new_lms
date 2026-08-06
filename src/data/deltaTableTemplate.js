/** Delta / Milestone table — matches Iron Lady Delta Table template. */
export const DELTA_TEMPLATE_ID = 'delta';

export const DELTA_COLUMNS = [
  { key: 'bhag', label: 'BHAG' },
  { key: 'focusAreas', label: 'Focus Areas' },
  { key: 'kaizen', label: 'Kaizen' },
];

export const DELTA_TIMELINES = ['3 Months', '6 Months', '9 Months', '1 Year'];

export function createDeltaRows() {
  return DELTA_TIMELINES.map((timeline) => ({
    timeline,
    bhag: '',
    focusAreas: '',
    kaizen: '',
  }));
}

export function isDeltaTableComplete(rows = []) {
  if (!rows.length) return false;
  return rows.every((row) =>
    DELTA_COLUMNS.every((col) => String(row[col.key] || '').trim().length > 0)
  );
}
