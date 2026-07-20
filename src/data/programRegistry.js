/**
 * Program adapters for the CX (Customer Experience) app.
 * Every CX page renders through an adapter so the same UI serves all programs.
 */
import {
  getTasks as getMbwTasks,
  getSubmissionsForCx as getMbwSubmissionsForCx,
  getAllSubmissions as getAllMbwSubmissions,
  getSubmission as getMbwSubmission,
  reviewSubmission as reviewMbwSubmission,
  submissionDocId as mbwSubmissionDocId,
} from '../services/mbwService';
import {
  getTasks as getBm100Tasks,
  getSubmissionsForCx as getBm100SubmissionsForCx,
  getAllSubmissions as getAllBm100Submissions,
  getSubmission as getBm100Submission,
  reviewSubmission as reviewBm100Submission,
  submissionDocId as bm100SubmissionDocId,
} from '../services/bm100Service';
import { PROGRAMS } from './programTypes';

const noTasks = async () => [];
const noSubmissions = async () => [];

export const PROGRAM_ADAPTERS = {
  [PROGRAMS.MBW]: {
    id: PROGRAMS.MBW,
    shortLabel: 'MBW',
    hasTasks: true,
    getTasks: getMbwTasks,
    /** @param {{ batchIds?: string[], includePending?: boolean }} scope */
    getSubmissions: getMbwSubmissionsForCx,
    getAllSubmissions: getAllMbwSubmissions,
    getSubmission: getMbwSubmission,
    reviewSubmission: reviewMbwSubmission,
    submissionDocId: mbwSubmissionDocId,
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
    /** @param {{ batchIds?: string[], includePending?: boolean }} scope */
    getSubmissions: getBm100SubmissionsForCx,
    getAllSubmissions: getAllBm100Submissions,
    getSubmission: getBm100Submission,
    reviewSubmission: reviewBm100Submission,
    submissionDocId: bm100SubmissionDocId,
  },
};

export function getProgramAdapter(program) {
  return PROGRAM_ADAPTERS[program] || PROGRAM_ADAPTERS[PROGRAMS.MBW];
}
