import { Suspense } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './routes/ProtectedRoute';
import ToastContainer from './components/common/Toast';

import LoginPage from './pages/auth/LoginPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';
import ResetPasswordPage from './pages/auth/ResetPasswordPage';
import SetNewPasswordPage from './pages/auth/SetNewPasswordPage';
import UnauthorizedPage from './pages/auth/UnauthorizedPage';
import PublicResultsPage from './pages/public/PublicResultsPage';

import AdminDashboard from './pages/admin/AdminDashboard';
import DepartmentsPage from './pages/admin/DepartmentsPage';
import BatchesPage from './pages/admin/BatchesPage';
import AcademicYearsPage from './pages/admin/AcademicYearsPage';
import SemestersPage from './pages/admin/SemestersPage';
import CoursesPage from './pages/admin/CoursesPage';
import BatchCoursesPage from './pages/admin/BatchCoursesPage';
import StudentsPage from './pages/admin/StudentsPage';
import LecturersPage from './pages/admin/LecturersPage';
import StaffPage from './pages/admin/StaffPage';
import CreateAccountPage from './pages/admin/CreateAccountPage';
import MarkApprovalPage from './pages/admin/MarkApprovalPage';
import AdminAttendancePage from './pages/admin/AdminAttendancePage';
import AdminResultsPage from './pages/admin/AdminResultsPage';
import AdminTimetablePage from './pages/admin/AdminTimetablePage';
import AdminClassSessionsPage from './pages/admin/ClassSessionsPage';
import AdminAnnouncementsPage from './pages/admin/AdminAnnouncementsPage';
import AdminNotificationsPage from './pages/admin/AdminNotificationsPage';
import AdminResourcesPage from './pages/admin/AdminResourcesPage';
import StudentTransfersPage from './pages/admin/StudentTransfersPage';
import AcademicEventsPage from './pages/admin/AcademicEventsPage';
import AdminReportsHub from './pages/admin/AdminReportsHub';
import LecturerHoursReportPage from './pages/admin/reports/LecturerHoursReportPage';
import AttendanceReportPage from './pages/admin/reports/AttendanceReportPage';
import CoursePerformanceReportPage from './pages/admin/reports/CoursePerformanceReportPage';
import ResultsReportPage from './pages/admin/reports/ResultsReportPage';
import SettingsPage from './pages/admin/SettingsPage';
import AuditLogPage from './pages/admin/AuditLogPage';
import AdminProfilePage from './pages/admin/AdminProfilePage';
import LecturerAttendancePage from './pages/admin/LecturerAttendancePage';
import ShiftHistoryPage from './pages/admin/ShiftHistoryPage';

import LecturerDashboard from './pages/lecturer/LecturerDashboard';
import LecturerCoursesPage from './pages/lecturer/LecturerCoursesPage';
import LecturerSessionsPage from './pages/lecturer/LecturerSessionsPage';
import LecturerMarksPage from './pages/lecturer/LecturerMarksPage';
import LecturerHoursPage from './pages/lecturer/LecturerHoursPage';
import LecturerNotificationsPage from './pages/lecturer/LecturerNotificationsPage';
import LecturerResourcesPage from './pages/lecturer/LecturerResourcesPage';
import LecturerProfilePage from './pages/lecturer/LecturerProfilePage';

import StudentDashboard from './pages/student/StudentDashboard';
import StudentCoursesPage from './pages/student/StudentCoursesPage';
import StudentAttendancePage from './pages/student/StudentAttendancePage';
import StudentResultsPage from './pages/student/StudentResultsPage';
import StudentTranscriptPage from './pages/student/StudentTranscriptPage';
import StudentTimetablePage from './pages/student/StudentTimetablePage';
import StudentAnnouncementsPage from './pages/student/StudentAnnouncementsPage';
import StudentNotificationsPage from './pages/student/StudentNotificationsPage';
import StudentResourcesPage from './pages/student/StudentResourcesPage';
import StudentProfilePage from './pages/student/StudentProfilePage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function RoleRouter() {
  const { profile, loading, session } = useAuth();
  if (loading) return null;
  if (!session) return <Navigate to="/login" replace />;
  if (!profile?.is_active) return <Navigate to="/unauthorized" replace />;
  switch (profile.role) {
    case 'admin':
      return <Navigate to="/admin" replace />;
    case 'lecturer':
      return <Navigate to="/lecturer" replace />;
    case 'student':
      return <Navigate to="/student" replace />;
    default:
      return <Navigate to="/unauthorized" replace />;
  }
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <AuthProvider>
          <Suspense fallback={<div className="app-loading">Loading…</div>}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/set-new-password" element={<SetNewPasswordPage />} />
              <Route path="/results" element={<PublicResultsPage />} />
              <Route path="/results/verify" element={<PublicResultsPage />} />
              <Route path="/unauthorized" element={<UnauthorizedPage />} />
              <Route path="/" element={<RoleRouter />} />

              <Route
                path="/admin/*"
                element={
                  <ProtectedRoute roles={['admin']}>
                    <Routes>
                      <Route index element={<AdminDashboard />} />
                      <Route path="departments" element={<DepartmentsPage />} />
                      <Route path="batches" element={<BatchesPage />} />
                      <Route path="academic-years" element={<AcademicYearsPage />} />
                      <Route path="semesters" element={<SemestersPage />} />
                      <Route path="courses" element={<CoursesPage />} />
                      <Route path="batch-courses" element={<BatchCoursesPage />} />
                      <Route path="students" element={<StudentsPage />} />
                      <Route path="lecturers" element={<LecturersPage />} />
                      <Route path="staff" element={<StaffPage />} />
                      <Route path="create-account" element={<CreateAccountPage />} />

                      {/* Marks: one workflow page; old /marks redirects here */}
                      <Route path="mark-approval" element={<MarkApprovalPage />} />
                      <Route path="marks" element={<Navigate to="/admin/mark-approval" replace />} />
                      <Route path="results" element={<AdminResultsPage />} />

                      {/* Attendance: class + campus (legacy clock-in URLs redirect) */}
                      <Route path="attendance" element={<AdminAttendancePage />} />
                      <Route path="lecturer-attendance" element={<Navigate to="/admin/attendance" replace />} />
                      <Route path="shift-history" element={<Navigate to="/admin/attendance" replace />} />

                      <Route path="timetable" element={<AdminTimetablePage />} />
                      <Route path="class-sessions" element={<AdminClassSessionsPage />} />
                      <Route path="student-transfers" element={<StudentTransfersPage />} />
                      <Route path="academic-events" element={<AcademicEventsPage />} />
                      <Route path="announcements" element={<AdminAnnouncementsPage />} />
                      <Route path="notifications" element={<AdminNotificationsPage />} />
                      <Route path="resources" element={<AdminResourcesPage />} />

                      {/* Reports: hub + detail routes */}
                      <Route path="reports" element={<AdminReportsHub />} />
                      <Route path="reports/lecturer-hours" element={<LecturerHoursReportPage />} />
                      <Route path="reports/attendance" element={<AttendanceReportPage />} />
                      <Route path="reports/course-performance" element={<CoursePerformanceReportPage />} />
                      <Route path="reports/performance" element={<CoursePerformanceReportPage />} />
                      <Route path="reports/results" element={<ResultsReportPage />} />

                      {/* Keep pages reachable if linked from old bookmarks */}
                      <Route path="lecturer-attendance-legacy" element={<LecturerAttendancePage />} />
                      <Route path="shift-history-legacy" element={<ShiftHistoryPage />} />

                      <Route path="settings" element={<SettingsPage />} />
                      <Route path="audit-log" element={<AuditLogPage />} />
                      <Route path="profile" element={<AdminProfilePage />} />
                    </Routes>
                  </ProtectedRoute>
                }
              />

              <Route
                path="/lecturer/*"
                element={
                  <ProtectedRoute roles={['lecturer']}>
                    <Routes>
                      <Route index element={<LecturerDashboard />} />
                      <Route path="courses" element={<LecturerCoursesPage />} />
                      <Route path="sessions" element={<LecturerSessionsPage />} />
                      <Route path="attendance" element={<LecturerSessionsPage />} />
                      <Route path="marks" element={<LecturerMarksPage />} />
                      <Route path="hours" element={<LecturerHoursPage />} />
                      <Route path="notifications" element={<LecturerNotificationsPage />} />
                      <Route path="resources" element={<LecturerResourcesPage />} />
                      <Route path="profile" element={<LecturerProfilePage />} />
                    </Routes>
                  </ProtectedRoute>
                }
              />

              <Route
                path="/student/*"
                element={
                  <ProtectedRoute roles={['student']}>
                    <Routes>
                      <Route index element={<StudentDashboard />} />
                      <Route path="courses" element={<StudentCoursesPage />} />
                      <Route path="attendance" element={<StudentAttendancePage />} />
                      <Route path="results" element={<StudentResultsPage />} />
                      <Route path="transcript" element={<StudentTranscriptPage />} />
                      <Route path="timetable" element={<StudentTimetablePage />} />
                      <Route path="announcements" element={<StudentAnnouncementsPage />} />
                      <Route path="notifications" element={<StudentNotificationsPage />} />
                      <Route path="resources" element={<StudentResourcesPage />} />
                      <Route path="profile" element={<StudentProfilePage />} />
                    </Routes>
                  </ProtectedRoute>
                }
              />

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
          <ToastContainer />
        </AuthProvider>
      </Router>
    </QueryClientProvider>
  );
}

export default App;
