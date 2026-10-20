/**
 * Marks service — re-exports from the modules that own mark workflow logic.
 * Prefer importing directly from operationsService / lecturerService in new code.
 */

export {
  getMarkSubmissions,
  getSubmissionDetail,
  reviewSubmission,
} from './operationsService';

export {
  getMyMarkSubmissions,
  getOrCreateMarkSubmission,
  getMarksForSubmission,
  upsertMark,
  submitMarkSubmission,
  resubmitMarkSubmission,
} from './lecturerService';
