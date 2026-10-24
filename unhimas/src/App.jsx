import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { I18nProvider } from './i18n';
import { ToastContainer } from './components/common/Toast';

// Auth pages
import LoginPage from './pages/auth/LoginPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';
import ResetPasswordPage from './pages/auth/ResetPasswordPage';
import SetNewPasswordPage from './pages/auth/SetNewPasswordPage';
import UnauthorizedPage from './pages/auth/UnauthorizedPage';

// Admin pages
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
import AdminTimetablePage from './pages/admin/AdminTimetablePage';
import ClassSessionsPage from './pages/admin/ClassSessionsPage';
import StudentTransfersPage from './pages/admin/StudentTransfersPage';
import AcademicEventsPage from './pages/admin/AcademicEventsPage';
import AdminMarksPage from './pages/admin/AdminMarksPage';
import MarkApprovalPage from './pages/admin/MarkApprovalPage';
import AdminResultsPage from './pages/admin/AdminResultsPage';
import AdminAnnouncementsPage from './pages/admin/AdminAnnouncementsPage';
import AdminResourcesPage from './pages/admin/AdminResourcesPage';
import AdminNotificationsPage from './pages/admin/AdminNotificationsPage';
import AdminAttendancePage from './pages/admin/AdminAttendancePage';
import AdminProfilePage from './pages/admin/AdminProfilePage';
import SettingsPage from './pages/admin/SettingsPage';
import AuditLogPage from './pages/admin/AuditLogPage';
import LecturerHoursReportPage from './pages/admin/reports/LecturerHoursReportPage';
import AttendanceReportPage from './pages/admin/reports/AttendanceReportPage';
import CoursePerformanceReportPage from './pages/admin/reports/CoursePerformanceReportPage';
import ResultsReportPage from './pages/admin/reports/ResultsReportPage';

// Campus operations (formerly front desk) — admin only
import LecturerAttendancePage from './pages/frontdesk/LecturerAttendancePage';
import ShiftHistoryPage from './pages/frontdesk/ShiftHistoryPage';

// Lecturer pages
import LecturerDashboard from './pages/lecturer/LecturerDashboard';
import LecturerCoursesPage from './pages/lecturer/LecturerCoursesPage';
import LecturerSessionsPage from './pages/lecturer/LecturerSessionsPage';
import LecturerAttendancePageView from './pages/lecturer/LecturerAttendancePage';
import LecturerMarksPage from './pages/lecturer/LecturerMarksPage';
import LecturerHoursPage from './pages/lecturer/LecturerHoursPage';
import LecturerNotificationsPage from './pages/lecturer/LecturerNotificationsPage';
import LecturerResourcesPage from './pages/lecturer/LecturerResourcesPage';
import LecturerProfilePage from './pages/lecturer/LecturerProfilePage';

// Student pages
import StudentDashboard from './pages/student/StudentDashboard';
import StudentCoursesPage from './pages/student/StudentCoursesPage';
import StudentAttendancePage from './pages/student/StudentAttendancePage';
import StudentResultsPage from './pages/student/StudentResultsPage';
import StudentTranscriptPage from './pages/student/StudentTranscriptPage';
import StudentTimetablePage from './pages/student/StudentTimetablePage';
import StudentAnnouncementsPage from './pages/student/StudentAnnouncementsPage';
import StudentResourcesPage from './pages/student/StudentResourcesPage';
import StudentProfilePage from './pages/student/StudentProfilePage';

// Public
import PublicResultPage from './pages/public/PublicResultPage';

import './App.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function ProtectedRoute({ children, roles }) {
  const { session, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="app-loading" style={{ display: 'grid', placeItems: 'center', minHeight: '100vh' }}>
        <div className="skeleton skeleton-box" style={{ width: 120, height: 120, borderRadius: '50%' }} />
      </div>
    );
  }

  if (!session) return <Navigate to="/login" replace />;
  if (!profile?.is_active) return <Navigate to="/unauthorized" replace />;
  if (roles && !roles.includes(profile.role)) return <Navigate to="/unauthorized" replace />;

  return children;
}

function RoleHome() {
  const { profile, loading } = useAuth();
  if (loading || !profile) return null;
  switch (profile.role) {
    case 'admin':
      return <Navigate to="/admin" replace />;
    case 'lecturer':
      return <Navigate to="/lecturer" replace />;
    case 'student':
      return <Navigate to="/student" replace />;
    case 'frontdesk':
      // Front desk removed — send legacy accounts to admin campus ops if still tagged
      return <Navigate to="/admin/lecturer-attendance" replace />;
    default:
      return <Navigate to="/unauthorized" replace />;
  }
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <I18nProvider>
          <AuthProvider>
            <BrowserRouter>
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />
                <Route path="/set-password" element={<SetNewPasswordPage />} />
                <Route path="/unauthorized" element={<UnauthorizedPage />} />
                <Route path="/verify-result" element={<PublicResultPage />} />

                <Route path="/" element={<RoleHome />} />

                {/* Admin routes (includes former front-desk campus ops) */}
                <Route
                  path="/admin"
                  element={
                    <ProtectedRoute roles={['admin']}>
                      <AdminDashboard />
                    </ProtectedRoute>
                  }
                >
                  <Route index element={<AdminDashboard />} />
                </Route>

                <Route
                  path="/admin/*"
                  element={
                    <ProtectedRoute roles={['admin']}>
                      <AdminRoutes />
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/lecturer/*"
                  element={
                    <ProtectedRoute roles={['lecturer']}>
                      <LecturerRoutes />
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/student/*"
                  element={
                    <ProtectedRoute roles={['student']}>
                      <StudentRoutes />
                    </ProtectedRoute>
                  }
                />

                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </BrowserRouter>
            <ToastContainer />
          </AuthProvider>
        </I18nProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

function AdminRoutes() {
  return (
    <Routes>
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
      <Route path="timetable" element={<AdminTimetablePage />} />
      <Route path="class-sessions" element={<ClassSessionsPage />} />
      <Route path="student-transfers" element={<StudentTransfersPage />} />
      <Route path="academic-events" element={<AcademicEventsPage />} />
      <Route path="marks" element={<AdminMarksPage />} />
      <Route path="mark-approval" element={<MarkApprovalPage />} />
      <Route path="results" element={<AdminResultsPage />} />
      <Route path="announcements" element={<AdminAnnouncementsPage />} />
      <Route path="resources" element={<AdminResourcesPage />} />
      <Route path="notifications" element={<AdminNotificationsPage />} />
      <Route path="attendance" element={<AdminAttendancePage />} />
      <Route path="profile" element={<AdminProfilePage />} />
      <Route path="settings" element={<SettingsPage />} />
      <Route path="audit-log" element={<AuditLogPage />} />
      <Route path="lecturer-attendance" element={<LecturerAttendancePage />} />
      <Route path="shift-history" element={<ShiftHistoryPage />} />
      <Route path="reports/lecturer-hours" element={<LecturerHoursReportPage />} />
      <Route path="reports/attendance" element={<AttendanceReportPage />} />
      {/* Match sidebar: /admin/reports/course-performance */}
      <Route path="reports/course-performance" element={<CoursePerformanceReportPage />} />
      <Route path="reports/performance" element={<CoursePerformanceReportPage />} />
      <Route path="reports/results" element={<ResultsReportPage />} />
      <Route path="*" element={<Navigate to="/admin" replace />} />
    </Routes>
  );
}

function LecturerRoutes() {
  return (
    <Routes>
      <Route index element={<LecturerDashboard />} />
      <Route path="courses" element={<LecturerCoursesPage />} />
      <Route path="sessions" element={<LecturerSessionsPage />} />
      <Route path="attendance" element={<LecturerAttendancePageView />} />
      <Route path="marks" element={<LecturerMarksPage />} />
      <Route path="hours" element={<LecturerHoursPage />} />
      <Route path="notifications" element={<LecturerNotificationsPage />} />
      <Route path="resources" element={<LecturerResourcesPage />} />
      <Route path="profile" element={<LecturerProfilePage />} />
      <Route path="*" element={<Navigate to="/lecturer" replace />} />
    </Routes>
  );
}

function StudentRoutes() {
  return (
    <Routes>
      <Route index element={<StudentDashboard />} />
      <Route path="courses" element={<StudentCoursesPage />} />
      <Route path="attendance" element={<StudentAttendancePage />} />
      <Route path="results" element={<StudentResultsPage />} />
      <Route path="transcript" element={<StudentTranscriptPage />} />
      <Route path="timetable" element={<StudentTimetablePage />} />
      <Route path="announcements" element={<StudentAnnouncementsPage />} />
      <Route path="resources" element={<StudentResourcesPage />} />
      <Route path="profile" element={<StudentProfilePage />} />
      <Route path="*" element={<Navigate to="/student" replace />} />
    </Routes>
  );
}
