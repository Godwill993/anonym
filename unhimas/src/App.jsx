import { Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import ProtectedRoute from "./routes/ProtectedRoute";
import ToastContainer from "./components/common/Toast";

// Auth Pages
import LoginPage from "./pages/auth/LoginPage";
import ForgotPasswordPage from "./pages/auth/ForgotPasswordPage";
import ResetPasswordPage from "./pages/auth/ResetPasswordPage";
import SetNewPasswordPage from "./pages/auth/SetNewPasswordPage";
import UnauthorizedPage from "./pages/auth/UnauthorizedPage";

// Public Pages
import PublicResultsPage from "./pages/public/PublicResultsPage";
import ApplyPage from "./pages/public/ApplyPage";
import ApplicationStatusPage from "./pages/public/ApplicationStatusPage";

// Admin Pages
import AdminDashboard from "./pages/admin/AdminDashboard";
import DepartmentsPage from "./pages/admin/DepartmentsPage";
import BatchesPage from "./pages/admin/BatchesPage";
import ProgrammesPage from "./pages/admin/ProgrammesPage";
import AcademicYearsPage from "./pages/admin/AcademicYearsPage";
import CoursesPage from "./pages/admin/CoursesPage";
import BatchCoursesPage from "./pages/admin/BatchCoursesPage";
import StudentsPage from "./pages/admin/StudentsPage";
import LecturersPage from "./pages/admin/LecturersPage";
import StaffPage from "./pages/admin/StaffPage";
import CreateAccountPage from "./pages/admin/CreateAccountPage";
import MarkApprovalPage from "./pages/admin/MarkApprovalPage";
import AdminMarksPage from "./pages/admin/AdminMarksPage";
import AdminAttendancePage from "./pages/admin/AdminAttendancePage";
import AdminResultsPage from "./pages/admin/AdminResultsPage";
import AdminTimetablePage from "./pages/admin/AdminTimetablePage";
import AdminClassSessionsPage from "./pages/admin/ClassSessionsPage";
import AdminAnnouncementsPage from "./pages/admin/AdminAnnouncementsPage";
import AdminNotificationsPage from "./pages/admin/AdminNotificationsPage";
import AdminResourcesPage from "./pages/admin/AdminResourcesPage";
import StudentTransfersPage from "./pages/admin/StudentTransfersPage";
import AdminFeesPage from "./pages/admin/AdminFeesPage";
import AdminPaymentsPage from "./pages/admin/AdminPaymentsPage";
import AdminAdmissionsPage from "./pages/admin/AdminAdmissionsPage";
import AcademicEventsPage from "./pages/admin/AcademicEventsPage";
import LecturerAttendancePage from "./pages/admin/LecturerAttendancePage";
import ShiftHistoryPage from "./pages/admin/ShiftHistoryPage";
import AuditLogPage from "./pages/admin/AuditLogPage";
import SettingsPage from "./pages/admin/SettingsPage";
import AdminProfilePage from "./pages/admin/AdminProfilePage";
import ResultsReportPage from "./pages/admin/reports/ResultsReportPage";
import AttendanceReportPage from "./pages/admin/reports/AttendanceReportPage";
import CoursePerformanceReportPage from "./pages/admin/reports/CoursePerformanceReportPage";
import LecturerHoursReportPage from "./pages/admin/reports/LecturerHoursReportPage";

// Lecturer Pages
import LecturerDashboard from "./pages/lecturer/LecturerDashboard";
import LecturerCoursesPage from "./pages/lecturer/LecturerCoursesPage";
import LecturerSessionsPage from "./pages/lecturer/LecturerSessionsPage";
import LecturerMarksPage from "./pages/lecturer/LecturerMarksPage";
import LecturerHoursPage from "./pages/lecturer/LecturerHoursPage";
import LecturerNotificationsPage from "./pages/lecturer/LecturerNotificationsPage";
import LecturerResourcesPage from "./pages/lecturer/LecturerResourcesPage";
import LecturerProfilePage from "./pages/lecturer/LecturerProfilePage";

// Student Pages
import StudentDashboard from "./pages/student/StudentDashboard";
import StudentCoursesPage from "./pages/student/StudentCoursesPage";
import StudentAttendancePage from "./pages/student/StudentAttendancePage";
import StudentResultsPage from "./pages/student/StudentResultsPage";
import StudentTranscriptPage from "./pages/student/StudentTranscriptPage";
import StudentTimetablePage from "./pages/student/StudentTimetablePage";
import StudentAnnouncementsPage from "./pages/student/StudentAnnouncementsPage";
import StudentNotificationsPage from "./pages/student/StudentNotificationsPage";
import StudentResourcesPage from "./pages/student/StudentResourcesPage";
import StudentProfilePage from "./pages/student/StudentProfilePage";
import StudentFeesPage from "./pages/student/StudentFeesPage";
import StudentDocumentsPage from "./pages/student/StudentDocumentsPage";

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
    case "admin":
      return <Navigate to="/admin" replace />;
    case "lecturer":
      return <Navigate to="/lecturer" replace />;
    case "student":
      return <Navigate to="/student" replace />;
    default:
      return <Navigate to="/unauthorized" replace />;
  }
}

function AppLoading() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "60vh",
        gap: "1rem",
      }}
    >
      <div className="spinner" />
      <p style={{ color: "var(--color-text-muted)" }}>Loading…</p>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router>
          <Suspense fallback={<AppLoading />}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/set-new-password" element={<SetNewPasswordPage />} />
              <Route path="/set-password" element={<SetNewPasswordPage />} />
              <Route path="/results" element={<PublicResultsPage />} />
              <Route path="/results/verify" element={<PublicResultsPage />} />
              <Route path="/apply" element={<ApplyPage />} />
              <Route path="/apply/status" element={<ApplicationStatusPage />} />
              <Route path="/unauthorized" element={<UnauthorizedPage />} />

              <Route path="/" element={<RoleRouter />} />

              <Route
                path="/admin/*"
                element={
                  <ProtectedRoute roles={["admin"]}>
                    <Routes>
                      <Route index element={<AdminDashboard />} />
                      <Route path="departments" element={<DepartmentsPage />} />
                      <Route path="batches" element={<BatchesPage />} />
                      <Route path="programmes" element={<ProgrammesPage />} />
                      <Route path="academic-years" element={<AcademicYearsPage />} />
                      <Route path="semesters" element={<Navigate to="/admin/academic-years" replace />} />
                      <Route path="courses" element={<CoursesPage />} />
                      <Route path="batch-courses" element={<BatchCoursesPage />} />
                      <Route path="students" element={<StudentsPage />} />
                      <Route path="lecturers" element={<LecturersPage />} />
                      <Route path="staff" element={<StaffPage />} />
                      <Route path="administrators" element={<StaffPage />} />
                      <Route path="create-account" element={<CreateAccountPage />} />
                      <Route path="admissions" element={<AdminAdmissionsPage />} />
                      <Route path="mark-approval" element={<MarkApprovalPage />} />
                      <Route path="marks" element={<AdminMarksPage />} />
                      <Route path="attendance" element={<AdminAttendancePage />} />
                      <Route path="results" element={<AdminResultsPage />} />
                      <Route path="timetable" element={<AdminTimetablePage />} />
                      <Route path="class-sessions" element={<AdminClassSessionsPage />} />
                      <Route path="student-transfers" element={<StudentTransfersPage />} />
                      <Route path="transfers" element={<StudentTransfersPage />} />
                      <Route path="academic-events" element={<AcademicEventsPage />} />
                      <Route path="announcements" element={<AdminAnnouncementsPage />} />
                      <Route path="notifications" element={<AdminNotificationsPage />} />
                      <Route path="resources" element={<AdminResourcesPage />} />
                      <Route path="fees" element={<AdminFeesPage />} />
                      <Route path="payments" element={<AdminPaymentsPage />} />
                      <Route path="settings" element={<SettingsPage />} />
                      <Route path="profile" element={<AdminProfilePage />} />
                      <Route path="lecturer-attendance" element={<LecturerAttendancePage />} />
                      <Route path="shift-history" element={<ShiftHistoryPage />} />
                      <Route path="audit-log" element={<AuditLogPage />} />
                      <Route path="reports/results" element={<ResultsReportPage />} />
                      <Route path="reports/attendance" element={<AttendanceReportPage />} />
                      <Route path="reports/course-performance" element={<CoursePerformanceReportPage />} />
                      <Route path="reports/performance" element={<CoursePerformanceReportPage />} />
                      <Route path="reports/lecturer-hours" element={<LecturerHoursReportPage />} />
                      <Route path="*" element={<Navigate to="/admin" replace />} />
                    </Routes>
                  </ProtectedRoute>
                }
              />

              <Route
                path="/lecturer/*"
                element={
                  <ProtectedRoute roles={["lecturer"]}>
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
                      <Route path="*" element={<Navigate to="/lecturer" replace />} />
                    </Routes>
                  </ProtectedRoute>
                }
              />

              <Route
                path="/student/*"
                element={
                  <ProtectedRoute roles={["student"]}>
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
                      <Route path="fees" element={<StudentFeesPage />} />
                      <Route path="documents" element={<StudentDocumentsPage />} />
                      <Route path="*" element={<Navigate to="/student" replace />} />
                    </Routes>
                  </ProtectedRoute>
                }
              />

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
          <ToastContainer />
        </Router>
      </AuthProvider>
    </QueryClientProvider>
  );
}
