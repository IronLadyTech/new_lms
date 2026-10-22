/**
 * Worksheet drafts, kept on this device.
 *
 * A draft saved to the server would create a submission document before
 * anything is submitted, which CX lists and progress counts can pick up. On the
 * device it touches nothing shared, and the page says so ("Draft saved on this
 * device") rather than implying it follows the learner elsewhere.
 *
 * Storage can be unavailable (private windows, blocked site data). Every call
 * fails quietly, and the form works without a draft.
 */

export const templateDraftKey = (userId, taskId) => `lep-draft:${userId || 'anon'}:${taskId}`;

export function readTemplateDraft(key) {
  if (!key) return null;
  try {
    const raw = window.localStorage.getItem(key);
    const draft = raw ? JSON.parse(raw) : null;
    return draft && typeof draft.fields === 'object' ? draft : null;
  } catch {
    return null;
  }
}

/** Saves the draft and returns when, or null if it could not be saved. */
export function writeTemplateDraft(key, fields) {
  if (!key) return null;
  const savedAt = new Date().toISOString();
  try {
    window.localStorage.setItem(key, JSON.stringify({ fields, savedAt }));
    return savedAt;
  } catch {
    return null;
  }
}

const DRAFT_TIME = new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit' });
const DRAFT_DAY = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' });

/** When a draft was saved, as people say it: "just now", "4 min ago", "9:36 pm". */
export function draftSavedLabel(savedAt, now = Date.now()) {
  const at = new Date(savedAt).getTime();
  if (Number.isNaN(at)) return '';
  const seconds = Math.max(0, (now - at) / 1000);
  if (seconds < 45) return 'just now';
  if (seconds < 90) return '1 min ago';
  if (seconds < 3600) return `${Math.round(seconds / 60)} min ago`;
  return DRAFT_TIME.format(at);
}

/** The day a draft was started: "Today", or "14 Sept". */
export function draftDayLabel(savedAt, now = new Date()) {
  const at = new Date(savedAt);
  if (Number.isNaN(at.getTime())) return 'Today';
  return at.toDateString() === now.toDateString() ? 'Today' : DRAFT_DAY.format(at);
}

export function clearTemplateDraft(key) {
  if (!key) return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* Nothing to clear if storage is unavailable. */
  }
}
