import { SUBMISSION_STATUS, TASK_TYPES } from '../services/bm100Service';
import {
  BM100_PROGRAM_SECTIONS,
  BM100_SECTION_STATUS,
  BM100_GATE_TYPES,
} from '../data/bm100ProgramStructure';
import { hasFullProgramAccess, normalizePaymentStatus, PAYMENT_STATUS } from '../data/accessTiers';
import { submissionUnlocksNext } from './submissionReview';

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
  const prepTasks = taskStates.filter((ts) => ts.task.phase === 'onboarding');
  if (!prepTasks.length) return false;
  return prepTasks.every((ts) => ts.task.optional || submissionUnlocksNext(ts.status));
}

function sectionComplete(sectionId, sectionProgress) {
  const p = sectionProgress[sectionId];
  return p?.status === BM100_SECTION_STATUS.DONE;
}

function resolveGate(gate, sectionProgress, taskStates, profile) {
  if (!gate) return true;
  if (gate.requiresPaid && !hasFullProgramAccess(profile)) return false;
  if (gate.type === BM100_GATE_TYPES.PREPARATION) return isPreparationComplete(taskStates);
  if (gate.type === BM100_GATE_TYPES.SEQUENCE) {
    return sectionComplete(gate.requiresSectionId, sectionProgress);
  }
  if (gate.type === BM100_GATE_TYPES.PAID) return hasFullProgramAccess(profile);
  return true;
}

export function computeSectionProgress(taskStates, profile = null) {
  const progress = {};

  BM100_PROGRAM_SECTIONS.forEach((section) => {
    if (section.usesTaskEngine) {
      const sectionTasks = taskStates.filter((ts) => ts.task.phase === section.id);
      const done = sectionTasks.filter(
        (ts) => ts.task.optional || submissionUnlocksNext(ts.status) || ts.isComplete
      ).length;
      const total = sectionTasks.length;
      const unlocked = resolveGate(section.gate, progress, taskStates, profile);

      let status = BM100_SECTION_STATUS.LOCKED;
      if (!unlocked || total === 0) {
        status = BM100_SECTION_STATUS.LOCKED;
      } else if (done >= total) {
        status = BM100_SECTION_STATUS.DONE;
      } else {
        status = BM100_SECTION_STATUS.IN_PROGRESS;
      }

      progress[section.id] = { done, total, status, unlocked };
      return;
    }

    const unlocked = resolveGate(section.gate, progress, taskStates, profile);
    progress[section.id] = {
      done: 0,
      total: section.milestoneCount || 0,
      status: unlocked ? BM100_SECTION_STATUS.IN_PROGRESS : BM100_SECTION_STATUS.LOCKED,
      unlocked,
    };
  });

  return progress;
}

/** Phase ids the learner may work on (respects sequence + payment gates). */
export function getUnlockedPhaseIds(taskStates, profile = null) {
  const progress = computeSectionProgress(taskStates, profile);
  return new Set(BM100_PROGRAM_SECTIONS.filter((s) => progress[s.id]?.unlocked).map((s) => s.id));
}

export function getCurrentSectionId(sectionProgress) {
  const prep = sectionProgress.onboarding;
  if (prep && prep.status !== BM100_SECTION_STATUS.DONE) return 'onboarding';

  for (const section of BM100_PROGRAM_SECTIONS) {
    if (section.id === 'onboarding') continue;
    const p = sectionProgress[section.id];
    if (p?.unlocked && p.status !== BM100_SECTION_STATUS.DONE) return section.id;
  }

  return 'onboarding';
}

export function getTotalMilestones(sectionProgress) {
  return BM100_PROGRAM_SECTIONS.reduce((sum, s) => {
    const p = sectionProgress[s.id];
    if (!p?.unlocked) return sum;
    return sum + (p?.total || 0);
  }, 0);
}

export function getCompletedMilestones(sectionProgress) {
  return BM100_PROGRAM_SECTIONS.reduce((sum, s) => {
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
      reason: phaseLocked
        ? 'Full program payment required to unlock this section'
        : 'Complete the previous lesson first',
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
  return '~10 min';
}

export function isRegistrationPaymentLocked(section, sectionProgress, profile = null) {
  const p = sectionProgress[section.id];
  if (p?.unlocked) return false;
  if (!section.gate?.requiresPaid) return false;
  return !hasFullProgramAccess(profile);
}

export function hasRegistrationTierOnly(profile) {
  return normalizePaymentStatus(profile?.paymentStatus) === PAYMENT_STATUS.REGISTER;
}

function sectionTitleById(sectionId) {
  const match = BM100_PROGRAM_SECTIONS.find((s) => s.id === sectionId);
  return match?.title || sectionId;
}

function resolveProgressLockMessage(section, sectionProgress) {
  const gate = section.gate;
  if (!gate) return section.lockedMessage || 'This section is not available yet.';

  const prereqId = gate.requiresSectionId;
  if (prereqId) {
    if (gate.type === BM100_GATE_TYPES.PREPARATION) {
      return `Complete ${sectionTitleById(prereqId)} to unlock ${section.title}.`;
    }
    if (gate.type === BM100_GATE_TYPES.SEQUENCE) {
      return `Complete ${sectionTitleById(prereqId)} to unlock ${section.title}.`;
    }
  }

  return section.lockedMessage || 'This section is not available yet.';
}

export function getSectionLockDisplay(section, sectionProgress, profile = null) {
  const p = sectionProgress[section.id];
  if (p?.unlocked) return null;
  if (isRegistrationPaymentLocked(section, sectionProgress, profile)) {
    return {
      message: REGISTRATION_PAYMENT_LOCK_TOOLTIP,
      cta: section.unlockCta || { label: 'Payment support', href: '/app/support' },
    };
  }
  if (hasFullProgramAccess(profile)) {
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
