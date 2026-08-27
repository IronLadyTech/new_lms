import { describe, it, expect } from 'vitest';
import { PROGRAM_UI, DEFAULT_PROGRAM_UI, getProgramUi } from './programUiAdapters';
import { PROGRAMS } from './programTypes';

/*
 * The journey components were made generic so LEP could reuse them instead of
 * becoming a third copy. Every component defaults to 100BM, so the risk that
 * matters is a default drifting and silently rewording a live programme.
 */
describe('program UI adapters', () => {
  it('defaults to 100BM', () => {
    expect(DEFAULT_PROGRAM_UI).toBe(PROGRAM_UI[PROGRAMS.BM100]);
    expect(getProgramUi('nonsense')).toBe(PROGRAM_UI[PROGRAMS.BM100]);
  });

  it('keeps 100BM welcome copy exactly as it was before it moved here', () => {
    const { firstTime, title, shortName } = PROGRAM_UI[PROGRAMS.BM100].meta;
    expect(title).toBe('100 Board Members');
    // The lesson eyebrow reads "Iron Lady · <shortName> · <section>".
    expect(shortName).toBe('100BM');
    expect(firstTime.intro).toBe(
      "You're starting a focused 6-month board-member program. Begin with Onboarding — four prep lessons before Phase 1 opens with your cohort."
    );
    expect(firstTime.cta).toBe('Start with Onboarding');
  });

  it('never shows one programme another programme s words', () => {
    const lep = PROGRAM_UI[PROGRAMS.LEP];
    const foreign = ['100 Board Members', '100BM', 'Onboarding', 'Phase 1', 'board-member'];
    const lepCopy = [
      lep.meta.title,
      lep.meta.shortName,
      lep.meta.tagline,
      lep.meta.firstTime.intro,
      lep.meta.firstTime.cta,
      ...lep.sections.map((s) => `${s.title} ${s.subtitle} ${s.lockedMessage || ''}`),
    ].join(' ');
    expect(foreign.filter((w) => lepCopy.includes(w))).toEqual([]);
  });

  it('gives every adapter the full shape the components read', () => {
    Object.entries(PROGRAM_UI).forEach(([id, ui]) => {
      expect(ui.id, `${id}.id`).toBe(id);
      expect(typeof ui.key, `${id}.key`).toBe('string');
      expect(ui.basePath, `${id}.basePath`).toMatch(/^\/app\//);
      expect(ui.sections.length, `${id}.sections`).toBeGreaterThan(0);
      expect(ui.sectionStatus.DONE, `${id}.sectionStatus`).toBe('done');
      expect(typeof ui.getTaskTemplates, `${id}.getTaskTemplates`).toBe('function');
      // The utils each component destructures off the adapter.
      [
        'getLessonRowState',
        'getTaskTypeIcon',
        'getTaskDurationHint',
        'getTaskKindLabel',
        'getSectionLockDisplay',
        'isRegistrationPaymentLocked',
      ].forEach((fn) => {
        expect(typeof ui.utils[fn], `${id}.utils.${fn}`).toBe('function');
      });
      expect(typeof ui.utils.REGISTRATION_PAYMENT_LOCK_TOOLTIP, `${id} tooltip`).toBe('string');
    });
  });

  it('keeps DOM id prefixes unique so two journeys cannot collide', () => {
    const keys = Object.values(PROGRAM_UI).map((u) => u.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
