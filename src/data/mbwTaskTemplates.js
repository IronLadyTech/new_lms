/**
 * Downloadable templates in public/templates/ — mapped to MBW task ids.
 * URLs are encoded so spaces and special chars work in all browsers.
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

  'q1-csuite-story': [
    {
      label: '3 Key Stories of Accomplishment',
      file: tpl('3 key stories of accomplishment template.docx'),
      hint: 'Fill this template, then paste your stories below or share in your WA group.',
    },
  ],

  'q1-story-video': [
    {
      label: 'Script for C-Suite Story Video',
      file: tpl('Script for C Suite Story Video.docx'),
      hint: 'Use this script while recording your accomplishment story.',
    },
  ],

  'q1-bell-curve': [
    {
      label: 'Bell Curve Position Worksheet',
      file: tpl('Bell Curve Position.docx'),
      hint: 'Complete the worksheet, then upload it below.',
    },
  ],

  'q1-business-language': [
    {
      label: 'Business Language — Leadership Questions',
      file: tpl('Business Language - Questions.docx'),
      hint: 'Answer these questions in your recorded video.',
    },
  ],

  'q1-milestone-table': [
    {
      label: 'Delta / Milestone Table',
      file: tpl('Delta Table.pptx'),
      hint: 'Update the table, then upload your file below.',
    },
  ],

  'q1-video-cv': [
    {
      label: 'Script for Video CV',
      file: tpl('Script for Video CV assignments.docx'),
      hint: 'Follow this script when recording your Video CV.',
    },
  ],

  'q1-super-power-table': [
    {
      label: 'Super Power reference',
      file: tpl('superpower.jpeg'),
      type: 'image',
      hint: 'Use this as a guide when filling in your Super Power Table below.',
    },
  ],

  'q2-strategy-draft': [
    {
      label: 'Strategy Document Template',
      file: tpl('Strategy document template V1.3.docx'),
      hint: 'Complete the strategy template, then upload it below.',
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

  'q2-delta2-revisit': [
    {
      label: 'Delta / Milestone Table',
      file: tpl('Delta Table.pptx'),
      hint: 'Update your Delta 2 table, then upload or summarize below.',
    },
  ],

  'q3-delta2-revisit': [
    {
      label: 'Delta / Milestone Table',
      file: tpl('Delta Table.pptx'),
      hint: 'Update your Delta 2 table, then upload or summarize below.',
    },
  ],

  'q3-business-language-video': [
    {
      label: 'Business Language — Leadership Questions',
      file: tpl('Business Language - Questions.docx'),
      hint: 'Use business language from these prompts in your 2-minute video.',
    },
  ],

  'q4-bell-curve-game-plan': [
    {
      label: 'Bell Curve Position Worksheet',
      file: tpl('Bell Curve Position.docx'),
      hint: 'Complete the worksheet as part of your game plan.',
    },
  ],

  'q4-multi-view-strategy': [
    {
      label: 'Strategy Document Template',
      file: tpl('Strategy document template V1.3.docx'),
      hint: 'Use this template for your multi-view strategy document.',
    },
  ],
};

export function getTaskTemplates(taskId, task) {
  if (Array.isArray(task?.templates) && task.templates.length) {
    return task.templates;
  }
  return MBW_TASK_TEMPLATES[taskId] || [];
}
