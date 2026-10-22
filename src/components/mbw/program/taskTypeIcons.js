import {
  PlayCircle,
  Video,
  PenLine,
  Table2,
  Upload,
  Link2,
  Repeat2,
  ListChecks,
  FileText,
} from 'lucide-react';

/**
 * One symbol per kind of task.
 *
 * Keys come from getTaskTypeIcon() in the mbw / bm100 / lep program utils, which
 * all share this vocabulary.
 *
 * Two things were wrong before and are corrected here:
 *
 *  - Watch and record were inverted. A task you watch carried the camcorder
 *    (`Video`), which is the symbol for recording, while a task where you record
 *    and submit a video carried a microphone — an audio symbol for a video
 *    assignment. Watching is now a play button; recording is the camcorder.
 *  - `recurring_post` and `link` shared one symbol, and `checklist` had none at
 *    all, so it fell through to the default and displayed a play button — a
 *    checklist that looked like a video.
 */
export const TASK_TYPE_ICONS = {
  /** Watch a video or a recorded session. */
  video: PlayCircle,
  /** Record a video and submit it. */
  recording: Video,
  /** Write and submit an answer. */
  text: PenLine,
  /** Fill in a structured table. */
  template: Table2,
  /** Attach a file. */
  document: Upload,
  /** Submit a URL. */
  link: Link2,
  /** Post repeatedly over time, e.g. weekly on LinkedIn. */
  post: Repeat2,
  /** Tick off a set of items. */
  checklist: ListChecks,
  /** Neutral fallback for a type with no symbol of its own. Deliberately not a
      play button — an unknown task is not a video. */
  lesson: FileText,
};

export function taskTypeIcon(key) {
  return TASK_TYPE_ICONS[key] || TASK_TYPE_ICONS.lesson;
}
