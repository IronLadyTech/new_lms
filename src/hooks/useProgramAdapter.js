import { useAuth } from '../context/AuthContext';
import { getProgramAdapter } from '../data/programRegistry';
import { PROGRAMS } from '../data/programTypes';

/**
 * Resolves the signed-in CX member's program from their profile.
 * Defaults to MBW until moderator profiles carry a `program` field.
 */
export function useProgramAdapter() {
  const { profile } = useAuth();
  const program = profile?.program || PROGRAMS.MBW;
  return { program, adapter: getProgramAdapter(program) };
}
