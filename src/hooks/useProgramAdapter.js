import { useAuth } from '../context/AuthContext';
import { useCxProgram } from '../context/CxProgramContext';
import { getProgramAdapter } from '../data/programRegistry';
import { PROGRAMS } from '../data/programTypes';

/**
 * Resolves the CX member's active program.
 * Moderators are scoped to profile.program; admins can switch via CxProgramContext.
 */
export function useProgramAdapter() {
  const { profile } = useAuth();
  const cxProgram = useCxProgram();
  const program = cxProgram?.program || profile?.program || PROGRAMS.MBW;
  return {
    program,
    adapter: getProgramAdapter(program),
    canSwitchProgram: cxProgram?.canSwitchProgram ?? false,
    setProgram: cxProgram?.setProgram,
  };
}
