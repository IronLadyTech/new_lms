import { MBW_TASK_TEMPLATES } from './mbwTaskTemplates';



function tpl(filename) {

  return `/templates/${encodeURIComponent(filename)}`;

}



/** Session 1 — from [100BM Drive folder](https://drive.google.com/drive/folders/1pxA7fKc53hin8KsKFH2esOnNQH-VDhET) */

export const BM100_DRIVE_SESSION1_FOLDER =

  'https://drive.google.com/drive/folders/1pxA7fKc53hin8KsKFH2esOnNQH-VDhET';



const RESUME_TEMPLATES = MBW_TASK_TEMPLATES['mbw-resume'] || [

  { label: 'Entrepreneur Resume Template', file: tpl('Entrepreneur Resume Template.docx') },

  { label: 'Iron Lady Resume Template', file: tpl('Iron Lady Resume Template.doc') },

];



/** Downloadable references only — inline templates are handled via EDITABLE_TEMPLATE tasks. */

export const BM100_TASK_TEMPLATES = {

  'bm100-wk3': RESUME_TEMPLATES,

};



export function getBm100TaskTemplates(taskId, task) {

  if (Array.isArray(task?.templates) && task.templates.length) {

    return task.templates;

  }

  return BM100_TASK_TEMPLATES[taskId] || [];

}

