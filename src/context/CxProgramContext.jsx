import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { PROGRAMS } from '../data/programTypes';
import { isFullAdmin } from '../utils/roles';

const STORAGE_KEY = 'cx-program';
const VALID_PROGRAMS = new Set(Object.values(PROGRAMS));

const CxProgramContext = createContext(null);

function normalizeProgram(value) {
  return VALID_PROGRAMS.has(value) ? value : null;
}

export function CxProgramProvider({ children }) {
  const { profile, role } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const assigned = normalizeProgram(profile?.program) || PROGRAMS.MBW;
  const canSwitch = isFullAdmin(role);

  const [program, setProgramState] = useState(() => {
    const fromUrl = normalizeProgram(searchParams.get('program'));
    if (fromUrl && canSwitch) return fromUrl;
    if (!canSwitch) return assigned;
    const stored = normalizeProgram(sessionStorage.getItem(STORAGE_KEY));
    return stored || assigned;
  });

  const setProgram = useCallback(
    (next) => {
      if (!canSwitch) return;
      const value = normalizeProgram(next);
      if (!value || value === program) return;
      setProgramState(value);
      sessionStorage.setItem(STORAGE_KEY, value);
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          params.set('program', value);
          return params;
        },
        { replace: true }
      );
    },
    [canSwitch, program, setSearchParams]
  );

  const effectiveProgram = canSwitch ? program : assigned;

  const value = useMemo(
    () => ({
      program: effectiveProgram,
      assignedProgram: assigned,
      canSwitchProgram: canSwitch,
      setProgram,
    }),
    [effectiveProgram, assigned, canSwitch, setProgram]
  );

  return <CxProgramContext.Provider value={value}>{children}</CxProgramContext.Provider>;
}

export function useCxProgram() {
  return useContext(CxProgramContext);
}
