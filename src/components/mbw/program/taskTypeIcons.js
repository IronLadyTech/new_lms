import { Video, FileText, Link2, Table2, Upload, Mic, PlayCircle } from 'lucide-react';

/** Keys come from getTaskTypeIcon() in the mbw / bm100 program utils. */
export const TASK_TYPE_ICONS = {
  video: Video,
  text: FileText,
  link: Link2,
  template: Table2,
  document: Upload,
  recording: Mic,
  lesson: PlayCircle,
};

export function taskTypeIcon(key) {
  return TASK_TYPE_ICONS[key] || PlayCircle;
}
