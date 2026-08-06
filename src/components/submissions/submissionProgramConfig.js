/**
 * Per-program wiring for the shared submission components.
 *
 * The submission UI (file upload, video record/upload, template downloads) is
 * identical across programs — only the storage flag, upload function and
 * template source differ. Adding a program means adding one entry here, not
 * copying a component.
 *
 * The program key doubles as the `submissionBlobKey` scope, matching the
 * existing `program` prop convention in LearnerSubmissionPreview.
 */
import { PROGRAMS } from '../../data/programTypes';
import { MBW_STORAGE_ENABLED, uploadMbwFile } from '../../services/mbwService';
import { BM100_STORAGE_ENABLED, uploadBm100File } from '../../services/bm100Service';
import { getTaskTemplates } from '../../data/mbwTaskTemplates';
import { getBm100TaskTemplates } from '../../data/bm100TaskTemplates';

const SUBMISSION_PROGRAM_CONFIG = {
  [PROGRAMS.MBW]: {
    storageEnabled: MBW_STORAGE_ENABLED,
    uploadFile: uploadMbwFile,
    getTemplates: getTaskTemplates,
  },
  [PROGRAMS.BM100]: {
    storageEnabled: BM100_STORAGE_ENABLED,
    uploadFile: uploadBm100File,
    getTemplates: getBm100TaskTemplates,
  },
};

export function getSubmissionProgramConfig(program) {
  return SUBMISSION_PROGRAM_CONFIG[program] || SUBMISSION_PROGRAM_CONFIG[PROGRAMS.MBW];
}

export default SUBMISSION_PROGRAM_CONFIG;
