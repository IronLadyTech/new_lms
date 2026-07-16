import { PROGRAMS } from './programTypes';
import { MBW_PROGRAM_SECTIONS } from './mbwProgramStructure';
import { BM100_PROGRAM_SECTIONS } from './bm100ProgramStructure';

/** Fallback bucket for legacy recordings without phaseId */
export const RECORDING_PHASE_OTHER = {
  id: 'uncategorized',
  title: 'Other recordings',
  subtitle: 'Not assigned to a phase',
};

const LEP_RECORDING_PHASES = [
  { id: 'orientation', title: 'Orientation', subtitle: 'Kickoff & welcome' },
  { id: 'live-sessions', title: 'Live sessions', subtitle: 'Program session recordings' },
  { id: 'wrap-up', title: 'Wrap-up', subtitle: 'Closing & next steps' },
];

/**
 * Phase sections CX uses when attaching batch session recording links.
 * Mirrors learner program journey where available.
 */
export function getBatchRecordingPhases(program) {
  if (program === PROGRAMS.BM100) {
    return BM100_PROGRAM_SECTIONS.map((s) => ({
      id: s.id,
      title: s.title,
      subtitle: s.subtitle || '',
    }));
  }
  if (program === PROGRAMS.LEP) {
    return LEP_RECORDING_PHASES;
  }
  // MBW default — journey sections useful for live / orientation uploads
  return MBW_PROGRAM_SECTIONS.filter((s) => s.id !== 'csuite-community').map((s) => ({
    id: s.id,
    title: s.title,
    subtitle: s.subtitle || '',
  }));
}

export function getRecordingPhaseTitle(program, phaseId) {
  if (!phaseId || phaseId === RECORDING_PHASE_OTHER.id) return RECORDING_PHASE_OTHER.title;
  const phase = getBatchRecordingPhases(program).find((p) => p.id === phaseId);
  return phase?.title || RECORDING_PHASE_OTHER.title;
}
