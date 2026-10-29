/**
 * Attendance barrel — re-exports from modules that own attendance logic.
 * Prefer importing from lecturerService / studentService / campusOpsService / attendanceSubmit.
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
  submitSessionAttendance,
  resubmitSessionAttendance,
  canEditSessionAttendance,
} from './attendanceSubmit';

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
