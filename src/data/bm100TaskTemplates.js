import { MBW_TASK_TEMPLATES } from './mbwTaskTemplates';

function tpl(filename) {
  return `/templates/${encodeURIComponent(filename)}`;
}

/** Session 1 — from [100BM Drive folder](https://drive.google.com/drive/folders/1pxA7fKc53hin8KsKFH2esOnNQH-VDhET) */
export const BM100_DRIVE_SESSION1_FOLDER =
  'https://drive.google.com/drive/folders/1pxA7fKc53hin8KsKFH2esOnNQH-VDhET';

export const CORE_BRAND_STORY_TEMPLATE = {
  label: 'Core Brand Story Template',
  file: tpl('Core Brand Story Template.pdf'),
  hint: 'Download, complete offline, then upload your finished core story file below.',
};

export const CORE_BRAND_VIDEO_SCRIPT_TEMPLATE = {
  label: 'Core Brand Video Script',
  file: tpl('Core Brand Video Script.docx'),
  hint: 'Download, edit offline, then upload your completed script below.',
};

const CORE_STORY_TEMPLATES = [CORE_BRAND_STORY_TEMPLATE];

const RESUME_TEMPLATES = MBW_TASK_TEMPLATES['mbw-resume'] || [
  { label: 'Entrepreneur Resume Template', file: tpl('Entrepreneur Resume Template.docx') },
  { label: 'Iron Lady Resume Template', file: tpl('Iron Lady Resume Template.doc') },
];

/** @type {Record<string, Array<{ label: string, file: string, type?: 'download'|'image', hint?: string }>>} */
export const BM100_TASK_TEMPLATES = {
  'bm100-wk1-4': CORE_STORY_TEMPLATES,
  'bm100-wk1-2': CORE_STORY_TEMPLATES,
  'bm100-wk1': [CORE_BRAND_VIDEO_SCRIPT_TEMPLATE],
  'bm100-wk1-1': [
    {
      label: 'Delta / Milestone Table',
      file: tpl('Delta Table.pptx'),
      hint: 'Complete your Delta 2 milestone table, then upload below.',
    },
  ],
  'bm100-wk3': RESUME_TEMPLATES,
  'bm100-wk9': [
    {
      label: 'Pitch document starter',
      file: tpl('Script for C Suite Story Video.docx'),
      hint: 'Use as a starting point for your pitch document.',
    },
  ],
  'bm100-wk12': MBW_TASK_TEMPLATES['q2-strategy-draft'] || [],
  'bm100-wk13': MBW_TASK_TEMPLATES['q2-strategy-draft'] || [],
  'bm100-wk14': MBW_TASK_TEMPLATES['q2-strategy-draft'] || [],
  'bm100-wk20': [
    {
      label: 'Delta / Milestone Table',
      file: tpl('Delta Table.pptx'),
      hint: 'Update your milestone table, then upload below.',
    },
  ],
  'bm100-wk19': MBW_TASK_TEMPLATES['q1-super-power-table'] || [],
};

export function getBm100TaskTemplates(taskId, task) {
  if (Array.isArray(task?.templates) && task.templates.length) {
    return task.templates;
  }
  return BM100_TASK_TEMPLATES[taskId] || [];
}
