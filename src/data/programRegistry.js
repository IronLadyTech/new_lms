/**
 * Program adapters for the CX (Customer Experience) app.
 * Every CX page renders through an adapter so the same UI serves all programs.
 */
import { getTasks as getMbwTasks, getAllSubmissions as getMbwSubmissions } from '../services/mbwService';
import { getTasks as getBm100Tasks, getAllSubmissions as getBm100Submissions } from '../services/bm100Service';
import { PROGRAMS } from './programTypes';

const noTasks = async () => [];
const noSubmissions = async () => [];

export const PROGRAM_ADAPTERS = {
  [PROGRAMS.MBW]: {
    id: PROGRAMS.MBW,
    shortLabel: 'MBW',
    hasTasks: true,
    getTasks: getMbwTasks,
    getSubmissions: getMbwSubmissions,
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
    hasTasks: true,
    getTasks: getBm100Tasks,
    getSubmissions: getBm100Submissions,
  },
};

export function getProgramAdapter(program) {
  return PROGRAM_ADAPTERS[program] || PROGRAM_ADAPTERS[PROGRAMS.MBW];
}
