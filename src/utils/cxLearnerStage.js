import { PROGRAMS } from '../data/programTypes';
import { MBW_PROGRAM_SECTIONS, MBW_SECTION_STATUS } from '../data/mbwProgramStructure';
import { BM100_PROGRAM_SECTIONS, BM100_SECTION_STATUS } from '../data/bm100ProgramStructure';
import { SUBMISSION_STATUS, TASK_TYPES } from '../services/mbwService';
import { submissionUnlocksNext } from './submissionReview';
import * as mbwProgramUtils from './mbwProgramUtils';
import * as bm100ProgramUtils from './bm100ProgramUtils';
import { buildSubmissionIndex } from './cxMetrics';

const STUCK_DAYS = 14;

function getProgramStageConfig(program) {
  if (program === PROGRAMS.BM100) {
    return {
      sections: BM100_PROGRAM_SECTIONS,
      SECTION_STATUS: BM100_SECTION_STATUS,
      computeSectionProgress: bm100ProgramUtils.computeSectionProgress,
      getCurrentSectionId: bm100ProgramUtils.getCurrentSectionId,
      getUnlockedPhaseIds: bm100ProgramUtils.getUnlockedPhaseIds,
      prepSectionId: 'onboarding',
    };
  }
  return {
    sections: MBW_PROGRAM_SECTIONS,
    SECTION_STATUS: MBW_SECTION_STATUS,
    computeSectionProgress: mbwProgramUtils.computeSectionProgress,
    getCurrentSectionId: mbwProgramUtils.getCurrentSectionId,
    getUnlockedPhaseIds: mbwProgramUtils.getUnlockedPhaseIds,
    prepSectionId: 'pre-preparation',
  };
}

function isTaskComplete(status) {
  return submissionUnlocksNext(status);
}

function parseUnlockDate(unlockDate) {
  if (!unlockDate) return null;
  const d = new Date(unlockDate);
  return Number.isNaN(d.getTime()) ? null : d;
}

function isDateUnlocked(unlockDate) {
  const d = parseUnlockDate(unlockDate);
  if (!d) return true;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return today >= d;
}

/** Reconstruct learner task states from CX submission data (no live watch progress). */
export function buildCxTaskStates(
  tasks,
  submissionsByTaskId = {},
  profile = null,
  program = PROGRAMS.MBW
) {
  const { getUnlockedPhaseIds } = getProgramStageConfig(program);

  const sequential = tasks.map((task, index) => {
    const sub = submissionsByTaskId[task.id];
    let status = sub?.status || SUBMISSION_STATUS.LOCKED;

    const prevTask = index > 0 ? tasks[index - 1] : null;
    const prevSub = prevTask ? submissionsByTaskId[prevTask.id] : null;
    const prevComplete =
      index === 0 || (prevTask && (prevTask.optional || submissionUnlocksNext(prevSub?.status)));
    const dateOk = isDateUnlocked(task.unlockDate);

    if (!prevComplete || !dateOk) {
      status = SUBMISSION_STATUS.LOCKED;
    } else if (!sub || status === SUBMISSION_STATUS.LOCKED) {
      status = SUBMISSION_STATUS.UNLOCKED;
    }

    const watched =
      !task.requiresWatch ||
      !task.videoUrl ||
      sub?.watchCompleted ||
      (sub?.watchProgress ?? 0) >= 0.9;

    return {
      task,
      submission: sub,
      status,
      watched,
      isComplete: isTaskComplete(status),
      phaseLocked: false,
    };
  });

  const unlockedPhases = getUnlockedPhaseIds(sequential, profile);
  return sequential.map((ts) => {
    if (unlockedPhases.has(ts.task.phase) || ts.isComplete) {
      return ts;
    }
    return {
      ...ts,
      status: SUBMISSION_STATUS.LOCKED,
      phaseLocked: true,
    };
  });
}

function sectionTitle(sections, sectionId) {
  return sections.find((s) => s.id === sectionId)?.title || sectionId;
}

function formatStageLabel(sectionProgress, currentSectionId, sections, SECTION_STATUS) {
  const current = sectionProgress[currentSectionId];
  if (!current) return 'Not started';

  const doneSections = sections
    .filter((s) => s.usesTaskEngine !== false)
    .filter((s) => sectionProgress[s.id]?.status === SECTION_STATUS.DONE)
    .map((s) => s.title);

  const currentTitle = sectionTitle(sections, currentSectionId);

  if (current.status === SECTION_STATUS.DONE) {
    const next = sections.find(
      (s) =>
        s.usesTaskEngine !== false &&
        sectionProgress[s.id]?.unlocked &&
        sectionProgress[s.id]?.status !== SECTION_STATUS.DONE
    );
    if (next) {
      return `${currentTitle} complete · ${next.title} next`;
    }
    if (doneSections.length === sections.filter((s) => s.usesTaskEngine !== false).length) {
      return 'All sections complete';
    }
    return `${currentTitle} complete`;
  }

  if (current.status === SECTION_STATUS.LOCKED) {
    if (!current.unlocked) return `${currentTitle} locked`;
    return `${currentTitle} locked`;
  }

  if (current.done === 0) {
    return `${currentTitle} — not started`;
  }

  return `${currentTitle} — in progress (${current.done}/${current.total})`;
}

function submissionTimestampMs(sub) {
  if (!sub) return 0;
  const raw = sub.submittedAt || sub.updatedAt || sub.createdAt;
  if (!raw) return 0;
  if (typeof raw?.toMillis === 'function') return raw.toMillis();
  if (typeof raw?.seconds === 'number') return raw.seconds * 1000;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? 0 : d.getTime();
}

export function computeLearnerStage(student, tasks, submissionIndex, program = PROGRAMS.MBW) {
  const config = getProgramStageConfig(program);
  const { sections, SECTION_STATUS, computeSectionProgress, getCurrentSectionId } = config;
  const userSubs = submissionIndex[student.id] || {};
  const taskStates = buildCxTaskStates(tasks, userSubs, student, program);
  const sectionProgress = computeSectionProgress(taskStates, student);
  const currentSectionId = getCurrentSectionId(sectionProgress);
  const currentSection = sections.find((s) => s.id === currentSectionId);
  const currentProgress = sectionProgress[currentSectionId];

  const nextTaskState =
    taskStates.find(
      (ts) =>
        ts.task.phase === currentSectionId &&
        !ts.isComplete &&
        ts.status !== SUBMISSION_STATUS.LOCKED &&
        !ts.phaseLocked
    ) ||
    taskStates.find(
      (ts) => !ts.isComplete && ts.status !== SUBMISSION_STATUS.LOCKED && !ts.phaseLocked
    );

  const userSubmissionList = Object.values(userSubs);
  const lastSubmissionMs = userSubmissionList.reduce(
    (max, sub) => Math.max(max, submissionTimestampMs(sub)),
    0
  );

  const taskEngineSections = sections.filter((s) => s.usesTaskEngine !== false);
  const allSectionsDone = taskEngineSections.every(
    (s) => sectionProgress[s.id]?.status === SECTION_STATUS.DONE
  );

  const sectionsSummary = taskEngineSections.map((section) => {
    const p = sectionProgress[section.id] || {
      done: 0,
      total: 0,
      status: SECTION_STATUS.LOCKED,
      unlocked: false,
    };
    let bucket = 'locked';
    if (p.unlocked) {
      if (p.status === SECTION_STATUS.DONE) bucket = 'complete';
      else if (p.done > 0) bucket = 'in_progress';
      else bucket = 'not_started';
    }
    return {
      id: section.id,
      title: section.title,
      done: p.done,
      total: p.total,
      status: p.status,
      unlocked: p.unlocked,
      bucket,
      label:
        p.status === SECTION_STATUS.DONE
          ? 'Done'
          : !p.unlocked
            ? 'Locked'
            : p.done > 0
              ? `${p.done}/${p.total}`
              : '—',
    };
  });

  const completedTaskCount = taskStates.filter((ts) => ts.isComplete).length;
  const stuck =
    !allSectionsDone &&
    lastSubmissionMs > 0 &&
    Date.now() - lastSubmissionMs > STUCK_DAYS * 86400000;

  return {
    learner: student,
    sectionProgress,
    currentSectionId,
    currentSectionTitle: currentSection?.title || currentSectionId,
    stageLabel: formatStageLabel(sectionProgress, currentSectionId, sections, SECTION_STATUS),
    nextTask: nextTaskState?.task || null,
    sectionsSummary,
    completedTaskCount,
    totalTasks: tasks.length,
    allSectionsDone,
    lastSubmissionMs,
    stuck,
    phaseLocked: nextTaskState?.phaseLocked || false,
  };
}

/** Batch-level funnel: how many learners in each section bucket. */
export function buildSectionStageFunnel(members, tasks, submissions, program = PROGRAMS.MBW) {
  const config = getProgramStageConfig(program);
  const submissionIndex = buildSubmissionIndex(submissions);
  const stages = members.map((m) => computeLearnerStage(m, tasks, submissionIndex, program));

  const taskEngineSections = config.sections.filter((s) => s.usesTaskEngine !== false);

  return taskEngineSections.map((section) => {
    const rows = stages.map((stage) => ({
      learner: stage.learner,
      summary: stage.sectionsSummary.find((s) => s.id === section.id),
    }));

    const complete = rows.filter((r) => r.summary?.bucket === 'complete').map((r) => r.learner);
    const inProgress = rows
      .filter((r) => r.summary?.bucket === 'in_progress')
      .map((r) => r.learner);
    const notStarted = rows
      .filter((r) => r.summary?.bucket === 'not_started')
      .map((r) => r.learner);
    const locked = rows.filter((r) => r.summary?.bucket === 'locked').map((r) => r.learner);

    return {
      id: section.id,
      title: section.title,
      subtitle: section.subtitle,
      complete,
      inProgress,
      notStarted,
      locked,
      total: members.length,
    };
  });
}

export function buildLearnerStageRows(members, tasks, submissions, program = PROGRAMS.MBW) {
  const submissionIndex = buildSubmissionIndex(submissions);
  return members
    .map((m) => computeLearnerStage(m, tasks, submissionIndex, program))
    .sort((a, b) => {
      if (a.allSectionsDone !== b.allSectionsDone) return a.allSectionsDone ? 1 : -1;
      if (a.stuck !== b.stuck) return a.stuck ? -1 : 1;
      return b.completedTaskCount - a.completedTaskCount;
    });
}

export function filterLearnerStages(stages, filter) {
  if (!filter || filter === 'all') return stages;
  if (filter === 'stuck') return stages.filter((s) => s.stuck);
  if (filter === 'complete') return stages.filter((s) => s.allSectionsDone);
  if (filter.startsWith('section:')) {
    const sectionId = filter.slice('section:'.length);
    return stages.filter((stage) => {
      const summary = stage.sectionsSummary.find((s) => s.id === sectionId);
      return summary && (summary.bucket === 'in_progress' || summary.bucket === 'not_started');
    });
  }
  if (filter.startsWith('bucket:')) {
    const [, sectionId, bucket] = filter.split(':');
    return stages.filter((stage) => {
      const summary = stage.sectionsSummary.find((s) => s.id === sectionId);
      return summary?.bucket === bucket;
    });
  }
  return stages;
}

export { STUCK_DAYS };
