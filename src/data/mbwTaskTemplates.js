/**

 * Downloadable references in public/templates/ — mapped to MBW task ids.

 * Inline fillable templates use EDITABLE_TEMPLATE + templateId instead.

 */

function tpl(filename) {
  return `/templates/${encodeURIComponent(filename)}`;
}

const RESUME_TEMPLATES = [
  { label: 'Entrepreneur Resume Template', file: tpl('Entrepreneur Resume Template.docx') },

  { label: 'Iron Lady Resume Template', file: tpl('Iron Lady Resume Template.doc') },
];

/** @type {Record<string, Array<{ label: string, file: string, type?: 'download'|'image', hint?: string }>>} */

export const MBW_TASK_TEMPLATES = {
  'mbw-resume': RESUME_TEMPLATES,

  'q1-csuite-resume': RESUME_TEMPLATES,

  'q1-story-video': [
    {
      label: 'Script for C-Suite Story Video',

      file: tpl('Script for C Suite Story Video.docx'),

      hint: 'Use this script while recording your accomplishment story.',
    },
  ],

  'q1-business-language': [
    {
      label: 'Business Language — Leadership Questions',

      file: tpl('Business Language - Questions.docx'),

      hint: 'Answer these questions in your recorded video.',
    },
  ],

  'q1-video-cv': [
    {
      label: 'Script for Video CV',

      file: tpl('Script for Video CV assignments.docx'),

      hint: 'Follow this script when recording your Video CV.',
    },
  ],

  'q2-super-powers-video': [
    {
      label: 'Super Power reference',

      file: tpl('superpower.jpeg'),

      type: 'image',

      hint: 'Revisit your super powers before recording your video.',
    },
  ],

  'q3-business-language-video': [
    {
      label: 'Business Language — Leadership Questions',

      file: tpl('Business Language - Questions.docx'),

      hint: 'Use business language from these prompts in your 2-minute video.',
    },
  ],
};

export function getTaskTemplates(taskId, task) {
  if (Array.isArray(task?.templates) && task.templates.length) {
    return task.templates;
  }

  return MBW_TASK_TEMPLATES[taskId] || [];
}
