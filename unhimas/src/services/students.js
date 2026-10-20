/**
 * Students service — re-exports from peopleService and studentService.
 * Prefer importing directly from those modules in new code.
 */

export {
  getStudents,
  createStudent,
  updateStudent,
  deleteSchoolAccount,
} from './peopleService';

export {
  getMyStudentProfile,
  getMyStudentCourses,
  getMyAttendance,
  getMyAttendanceSummary,
  getMyResults,
  getMyTimetable,
  getMyAnnouncements,
  getStudentResources,
  getStudentResourceDownload,
  getMyUpcomingSessions,
  getStudentNotifications,
  markStudentNotificationRead,
  markAllStudentNotificationsRead,
  getStudentDashboardStats,
} from './studentService';
