/**
 * UI-side program adapters.
 *
 * The journey components were written for 100BM but are barely about it:
 * BM100ProgramSection is 236 lines of which six mention the programme at all,
 * and those six are an import of its utils module plus a DOM id prefix. Copying
 * the tree a third time for LEP would have meant maintaining the same lesson
 * row in three places.
 *
 * Each adapter carries what a journey needs to render: the section list, the
 * status vocabulary and the programme's own progress/gating functions. The
 * components take one of these as a prop and default to 100BM, so 100BM renders
 * exactly as it did before.
 *
 * Distinct from PROGRAM_ADAPTERS in programRegistry.js, which is the CX
 * data-access side (tasks, submissions, review). This one is presentation only.
 */
import * as bm100Utils from '../utils/bm100ProgramUtils';
import * as lepUtils from '../utils/lepProgramUtils';
import {
  BM100_PROGRAM_META,
  BM100_PROGRAM_SECTIONS,
  BM100_SECTION_STATUS,
} from './bm100ProgramStructure';
import {
  LEP_PROGRAM_META,
  LEP_PROGRAM_SECTIONS,
  LEP_SECTION_STATUS,
} from './lepProgramStructure';
import { getBm100TaskTemplates } from './bm100TaskTemplates';
import { PROGRAMS } from './programTypes';

/*
 * LEP has no editable-template tasks — its work is checklists, written answers,
 * uploads and links — so it supplies none rather than borrowing 100BM's, which
 * would offer a learner a Delta Table on a Purpose Peg lesson.
 */
const noTemplates = () => [];

export const PROGRAM_UI = {
  [PROGRAMS.BM100]: {
    id: PROGRAMS.BM100,
    /** Prefix for DOM ids, so two journeys on one page cannot collide. */
    key: 'bm100',
    basePath: '/app/100bm',
    meta: {
      ...BM100_PROGRAM_META,
      shortName: '100BM',
      firstTime: {
        // Word-for-word what the panel said before it took its copy from here.
        intro:
          "You're starting a focused 6-month board-member program. Begin with Onboarding — four prep lessons before Phase 1 opens with your cohort.",
        cta: 'Start with Onboarding',
      },
    },
    sections: BM100_PROGRAM_SECTIONS,
    sectionStatus: BM100_SECTION_STATUS,
    utils: bm100Utils,
    getTaskTemplates: getBm100TaskTemplates,
  },
  [PROGRAMS.LEP]: {
    id: PROGRAMS.LEP,
    key: 'lep',
    basePath: '/app/lep',
    meta: {
      ...LEP_PROGRAM_META,
      shortName: 'LEP',
      firstTime: {
        intro:
          "You're starting a 4-week leadership program. Begin with Program Orientation — three short lessons before your first live day.",
        cta: 'Start with Orientation',
      },
    },
    sections: LEP_PROGRAM_SECTIONS,
    sectionStatus: LEP_SECTION_STATUS,
    utils: lepUtils,
    getTaskTemplates: noTemplates,
  },
};

/** The default every journey component falls back to — 100BM, unchanged. */
export const DEFAULT_PROGRAM_UI = PROGRAM_UI[PROGRAMS.BM100];

export function getProgramUi(programId) {
  return PROGRAM_UI[programId] || DEFAULT_PROGRAM_UI;
}
