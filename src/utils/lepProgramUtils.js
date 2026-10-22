import { SUBMISSION_STATUS, TASK_TYPES } from '../services/lepService';
import {
  LEP_PROGRAM_SECTIONS,
  LEP_SECTION_STATUS,
  LEP_GATE_TYPES,
} from '../data/lepProgramStructure';
import {
  hasFullProgramAccess,
  normalizePaymentStatus,
  programPaymentStatus,
  PAYMENT_STATUS,
} from '../data/accessTiers';
import { isProgramAccessExpired } from '../data/programAccessWindow';
import { PROGRAMS } from '../data/programTypes';
import { submissionUnlocksNext } from './submissionReview';

/** The section every later gate measures "preparation" against. */
/*
 * The phase everything else waits on.
 *
 * This was 'orientation' while Orientation came first. The outline now opens
 * with Pre-Program Preparation — the VIA survey, the CoDeSeF sheet, the NSDC
 * registration — and Orientation is gated on it. Left pointing at 'orientation'
 * the gate asked whether Orientation was finished before unlocking Orientation,
 * which no learner could ever satisfy.
 */
export const LEP_PREPARATION_SECTION_ID = 'pre-program';

export const LEP_ACCESS_EXPIRED_MESSAGE =
  'Your access to the Leadership Essentials Program has ended. Contact support to renew it.';

export const REGISTRATION_PAYMENT_LOCK_TOOLTIP =
  'You have paid only the registration amount. Complete full program payment to unlock this section.';

export function getProgramProgressPct(completedMilestones, totalMilestones) {
  return totalMilestones ? Math.round((completedMilestones / totalMilestones) * 100) : 0;
}

export function getCohortLabel(profile) {
  if (profile?.batchName) return profile.batchName;
  if (profile?.batchId) return `Batch ${profile.batchId}`;
  const created =
    profile?.createdAt?.toDate?.() || (profile?.createdAt ? new Date(profile.createdAt) : null);
  if (created && !Number.isNaN(created.getTime())) {
    return `${created.toLocaleString('default', { month: 'long' })} ${created.getFullYear()} cohort`;
  }
  return 'Your cohort';
}

export function isPreparationComplete(taskStates) {
  if (!taskStates?.length) return false;
  const prepTasks = taskStates.filter((ts) => ts.task.phase === LEP_PREPARATION_SECTION_ID);
  if (!prepTasks.length) return false;
  return prepTasks.every((ts) => ts.task.optional || submissionUnlocksNext(ts.status));
}

function sectionComplete(sectionId, sectionProgress) {
  const p = sectionProgress[sectionId];
  return p?.status === LEP_SECTION_STATUS.DONE;
}

/*
 * Paid for LEP specifically, and still inside the window. Zoho tracks each
 * programme's payment separately, so paying for 100BM must not open LEP.
 */
function hasActiveAccess(profile) {
  if (!hasFullProgramAccess(profile, PROGRAMS.LEP)) return false;
  return !isProgramAccessExpired(profile, PROGRAMS.LEP);
}

function resolveGate(gate, sectionProgress, taskStates, profile) {
  if (!gate) return true;
  if (gate.requiresPaid && !hasActiveAccess(profile)) return false;
  if (gate.type === LEP_GATE_TYPES.PREPARATION) return isPreparationComplete(taskStates);
  if (gate.type === LEP_GATE_TYPES.SEQUENCE) {
    return sectionComplete(gate.requiresSectionId, sectionProgress);
  }
  if (gate.type === LEP_GATE_TYPES.PAID) return hasActiveAccess(profile);
  return true;
}

export function computeSectionProgress(taskStates, profile = null) {
  const progress = {};

  LEP_PROGRAM_SECTIONS.forEach((section) => {
    if (section.usesTaskEngine) {
      const sectionTasks = taskStates.filter((ts) => ts.task.phase === section.id);
      const done = sectionTasks.filter(
        (ts) => ts.task.optional || submissionUnlocksNext(ts.status) || ts.isComplete
      ).length;
      const total = sectionTasks.length;
      const unlocked = resolveGate(section.gate, progress, taskStates, profile);

      let status = LEP_SECTION_STATUS.LOCKED;
      if (!unlocked || total === 0) {
        status = LEP_SECTION_STATUS.LOCKED;
      } else if (done >= total) {
        status = LEP_SECTION_STATUS.DONE;
      } else {
        status = LEP_SECTION_STATUS.IN_PROGRESS;
      }

      progress[section.id] = { done, total, status, unlocked };
      return;
    }

    const unlocked = resolveGate(section.gate, progress, taskStates, profile);
    progress[section.id] = {
      done: 0,
      total: section.milestoneCount || 0,
      status: unlocked ? LEP_SECTION_STATUS.IN_PROGRESS : LEP_SECTION_STATUS.LOCKED,
      unlocked,
    };
  });

  return progress;
}

/** Phase ids the learner may work on (respects sequence + payment gates). */
export function getUnlockedPhaseIds(taskStates, profile = null) {
  const progress = computeSectionProgress(taskStates, profile);
  return new Set(LEP_PROGRAM_SECTIONS.filter((s) => progress[s.id]?.unlocked).map((s) => s.id));
}

export function getCurrentSectionId(sectionProgress) {
  const prep = sectionProgress[LEP_PREPARATION_SECTION_ID];
  if (prep && prep.status !== LEP_SECTION_STATUS.DONE) return LEP_PREPARATION_SECTION_ID;

  for (const section of LEP_PROGRAM_SECTIONS) {
    if (section.id === LEP_PREPARATION_SECTION_ID) continue;
    const p = sectionProgress[section.id];
    if (p?.unlocked && p.status !== LEP_SECTION_STATUS.DONE) return section.id;
  }

  return LEP_PREPARATION_SECTION_ID;
}

export function getTotalMilestones(sectionProgress) {
  return LEP_PROGRAM_SECTIONS.reduce((sum, s) => {
    const p = sectionProgress[s.id];
    if (!p?.unlocked) return sum;
    return sum + (p?.total || 0);
  }, 0);
}

export function getCompletedMilestones(sectionProgress) {
  return LEP_PROGRAM_SECTIONS.reduce((sum, s) => {
    const p = sectionProgress[s.id];
    if (!p?.unlocked) return sum;
    return sum + (p?.done || 0);
  }, 0);
}

export function getLessonRowState(taskState, activeTaskId, nextTaskId) {
  const { task, status, isComplete, submission, phaseLocked } = taskState;
  const id = task.id;

  if (status === SUBMISSION_STATUS.LOCKED) {
    return {
      visual: 'locked',
      /*
       * phaseLocked says the section is shut, never why. Naming payment here
       * would tell a fully-paid learner they still owed money on lessons that
       * are merely waiting on earlier work. The section header carries the real
       * reason; this stays neutral.
       */
      reason: phaseLocked ? 'This section is not open yet' : 'Complete the previous lesson first',
      clickable: false,
    };
  }

  if (isComplete) {
    return { visual: 'done', reason: null, clickable: true };
  }

  if (
    submission?.status === SUBMISSION_STATUS.NEEDS_IMPROVEMENT ||
    submission?.status === SUBMISSION_STATUS.REJECTED
  ) {
    return {
      visual: 'current',
      reason: 'Action required — review feedback and resubmit',
      clickable: true,
    };
  }

  if (id === activeTaskId || id === nextTaskId) {
    return { visual: 'current', reason: null, clickable: true };
  }

  return { visual: 'available', reason: null, clickable: true };
}

export { getTaskKindLabel } from './taskKindLabel';

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
    /* Its own symbol. Sharing `link` meant a one-off URL and a repeated weekly
       post were indistinguishable in the list. */
    case TASK_TYPES.RECURRING_POST:
      return 'post';
    /* Previously fell through to the default, which rendered a play button. */
    case TASK_TYPES.CHECKLIST:
      return 'checklist';
    default:
      return 'lesson';
  }
}

/*
 * The short label under a lesson in course content.
 *
 * No durations: no LEP lesson stores one, and "~10 min", "~15 min video" and
 * "~5 min recording" were guesses shown as facts. The weekly post count is real
 * task data, so it stays.
 */
export function getTaskDurationHint(task) {
  if (task.type === TASK_TYPES.WATCH_ONLY) return 'Video';
  if (task.type === TASK_TYPES.RECURRING_POST) return `${task.postsPerWeek || 1}/week`;
  if (task.type === TASK_TYPES.FILE_UPLOAD) return 'Upload';
  if (task.type === TASK_TYPES.VIDEO_RECORD) return 'Recording';
  if (task.type === TASK_TYPES.EDITABLE_TEMPLATE) return 'Template';
  if (task.type === TASK_TYPES.CHECKLIST) return 'Checklist';
  if (task.type === TASK_TYPES.LINK) return 'Link';
  if (task.type === TASK_TYPES.TEXT) return 'Written';
  return 'Lesson';
}

export function isRegistrationPaymentLocked(section, sectionProgress, profile = null) {
  const p = sectionProgress[section.id];
  if (p?.unlocked) return false;
  if (!section.gate?.requiresPaid) return false;
  return !hasFullProgramAccess(profile, PROGRAMS.LEP);
}

/**
 * Locked because the access window closed, not because of what was paid.
 * Distinct from the payment lock: telling somebody who paid in full a year ago
 * that they "only paid the registration amount" is simply wrong.
 */
export function isAccessWindowExpired(section, sectionProgress, profile = null) {
  const p = sectionProgress[section.id];
  if (p?.unlocked) return false;
  if (!section.gate?.requiresPaid) return false;
  if (!hasFullProgramAccess(profile, PROGRAMS.LEP)) return false;
  return isProgramAccessExpired(profile, PROGRAMS.LEP);
}

export function hasRegistrationTierOnly(profile) {
  return programPaymentStatus(profile, PROGRAMS.LEP) === PAYMENT_STATUS.REGISTER;
}

function sectionTitleById(sectionId) {
  const match = LEP_PROGRAM_SECTIONS.find((s) => s.id === sectionId);
  return match?.title || sectionId;
}

function resolveProgressLockMessage(section, sectionProgress) {
  const gate = section.gate;
  if (!gate) return section.lockedMessage || 'This section is not available yet.';

  const prereqId = gate.requiresSectionId;
  if (prereqId) {
    if (gate.type === LEP_GATE_TYPES.PREPARATION || gate.type === LEP_GATE_TYPES.SEQUENCE) {
      return `Complete ${sectionTitleById(prereqId)} to unlock ${section.title}.`;
    }
  }

  return section.lockedMessage || 'This section is not available yet.';
}

export function getSectionLockDisplay(section, sectionProgress, profile = null) {
  const p = sectionProgress[section.id];
  if (p?.unlocked) return null;
  if (isAccessWindowExpired(section, sectionProgress, profile)) {
    return {
      message: LEP_ACCESS_EXPIRED_MESSAGE,
      cta: { label: 'Renew access', href: '/app/support' },
      expired: true,
    };
  }
  if (isRegistrationPaymentLocked(section, sectionProgress, profile)) {
    return {
      message: REGISTRATION_PAYMENT_LOCK_TOOLTIP,
      cta: section.unlockCta || { label: 'Payment support', href: '/app/support' },
    };
  }
  if (hasFullProgramAccess(profile, PROGRAMS.LEP)) {
    return {
      message: resolveProgressLockMessage(section, sectionProgress),
      cta: section.unlockCta || null,
    };
  }
  return {
    message: section.lockedMessage || 'This section is not available yet.',
    cta: section.unlockCta || null,
  };
}

export { normalizePaymentStatus };
