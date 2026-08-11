import { describe, it, expect } from 'vitest';
import {
  getProgramProgressPct,
  getCohortLabel,
  isPreparationComplete,
  computeSectionProgress,
  getCurrentSectionId,
  getTotalMilestones,
  getCompletedMilestones,
  getTaskDurationHint,
  isRegistrationPaymentLocked,
  hasRegistrationTierOnly,
  getSectionLockDisplay,
} from './bm100ProgramUtils';
import { SUBMISSION_STATUS, TASK_TYPES } from '../services/bm100Service';
import { BM100_PROGRAM_SECTIONS } from '../data/bm100ProgramStructure';
import { PAYMENT_STATUS } from '../data/accessTiers';

/**
 * 100 Board Members gates sections on payment tier and on completing the
 * previous section. A gate that opens too early gives away paid content; one
 * that never opens strands a paying learner. Both directions are tested.
 */

const ts = (phase, status = SUBMISSION_STATUS.UNLOCKED, extra = {}) => ({
  task: { id: `${phase}-${Math.random()}`, phase, ...extra },
  status,
  isComplete: status === SUBMISSION_STATUS.COMPLETED,
});

describe('getProgramProgressPct', () => {
  it('rounds a normal ratio', () => {
    expect(getProgramProgressPct(1, 3)).toBe(33);
    expect(getProgramProgressPct(2, 4)).toBe(50);
    expect(getProgramProgressPct(3, 3)).toBe(100);
  });

  it('is 0 rather than NaN when nothing is tracked', () => {
    expect(getProgramProgressPct(0, 0)).toBe(0);
    expect(getProgramProgressPct(5, 0)).toBe(0);
  });
});

describe('getCohortLabel', () => {
  it('prefers the batch name', () => {
    expect(getCohortLabel({ batchName: 'Jan 2026 Cohort', batchId: 'b1' })).toBe('Jan 2026 Cohort');
  });

  it('falls back to the batch id', () => {
    expect(getCohortLabel({ batchId: 'b1' })).toBe('Batch b1');
  });

  it('derives a month-year cohort from the join date', () => {
    expect(getCohortLabel({ createdAt: new Date('2026-03-04T00:00:00Z') })).toMatch(/2026 cohort$/);
  });

  it('never shows "Invalid Date" or an empty label', () => {
    expect(getCohortLabel({ createdAt: 'nonsense' })).toBe('Your cohort');
    expect(getCohortLabel({})).toBe('Your cohort');
    expect(getCohortLabel(null)).toBe('Your cohort');
  });
});

describe('isPreparationComplete', () => {
  it('is false when there is nothing to judge', () => {
    expect(isPreparationComplete([])).toBe(false);
    expect(isPreparationComplete(null)).toBe(false);
    expect(isPreparationComplete([ts('quarter-1')])).toBe(false);
  });

  it('is false while any required onboarding task is outstanding', () => {
    expect(
      isPreparationComplete([
        ts('onboarding', SUBMISSION_STATUS.COMPLETED),
        ts('onboarding', SUBMISSION_STATUS.UNLOCKED),
      ])
    ).toBe(false);
  });

  it('is true once every required onboarding task passes', () => {
    expect(
      isPreparationComplete([
        ts('onboarding', SUBMISSION_STATUS.COMPLETED),
        ts('onboarding', SUBMISSION_STATUS.SUBMITTED),
      ])
    ).toBe(true);
  });

  it('ignores optional onboarding tasks', () => {
    expect(
      isPreparationComplete([
        ts('onboarding', SUBMISSION_STATUS.COMPLETED),
        ts('onboarding', SUBMISSION_STATUS.UNLOCKED, { optional: true }),
      ])
    ).toBe(true);
  });
});

describe('computeSectionProgress / milestone totals', () => {
  const states = [
    ts('onboarding', SUBMISSION_STATUS.COMPLETED),
    ts('onboarding', SUBMISSION_STATUS.UNLOCKED),
  ];

  it('returns an entry for every declared section', () => {
    const progress = computeSectionProgress(states, { paymentStatus: PAYMENT_STATUS.PAID });
    for (const section of BM100_PROGRAM_SECTIONS) {
      expect(progress[section.id]).toBeDefined();
    }
  });

  it('never reports more completed than total', () => {
    const progress = computeSectionProgress(states, { paymentStatus: PAYMENT_STATUS.PAID });
    expect(getCompletedMilestones(progress)).toBeLessThanOrEqual(getTotalMilestones(progress));
  });

  it('counts no milestones for an empty programme', () => {
    const progress = computeSectionProgress([], null);
    expect(getCompletedMilestones(progress)).toBe(0);
  });

  it('picks a current section that actually exists', () => {
    const progress = computeSectionProgress(states, { paymentStatus: PAYMENT_STATUS.PAID });
    const current = getCurrentSectionId(progress);
    if (current !== null) {
      expect(BM100_PROGRAM_SECTIONS.some((s) => s.id === current)).toBe(true);
    }
  });
});

describe('payment gating', () => {
  const paidSection = BM100_PROGRAM_SECTIONS.find((s) => s.gate?.requiresPaid);

  it('identifies a registration-only learner', () => {
    expect(hasRegistrationTierOnly({ paymentStatus: PAYMENT_STATUS.REGISTER })).toBe(true);
    expect(hasRegistrationTierOnly({ paymentStatus: PAYMENT_STATUS.PAID })).toBe(false);
    expect(hasRegistrationTierOnly({})).toBe(false);
  });

  it('locks a paid section for a registration-only learner', () => {
    if (!paidSection) return;
    const progress = { [paidSection.id]: { unlocked: false } };
    expect(
      isRegistrationPaymentLocked(paidSection, progress, { paymentStatus: PAYMENT_STATUS.REGISTER })
    ).toBe(true);
  });

  it('does not report a payment lock once the section is unlocked', () => {
    if (!paidSection) return;
    const progress = { [paidSection.id]: { unlocked: true } };
    expect(
      isRegistrationPaymentLocked(paidSection, progress, { paymentStatus: PAYMENT_STATUS.REGISTER })
    ).toBe(false);
  });

  it('explains a payment lock with a route to support, not a dead end', () => {
    if (!paidSection) return;
    const display = getSectionLockDisplay(
      paidSection,
      { [paidSection.id]: { unlocked: false } },
      {
        paymentStatus: PAYMENT_STATUS.REGISTER,
      }
    );
    expect(display).not.toBeNull();
    expect(display.message).toMatch(/payment/i);
    expect(display.cta).toBeTruthy();
  });

  it('shows no lock message for an unlocked section', () => {
    const anySection = BM100_PROGRAM_SECTIONS[0];
    expect(
      getSectionLockDisplay(anySection, { [anySection.id]: { unlocked: true } }, {})
    ).toBeNull();
  });
});

describe('getTaskDurationHint', () => {
  it('describes each task type', () => {
    expect(getTaskDurationHint({ type: TASK_TYPES.WATCH_ONLY })).toMatch(/video/i);
    expect(getTaskDurationHint({ type: TASK_TYPES.FILE_UPLOAD })).toBe('Upload');
    expect(getTaskDurationHint({ type: TASK_TYPES.EDITABLE_TEMPLATE })).toBe('Template');
    expect(getTaskDurationHint({ type: TASK_TYPES.CHECKLIST })).toBe('Checklist');
  });

  it('uses the configured cadence for recurring posts', () => {
    expect(getTaskDurationHint({ type: TASK_TYPES.RECURRING_POST, postsPerWeek: 3 })).toBe(
      '3/week'
    );
    expect(getTaskDurationHint({ type: TASK_TYPES.RECURRING_POST })).toBe('1/week');
  });

  it('always returns something rather than an empty chip', () => {
    expect(getTaskDurationHint({ type: 'unknown' })).toBeTruthy();
    expect(getTaskDurationHint({})).toBeTruthy();
  });
});
