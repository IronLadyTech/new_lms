/**
 * Program adapters for the CX (Customer Experience) app.
 * Every CX page renders through an adapter so the same UI serves all programs.
 * LEP and 100BM have no task journey yet — their boards stay hidden until
 * task definitions exist and hasTasks flips to true.
 */
import { getTasks, getAllSubmissions } from '../services/mbwService';
import { PROGRAMS } from './programTypes';

const noTasks = async () => [];
const noSubmissions = async () => [];

export const PROGRAM_ADAPTERS = {
  [PROGRAMS.MBW]: {
    id: PROGRAMS.MBW,
    shortLabel: 'MBW',
    hasTasks: true,
    getTasks,
    getSubmissions: getAllSubmissions,
  },
  [PROGRAMS.LEP]: {
    id: PROGRAMS.LEP,
    shortLabel: 'LEP',
    hasTasks: false,
    getTasks: noTasks,
    getSubmissions: noSubmissions,
  },
  [PROGRAMS.BM100]: {
    id: PROGRAMS.BM100,
    shortLabel: '100BM',
    hasTasks: false,
    getTasks: noTasks,
    getSubmissions: noSubmissions,
  },
};

export function getProgramAdapter(program) {
  return PROGRAM_ADAPTERS[program] || PROGRAM_ADAPTERS[PROGRAMS.MBW];
}
