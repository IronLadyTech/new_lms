/** Normalize Firestore / Zoho course codes to canonical LMS codes. */
export function normalizeCourseCode(code) {
  const raw = String(code || '').trim();
  if (!raw) return '';
  const compact = raw.toUpperCase().replace(/\s+/g, '');
  if (compact === '100BM' || compact === '100BOARDMEMBERS') return '100BM';
  if (compact === 'MBW') return 'MBW';
  if (compact === 'LEP') return 'LEP';
  return raw.toUpperCase();
}

/** Task workspace routes for programs with a dedicated journey page. */
export function getProgramTasksPath(courseCode) {
  const code = normalizeCourseCode(courseCode);
  if (code === 'MBW') return '/app/mbw';
  if (code === '100BM') return '/app/100bm';
  return null;
}

export function getProgramLessonPath(courseCode, taskId) {
  const base = getProgramTasksPath(courseCode);
  if (!base || !taskId) return base;
  return `${base}?lesson=${taskId}`;
}

export function isProgramWithTasks(courseCode) {
  const code = normalizeCourseCode(courseCode);
  return code === 'MBW' || code === '100BM';
}
