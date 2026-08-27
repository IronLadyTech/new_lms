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
  MBW_SUBMISSIONS,
} from '../services/mbwService';
import {
  getTasks as getBm100Tasks,
  getSubmissionsForCx as getBm100SubmissionsForCx,
  getAllSubmissions as getAllBm100Submissions,
  getSubmission as getBm100Submission,
  reviewSubmission as reviewBm100Submission,
  submissionDocId as bm100SubmissionDocId,
  BM100_SUBMISSIONS,
} from '../services/bm100Service';
import {
  getTasks as getLepTasks,
  getSubmissionsForCx as getLepSubmissionsForCx,
  getAllSubmissions as getAllLepSubmissions,
  getSubmission as getLepSubmission,
  reviewSubmission as reviewLepSubmission,
  submissionDocId as lepSubmissionDocId,
  LEP_SUBMISSIONS,
} from '../services/lepService';
import { PROGRAMS } from './programTypes';

export const PROGRAM_ADAPTERS = {
  [PROGRAMS.MBW]: {
    id: PROGRAMS.MBW,
    shortLabel: 'MBW',
    hasTasks: true,
    /** Collection the paged queue reads. Null where a program has no queue. */
    submissionCollection: MBW_SUBMISSIONS,
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
    hasTasks: true,
    submissionCollection: LEP_SUBMISSIONS,
    getTasks: getLepTasks,
    /** @param {{ batchIds?: string[], includePending?: boolean }} scope */
    getSubmissions: getLepSubmissionsForCx,
    getAllSubmissions: getAllLepSubmissions,
    getSubmission: getLepSubmission,
    reviewSubmission: reviewLepSubmission,
    submissionDocId: lepSubmissionDocId,
  },
  [PROGRAMS.BM100]: {
    id: PROGRAMS.BM100,
    shortLabel: '100BM',
    hasTasks: true,
    submissionCollection: BM100_SUBMISSIONS,
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
