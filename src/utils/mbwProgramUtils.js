import { SUBMISSION_STATUS, TASK_TYPES, taskNeedsReview } from '../services/mbwService';
import {
  MBW_PROGRAM_SECTIONS,
  MBW_SECTION_STATUS,
  MBW_GATE_TYPES,
} from '../data/mbwProgramStructure';

export function getProgramProgressPct(completedMilestones, totalMilestones) {
  return totalMilestones ? Math.round((completedMilestones / totalMilestones) * 100) : 0;
}

export function getCohortLabel(profile) {
  if (profile?.batchName) return profile.batchName;
  if (profile?.batchId) return `Batch ${profile.batchId}`;
  const created = profile?.createdAt?.toDate?.() || (profile?.createdAt ? new Date(profile.createdAt) : null);
  if (created && !Number.isNaN(created.getTime())) {
    return `${created.toLocaleString('default', { month: 'long' })} ${created.getFullYear()} cohort`;
  }
  return 'Your cohort';
}

export function isPreparationComplete(taskStates) {
  if (!taskStates?.length) return false;
  const prepTasks = taskStates.filter((ts) => ts.task.phase === 'pre-preparation');
  if (!prepTasks.length) return false;
  return prepTasks.every((ts) => ts.isComplete || ts.task.optional);
}

function sectionComplete(sectionId, sectionProgress) {
  const p = sectionProgress[sectionId];
  return p?.status === MBW_SECTION_STATUS.DONE;
}

function resolveGate(gate, sectionProgress, taskStates) {
  if (!gate) return true;
  if (gate.type === MBW_GATE_TYPES.PREPARATION) return isPreparationComplete(taskStates);
  if (
    gate.type === MBW_GATE_TYPES.SEQUENCE ||
    gate.type === MBW_GATE_TYPES.BATCH ||
    gate.type === MBW_GATE_TYPES.MEMBERS
  ) {
    return sectionComplete(gate.requiresSectionId, sectionProgress);
  }
  if (gate.type === MBW_GATE_TYPES.PAID) return false;
  return true;
}

export function computeSectionProgress(taskStates) {
  const progress = {};

  MBW_PROGRAM_SECTIONS.forEach((section) => {
    if (section.usesTaskEngine) {
      const sectionTasks = taskStates.filter((ts) => ts.task.phase === section.id);
      const done = sectionTasks.filter((ts) => ts.isComplete || ts.task.optional).length;
      const total = sectionTasks.length;
      const unlocked = resolveGate(section.gate, progress, taskStates);

      let status = MBW_SECTION_STATUS.LOCKED;
      if (!unlocked || total === 0) {
        status = MBW_SECTION_STATUS.LOCKED;
      } else if (done >= total) {
        status = MBW_SECTION_STATUS.DONE;
      } else {
        status = MBW_SECTION_STATUS.IN_PROGRESS;
      }

      progress[section.id] = { done, total, status, unlocked };
      return;
    }

    const unlocked = resolveGate(section.gate, progress, taskStates);
    progress[section.id] = {
      done: 0,
      total: section.milestoneCount || 0,
      status: unlocked ? MBW_SECTION_STATUS.IN_PROGRESS : MBW_SECTION_STATUS.LOCKED,
      unlocked,
    };
  });

  return progress;
}

export function getCurrentSectionId(sectionProgress) {
  const prep = sectionProgress['pre-preparation'];
  if (prep && prep.status !== MBW_SECTION_STATUS.DONE) return 'pre-preparation';

  for (const section of MBW_PROGRAM_SECTIONS) {
    if (section.id === 'pre-preparation') continue;
    const p = sectionProgress[section.id];
    if (p?.unlocked && p.status !== MBW_SECTION_STATUS.DONE) return section.id;
  }

  return 'pre-preparation';
}

export function getTotalMilestones(sectionProgress) {
  return MBW_PROGRAM_SECTIONS.reduce((sum, s) => {
    const p = sectionProgress[s.id];
    if (!p?.unlocked) return sum;
    return sum + (p?.total || 0);
  }, 0);
}

export function getCompletedMilestones(sectionProgress) {
  return MBW_PROGRAM_SECTIONS.reduce((sum, s) => {
    const p = sectionProgress[s.id];
    if (!p?.unlocked) return sum;
    return sum + (p?.done || 0);
  }, 0);
}

export function getLessonRowState(taskState, activeTaskId, nextTaskId) {
  const { task, status, isComplete, submission } = taskState;
  const id = task.id;

  if (status === SUBMISSION_STATUS.LOCKED) {
    return {
      visual: 'locked',
      reason: 'Complete the previous lesson first',
      clickable: false,
    };
  }

  if (isComplete) {
    return { visual: 'done', reason: null, clickable: true };
  }

  if (
    submission?.status === SUBMISSION_STATUS.UNDER_REVIEW ||
    submission?.status === SUBMISSION_STATUS.SUBMITTED
  ) {
    return { visual: 'pending', reason: null, clickable: true };
  }

  if (id === activeTaskId || id === nextTaskId) {
    return { visual: 'current', reason: null, clickable: true };
  }

  return { visual: 'available', reason: null, clickable: true };
}

export function getTaskTypeIcon(type) {
  switch (type) {
    case TASK_TYPES.WATCH_ONLY:
      return 'video';
    case TASK_TYPES.TEXT:
      return 'text';
    case TASK_TYPES.LINK:
      return 'link';
    case TASK_TYPES.EDITABLE_TEMPLATE:
      return 'template';
    case TASK_TYPES.FILE_UPLOAD:
      return 'document';
    case TASK_TYPES.VIDEO_RECORD:
      return 'recording';
    case TASK_TYPES.RECURRING_POST:
      return 'link';
    default:
      return 'lesson';
  }
}

export function getTaskDurationHint(task) {
  if (task.type === TASK_TYPES.WATCH_ONLY) return '~15 min video';
  if (task.type === TASK_TYPES.RECURRING_POST) return `${task.postsPerWeek || 1}/week`;
  if (task.type === TASK_TYPES.FILE_UPLOAD) return 'Upload';
  if (task.type === TASK_TYPES.VIDEO_RECORD) return '~5 min recording';
  if (task.type === TASK_TYPES.EDITABLE_TEMPLATE) return 'Template';
  if (task.type === TASK_TYPES.CHECKLIST) return 'Checklist';
  if (taskNeedsReview(task)) return 'Review required';
  return '~10 min';
}

export function getWeeklyCadenceItems(taskStates) {
  return taskStates
    .filter(({ task }) => task.type === TASK_TYPES.RECURRING_POST)
    .map((ts) => ({
      taskId: ts.task.id,
      title: ts.task.title,
      postsPerWeek: ts.task.postsPerWeek || 1,
      status: ts.status,
      isComplete: ts.isComplete,
      weekEntries: ts.submission?.weekEntries || [],
    }));
}

export function getSectionLockDisplay(section, sectionProgress) {
  const p = sectionProgress[section.id];
  if (p?.unlocked) return null;
  return {
    message: section.lockedMessage || 'This section is not available yet.',
    cta: section.unlockCta || null,
  };
}
