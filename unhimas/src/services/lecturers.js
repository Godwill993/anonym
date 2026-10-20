/**
 * Lecturers service — re-exports from peopleService and lecturerService.
 * Prefer importing directly from those modules in new code.
 */

export {
  getLecturers,
  createLecturer,
  updateLecturer,
  deleteSchoolAccount,
} from './peopleService';

export {
  getMyLecturerProfile,
  getMyCourses,
  getTodaySessions,
  getUpcomingSessions,
  getMyMarkSubmissions,
  getOrCreateMarkSubmission,
  getMarksForSubmission,
  getStudentsInBatch,
  upsertMark,
  submitMarkSubmission,
  resubmitMarkSubmission,
  getSessionsForBatchCourse,
  createClassSession,
  getAttendanceForSession,
  upsertAttendance,
  markAllPresent,
  getMyShifts,
  getMyNotifications,
  getLecturerResources,
  getLecturerResourceDownload,
  markNotificationRead,
  markAllNotificationsRead,
  getLecturerDashboardStats,
  getAttendanceSummaryForBatchCourse,
} from './lecturerService';
