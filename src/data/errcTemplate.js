/** Default ERRC grid rows — matches Iron Lady ERRC template. */
export const ERRC_COLUMNS = ['Eliminate', 'Reduce', 'Raise', 'Create'];

export const ERRC_DEFAULT_TASKS = [
  'Getting ready',
  'Feeding child',
  'Homework',
  'Getting child ready',
  'Sending daily report',
  'Daily team meeting',
  'Linked Branding',
];

export function createErrcRows(tasks = ERRC_DEFAULT_TASKS) {
  return tasks.map((activity) => ({
    activity,
    Eliminate: '',
    Reduce: '',
    Raise: '',
    Create: '',
  }));
}
