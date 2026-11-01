import { lazy, Suspense } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './routes/ProtectedRoute';
import ToastContainer from './components/common/Toast';

// Auth Pages (Lazy loaded)
const LoginPage = lazy(() => import('./pages/auth/LoginPage'));
const ForgotPasswordPage = lazy(() => import('./pages/auth/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('./pages/auth/ResetPasswordPage'));
const SetNewPasswordPage = lazy(() => import('./pages/auth/SetNewPasswordPage'));
const UnauthorizedPage = lazy(() => import('./pages/auth/UnauthorizedPage'));
const PublicResultsPage = lazy(() => import('./pages/public/PublicResultsPage'));
const ApplyPage = lazy(() => import('./pages/public/ApplyPage'));
const ApplicationStatusPage = lazy(() => import('./pages/public/ApplicationStatusPage'));

// Admin Pages (Lazy loaded)
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const DepartmentsPage = lazy(() => import('./pages/admin/DepartmentsPage'));
const BatchesPage = lazy(() => import('./pages/admin/BatchesPage'));
const AcademicYearsPage = lazy(() => import('./pages/admin/AcademicYearsPage'));
const SemestersPage = lazy(() => import('./pages/admin/SemestersPage'));
const CoursesPage = lazy(() => import('./pages/admin/CoursesPage'));
const BatchCoursesPage = lazy(() => import('./pages/admin/BatchCoursesPage'));
const StudentsPage = lazy(() => import('./pages/admin/StudentsPage'));
const LecturersPage = lazy(() => import('./pages/admin/LecturersPage'));
const StaffPage = lazy(() => import('./pages/admin/StaffPage'));
const CreateAccountPage = lazy(() => import('./pages/admin/CreateAccountPage'));
const MarkApprovalPage = lazy(() => import('./pages/admin/MarkApprovalPage'));
const AdminMarksPage = lazy(() => import('./pages/admin/AdminMarksPage'));
const AdminAttendancePage = lazy(() => import('./pages/admin/AdminAttendancePage'));
const ShiftHistoryPage = lazy(() => import('./pages/admin/ShiftHistoryPage'));
const AdminResultsPage = lazy(() => import('./pages/admin/AdminResultsPage'));
const AdminTimetablePage = lazy(() => import('./pages/admin/AdminTimetablePage'));
const AdminClassSessionsPage = lazy(() => import('./pages/admin/ClassSessionsPage'));
const AdminAnnouncementsPage = lazy(() => import('./pages/admin/AdminAnnouncementsPage'));
const AdminNotificationsPage = lazy(() => import('./pages/admin/AdminNotificationsPage'));
const AdminResourcesPage = lazy(() => import('./pages/admin/AdminResourcesPage'));
const StudentTransfersPage = lazy(() => import('./pages/admin/StudentTransfersPage'));
const AcademicEventsPage = lazy(() => import('./pages/admin/AcademicEventsPage'));
const SettingsPage = lazy(() => import('./pages/admin/SettingsPage'));
const AuditLogPage = lazy(() => import('./pages/admin/AuditLogPage'));
const AdminProfilePage = lazy(() => import('./pages/admin/AdminProfilePage'));
const AdminFeesPage = lazy(() => import('./pages/admin/AdminFeesPage'));
const AdminPaymentsPage = lazy(() => import('./pages/admin/AdminPaymentsPage'));
const AdminAdmissionsPage = lazy(() => import('./pages/admin/AdminAdmissionsPage'));
const LecturerAttendancePage = lazy(() => import('./pages/admin/LecturerAttendancePage'));

// Admin Report Pages (Lazy loaded)
const ResultsReportPage = lazy(() => import('./pages/admin/reports/ResultsReportPage'));
const AttendanceReportPage = lazy(() => import('./pages/admin/reports/AttendanceReportPage'));
const CoursePerformanceReportPage = lazy(() => import('./pages/admin/reports/CoursePerformanceReportPage'));
const LecturerHoursReportPage = lazy(() => import('./pages/admin/reports/LecturerHoursReportPage'));

// Lecturer Pages (Lazy loaded)
const LecturerDashboard = lazy(() => import('./pages/lecturer/LecturerDashboard'));
const LecturerCoursesPage = lazy(() => import('./pages/lecturer/LecturerCoursesPage'));
const LecturerSessionsPage = lazy(() => import('./pages/lecturer/LecturerSessionsPage'));
const LecturerMarksPage = lazy(() => import('./pages/lecturer/LecturerMarksPage'));
const LecturerHoursPage = lazy(() => import('./pages/lecturer/LecturerHoursPage'));
const LecturerNotificationsPage = lazy(() => import('./pages/lecturer/LecturerNotificationsPage'));
const LecturerResourcesPage = lazy(() => import('./pages/lecturer/LecturerResourcesPage'));
const LecturerProfilePage = lazy(() => import('./pages/lecturer/LecturerProfilePage'));

// Student Pages (Lazy loaded)
const StudentDashboard = lazy(() => import('./pages/student/StudentDashboard'));
const StudentCoursesPage = lazy(() => import('./pages/student/StudentCoursesPage'));
const StudentAttendancePage = lazy(() => import('./pages/student/StudentAttendancePage'));
const StudentResultsPage = lazy(() => import('./pages/student/StudentResultsPage'));
const StudentTranscriptPage = lazy(() => import('./pages/student/StudentTranscriptPage'));
const StudentTimetablePage = lazy(() => import('./pages/student/StudentTimetablePage'));
const StudentAnnouncementsPage = lazy(() => import('./pages/student/StudentAnnouncementsPage'));
const StudentNotificationsPage = lazy(() => import('./pages/student/StudentNotificationsPage'));
const StudentResourcesPage = lazy(() => import('./pages/student/StudentResourcesPage'));
const StudentProfilePage = lazy(() => import('./pages/student/StudentProfilePage'));
const StudentFeesPage = lazy(() => import('./pages/student/StudentFeesPage'));
const StudentDocumentsPage = lazy(() => import('./pages/student/StudentDocumentsPage'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function AppLoading() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        gap: '1rem',
      }}
    >
      <div className="spinner" style={{ width: 36, height: 36, borderWidth: 3 }} />
      <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>
        Loading UNHIMAS…
      </span>
    </div>
  );
}

function RoleRouter() {
  const { profile, loading, session } = useAuth();
  if (loading) return <AppLoading />;
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
          <Suspense fallback={<AppLoading />}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/set-new-password" element={<SetNewPasswordPage />} />
              <Route path="/results" element={<PublicResultsPage />} />
              <Route path="/results/verify" element={<PublicResultsPage />} />
              <Route path="/apply" element={<ApplyPage />} />
              <Route path="/apply/status" element={<ApplicationStatusPage />} />
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
                      <Route path="admissions" element={<AdminAdmissionsPage />} />
                      <Route path="mark-approval" element={<MarkApprovalPage />} />
                      <Route path="marks" element={<AdminMarksPage />} />
                      <Route path="attendance" element={<AdminAttendancePage />} />
                      <Route path="shifts" element={<ShiftHistoryPage />} />
                      <Route path="shift-history" element={<ShiftHistoryPage />} />
                      <Route path="results" element={<AdminResultsPage />} />
                      <Route path="timetable" element={<AdminTimetablePage />} />
                      <Route path="class-sessions" element={<AdminClassSessionsPage />} />
                      <Route path="student-transfers" element={<StudentTransfersPage />} />
                      <Route path="academic-events" element={<AcademicEventsPage />} />
                      <Route path="announcements" element={<AdminAnnouncementsPage />} />
                      <Route path="notifications" element={<AdminNotificationsPage />} />
                      <Route path="resources" element={<AdminResourcesPage />} />
                      <Route path="fees" element={<AdminFeesPage />} />
                      <Route path="payments" element={<AdminPaymentsPage />} />
                      <Route path="lecturer-attendance" element={<LecturerAttendancePage />} />
                      <Route path="settings" element={<SettingsPage />} />
                      <Route path="audit-log" element={<AuditLogPage />} />
                      <Route path="profile" element={<AdminProfilePage />} />

                      {/* Administrative Reports */}
                      <Route path="reports/results" element={<ResultsReportPage />} />
                      <Route path="reports/attendance" element={<AttendanceReportPage />} />
                      <Route path="reports/course-performance" element={<CoursePerformanceReportPage />} />
                      <Route path="reports/lecturer-hours" element={<LecturerHoursReportPage />} />
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
                      <Route path="documents" element={<StudentDocumentsPage />} />
                      <Route path="timetable" element={<StudentTimetablePage />} />
                      <Route path="fees" element={<StudentFeesPage />} />
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
