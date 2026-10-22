// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { computeSectionProgress, getUnlockedPhaseIds } from './mbwProgramUtils.js';
import { SUBMISSION_STATUS, getStaticTasks } from '../services/mbwService.js';
import { PAYMENT_STATUS } from '../data/accessTiers.js';
import { PROGRAMS } from '../data/programTypes.js';

function statesAllDoneThrough(phaseId) {
  const tasks = getStaticTasks();
  return tasks.map((task) => {
    const phases = [
      'pre-preparation',
      'quarter-1',
      'quarter-2',
      'quarter-3',
      'quarter-4',
      'graduation',
    ];
    const doneThrough = phases.indexOf(phaseId);
    const taskPhase = phases.indexOf(task.phase);
    const done = taskPhase >= 0 && taskPhase <= doneThrough;
    return {
      task,
      status: done ? SUBMISSION_STATUS.COMPLETED : SUBMISSION_STATUS.LOCKED,
      isComplete: done,
      submission: done ? { status: SUBMISSION_STATUS.COMPLETED } : null,
    };
  });
}

describe('MBW Quarter 2 unlock', () => {
  it('stays locked after Q1 is done when payment is only register', () => {
    const taskStates = statesAllDoneThrough('quarter-1');
    const profile = {
      programs: [PROGRAMS.MBW],
      programAccess: { [PROGRAMS.MBW]: { paymentStatus: PAYMENT_STATUS.REGISTER } },
    };
    const progress = computeSectionProgress(taskStates, profile);
    expect(progress['quarter-1'].status).toBe('done');
    expect(progress['quarter-2'].unlocked).toBe(false);
    expect(getUnlockedPhaseIds(taskStates, profile).has('quarter-2')).toBe(false);
  });

  it('opens when Q1 is done and MBW is fully paid', () => {
    const taskStates = statesAllDoneThrough('quarter-1');
    const profile = {
      programs: [PROGRAMS.MBW],
      programAccess: { [PROGRAMS.MBW]: { paymentStatus: PAYMENT_STATUS.PAID } },
    };
    const progress = computeSectionProgress(taskStates, profile);
    expect(progress['quarter-1'].status).toBe('done');
    expect(progress['quarter-2'].unlocked).toBe(true);
    expect(getUnlockedPhaseIds(taskStates, profile).has('quarter-2')).toBe(true);
  });
});
