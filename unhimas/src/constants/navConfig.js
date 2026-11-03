import {
  MdDashboard,
  MdSchool,
  MdCalendarToday,
  MdBarChart,
  MdSettings,
  MdApartment,
  MdPersonPin,
  MdGrade,
  MdHowToReg,
  MdBook,
  MdPayments,
  MdReceiptLong,
  MdGroups,
  MdDateRange,
  MdSchedule,
  MdDescription,
  MdAdminPanelSettings,
  MdPersonAdd,
  MdNotifications,
  MdCampaign,
  MdFolder,
  MdHistory,
  MdPerson,
  MdEventNote,
  MdAssignment,
  MdMenuBook,
} from 'react-icons/md';

/**
 * Role navigation — daily work first, then secondary pages that already exist in App.jsx.
 * Capability keys match src/lib/permissions.js; RLS remains the security boundary.
 */
export const NAV_CONFIG = {
  admin: [
    {
      group: '',
      items: [
        { key: 'dashboard', label: 'Dashboard', path: '/admin', icon: MdDashboard },
        {
          key: 'structure',
          label: 'Structure',
          path: '/admin/departments',
          icon: MdApartment,
          capability: 'manage_academic_structure',
          children: [
            { key: 'programmes', label: 'Programmes', path: '/admin/programmes', icon: MdSchool, capability: 'manage_academic_structure' },
            { key: 'batches', label: 'Batches', path: '/admin/batches', icon: MdGroups, capability: 'manage_academic_structure' },
            { key: 'years', label: 'Years', path: '/admin/academic-years', icon: MdDateRange, capability: 'manage_academic_structure' },
            { key: 'semesters', label: 'Semesters', path: '/admin/semesters', icon: MdSchedule, capability: 'manage_academic_structure' },
            { key: 'courses', label: 'Courses', path: '/admin/courses', icon: MdBook, capability: 'manage_academic_structure' },
            { key: 'batch-courses', label: 'Batch courses', path: '/admin/batch-courses', icon: MdMenuBook, capability: 'manage_academic_structure' },
            { key: 'timetable', label: 'Timetable', path: '/admin/timetable', icon: MdCalendarToday, capability: 'manage_academic_structure' },
            { key: 'class-sessions', label: 'Class sessions', path: '/admin/class-sessions', icon: MdEventNote, capability: 'manage_academic_structure' },
          ],
        },
        {
          key: 'people',
          label: 'People',
          path: '/admin/students',
          icon: MdGroups,
          capability: 'manage_people',
          children: [
            { key: 'students', label: 'Students', path: '/admin/students', icon: MdSchool, capability: 'manage_people' },
            { key: 'lecturers', label: 'Lecturers', path: '/admin/lecturers', icon: MdPersonPin, capability: 'manage_people' },
            { key: 'administrators', label: 'Administrators', path: '/admin/administrators', icon: MdAdminPanelSettings, capability: 'manage_people' },
            { key: 'create-account', label: 'Create account', path: '/admin/create-account', icon: MdPersonAdd, capability: 'create_accounts' },
          ],
        },
        { key: 'admissions', label: 'Admissions', path: '/admin/admissions', icon: MdHowToReg, capability: 'manage_admissions' },
        {
          key: 'fees',
          label: 'Fees',
          path: '/admin/fees',
          icon: MdPayments,
          capability: 'manage_fees',
          children: [
            { key: 'payments', label: 'Payments', path: '/admin/payments', icon: MdReceiptLong, capability: 'manage_fees' },
          ],
        },
        { key: 'marks', label: 'Marks', path: '/admin/mark-approval', icon: MdGrade, capability: 'approve_marks' },
        { key: 'attendance', label: 'Attendance', path: '/admin/attendance', icon: MdHowToReg, capability: 'approve_attendance' },
        { key: 'results', label: 'Results', path: '/admin/results', icon: MdBarChart },
        {
          key: 'campus',
          label: 'Campus',
          path: '/admin/announcements',
          icon: MdCampaign,
          children: [
            { key: 'announcements', label: 'Announcements', path: '/admin/announcements', icon: MdCampaign, capability: 'manage_announcements' },
            { key: 'notifications', label: 'Notifications', path: '/admin/notifications', icon: MdNotifications },
            { key: 'resources', label: 'Resources', path: '/admin/resources', icon: MdFolder, capability: 'manage_resources' },
            { key: 'lecturer-attendance', label: 'Lecturer attendance', path: '/admin/lecturer-attendance', icon: MdAssignment, capability: 'clock_lecturers' },
          ],
        },
        {
          key: 'reports',
          label: 'Reports',
          path: '/admin/reports/results',
          icon: MdBarChart,
          children: [
            { key: 'results-report', label: 'Results Report', path: '/admin/reports/results', icon: MdGrade },
            { key: 'attendance-report', label: 'Attendance Report', path: '/admin/reports/attendance', icon: MdHowToReg },
            { key: 'course-perf', label: 'Course Performance', path: '/admin/reports/course-performance', icon: MdBarChart },
            { key: 'lecturer-hours', label: 'Lecturer Hours', path: '/admin/reports/lecturer-hours', icon: MdSchedule },
          ],
        },
        {
          key: 'system',
          label: 'System',
          path: '/admin/settings',
          icon: MdSettings,
          children: [
            { key: 'settings', label: 'Settings', path: '/admin/settings', icon: MdSettings, capability: 'manage_settings' },
            { key: 'audit-log', label: 'Audit log', path: '/admin/audit-log', icon: MdHistory, capability: 'view_audit_log' },
            { key: 'profile', label: 'Profile', path: '/admin/profile', icon: MdPerson },
          ],
        },
      ],
    },
  ],

  lecturer: [
    {
      group: '',
      items: [
        { key: 'dashboard', label: 'Dashboard', path: '/lecturer', icon: MdDashboard },
        { key: 'courses', label: 'Courses', path: '/lecturer/courses', icon: MdBook },
        {
          key: 'sessions',
          label: 'Sessions',
          path: '/lecturer/sessions',
          icon: MdHowToReg,
          capability: 'mark_attendance',
        },
        { key: 'marks', label: 'Marks', path: '/lecturer/marks', icon: MdGrade, capability: 'enter_marks' },
        { key: 'hours', label: 'Hours', path: '/lecturer/hours', icon: MdSchedule },
        { key: 'resources', label: 'Resources', path: '/lecturer/resources', icon: MdFolder },
        { key: 'notifications', label: 'Notifications', path: '/lecturer/notifications', icon: MdNotifications },
        { key: 'profile', label: 'Profile', path: '/lecturer/profile', icon: MdPerson },
      ],
    },
  ],

  student: [
    {
      group: '',
      items: [
        { key: 'dashboard', label: 'Dashboard', path: '/student', icon: MdDashboard },
        { key: 'courses', label: 'Courses', path: '/student/courses', icon: MdBook },
        { key: 'attendance', label: 'Attendance', path: '/student/attendance', icon: MdHowToReg },
        { key: 'results', label: 'Results', path: '/student/results', icon: MdGrade, capability: 'view_own_results' },
        { key: 'transcript', label: 'Transcript', path: '/student/transcript', icon: MdDescription, capability: 'view_own_transcript' },
        { key: 'fees', label: 'Fees', path: '/student/fees', icon: MdPayments, capability: 'view_own_fees' },
        { key: 'documents', label: 'Documents', path: '/student/documents', icon: MdDescription },
        { key: 'timetable', label: 'Timetable', path: '/student/timetable', icon: MdCalendarToday },
        { key: 'announcements', label: 'Announcements', path: '/student/announcements', icon: MdCampaign },
        { key: 'resources', label: 'Resources', path: '/student/resources', icon: MdFolder },
        { key: 'notifications', label: 'Notifications', path: '/student/notifications', icon: MdNotifications },
        { key: 'profile', label: 'Profile', path: '/student/profile', icon: MdPerson },
      ],
    },
  ],
};
