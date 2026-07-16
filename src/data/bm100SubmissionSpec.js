/**
 * 100BM submission method per lesson.
 * Source: weekly session sheet + assignment spec spreadsheet
 * (https://docs.google.com/spreadsheets/d/1Y5KGc7SUou1C92qON4CCYMt8M-eHFQDUjhmqtu2LR7A/edit?gid=300598059)
 *
 * upload  — download template, edit offline, upload file
 * text    — type short answer in LMS
 * link    — paste URL
 * video   — record or upload media
 * checklist — tick items in LMS
 * template — editable grid in LMS (ERRC)
 * watch   — attend / watch session only
 */
export const BM100_SUBMISSION_METHOD = {
  UPLOAD: 'upload',
  TEXT: 'text',
  LINK: 'link',
  VIDEO: 'video',
  CHECKLIST: 'checklist',
  TEMPLATE: 'template',
  WATCH: 'watch',
};

/** @type {Record<string, { method: string, note?: string }>} */
export const BM100_SUBMISSION_SPEC = {
  'bm100-wk1-4': { method: BM100_SUBMISSION_METHOD.UPLOAD, note: 'Core Brand Story Template' },
  'bm100-wk1-3': { method: BM100_SUBMISSION_METHOD.CHECKLIST },
  'bm100-wk1-2': { method: BM100_SUBMISSION_METHOD.UPLOAD, note: 'Core Brand Story Template' },
  'bm100-wk1-1': { method: BM100_SUBMISSION_METHOD.UPLOAD, note: 'Milestone Table' },
  'bm100-wk1': { method: BM100_SUBMISSION_METHOD.UPLOAD, note: 'Core Brand Video Script' },
  'bm100-wk2': { method: BM100_SUBMISSION_METHOD.VIDEO },
  'bm100-wk3': { method: BM100_SUBMISSION_METHOD.UPLOAD, note: 'Resume' },
  'bm100-wk4': { method: BM100_SUBMISSION_METHOD.TEMPLATE, note: 'ERRC Table' },
  'bm100-wk5': { method: BM100_SUBMISSION_METHOD.UPLOAD, note: 'Theme Table' },
  'bm100-wk6': { method: BM100_SUBMISSION_METHOD.TEXT },
  'bm100-wk7': { method: BM100_SUBMISSION_METHOD.VIDEO },
  'bm100-wk8': { method: BM100_SUBMISSION_METHOD.VIDEO },
  'bm100-wk9': { method: BM100_SUBMISSION_METHOD.UPLOAD, note: 'Pitch document' },
  'bm100-wk10': { method: BM100_SUBMISSION_METHOD.VIDEO },
  'bm100-wk11': { method: BM100_SUBMISSION_METHOD.VIDEO },
  'bm100-wk12': { method: BM100_SUBMISSION_METHOD.UPLOAD, note: 'Strategy problem statement' },
  'bm100-wk13': { method: BM100_SUBMISSION_METHOD.UPLOAD, note: 'Strategy document' },
  'bm100-wk14': { method: BM100_SUBMISSION_METHOD.UPLOAD, note: 'Updated strategy' },
  'bm100-wk15': { method: BM100_SUBMISSION_METHOD.UPLOAD, note: 'Progress Table' },
  'bm100-wk16': { method: BM100_SUBMISSION_METHOD.VIDEO },
  'bm100-wk17': { method: BM100_SUBMISSION_METHOD.VIDEO },
  'bm100-wk18': { method: BM100_SUBMISSION_METHOD.LINK },
  'bm100-wk19': { method: BM100_SUBMISSION_METHOD.UPLOAD, note: 'Super Power mapping' },
  'bm100-wk20': { method: BM100_SUBMISSION_METHOD.UPLOAD, note: 'Milestone Table' },
  'bm100-wk21': { method: BM100_SUBMISSION_METHOD.VIDEO, note: 'Voice note' },
  'bm100-wk22': { method: BM100_SUBMISSION_METHOD.TEXT },
  'bm100-wk23': { method: BM100_SUBMISSION_METHOD.TEXT },
  'bm100-wk24': { method: BM100_SUBMISSION_METHOD.VIDEO },
  'bm100-wk25': { method: BM100_SUBMISSION_METHOD.VIDEO },
  'bm100-wk26': { method: BM100_SUBMISSION_METHOD.WATCH },
};

export function getBm100SubmissionMethod(taskId) {
  return BM100_SUBMISSION_SPEC[taskId]?.method || null;
}
