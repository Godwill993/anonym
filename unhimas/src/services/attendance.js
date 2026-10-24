/**
 * Attendance service — re-exports from the modules that own attendance logic.
 * Prefer importing directly from lecturerService / studentService / campusOpsService.
 */

export {
  getAttendanceForSession,
  upsertAttendance,
  markAllPresent,
  getAttendanceSummaryForBatchCourse,
  getSessionsForBatchCourse,
  createClassSession,
} from './lecturerService';

export {
  getMyAttendance,
  getMyAttendanceSummary,
} from './studentService';

export {
  clockInLecturer,
  clockOutLecturer,
  getLecturersWithShiftStatus,
  getShiftHistory,
} from './campusOpsService';
