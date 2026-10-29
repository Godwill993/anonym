import {
  MdDashboard,
  MdSchool,
  MdCalendarToday,
  MdBarChart,
  MdSettings,
  MdApartment,
  MdDateRange,
  MdSchedule,
  MdGroups,
  MdPersonPin,
  MdAssignment,
  MdGrade,
  MdHowToReg,
  MdCampaign,
  MdNotifications,
  MdFolder,
  MdAccessTime,
  MdHistory,
  MdLogin,
  MdBook,
  MdAdminPanelSettings,
} from 'react-icons/md';

/** Navigation tree keyed by role. Optional `capability` hides the item when can() is false.
 *  Optional `children` nest related pages under a parent (e.g. Batches under Departments).
 *  Batch programme (courses) is managed on the Batches page — not a separate nav item.
 *  Campus operations (clock-in) are admin-only.
 *  Profile is intentionally omitted — it lives in the header user menu.
 *
 *  Class attendance approval: /admin/attendance (student class sessions submitted by lecturers).
 *  Lecturer clock-in: /admin/lecturer-attendance (campus presence).
 */
export const NAV_CONFIG = {
  admin: [
    {
      group: 'Overview',
      items: [
        { key: 'dashboard', label: 'Dashboard', path: '/admin', icon: MdDashboard },
      ],
    },
    {
      group: 'Academic Structure',
      items: [
        {
          key: 'departments',
          label: 'Departments',
          path: '/admin/departments',
          icon: MdApartment,
          capability: 'manage_academic_structure',
          children: [
            {
              key: 'batches',
              label: 'Batches',
              path: '/admin/batches',
              icon: MdGroups,
              capability: 'manage_academic_structure',
            },
          ],
        },
        {
          key: 'academic-years',
          label: 'Academic Years',
          path: '/admin/academic-years',
          icon: MdDateRange,
          capability: 'manage_academic_structure',
          children: [
            {
              key: 'semesters',
              label: 'Semesters',
              path: '/admin/semesters',
              icon: MdSchedule,
              capability: 'manage_academic_structure',
            },
          ],
        },
        {
          key: 'courses',
          label: 'Courses',
          path: '/admin/courses',
          icon: MdBook,
          capability: 'manage_academic_structure',
        },
      ],
    },
    {
      group: 'People',
      items: [
        { key: 'students', label: 'Students', path: '/admin/students', icon: MdSchool, capability: 'manage_people' },
        { key: 'lecturers', label: 'Lecturers', path: '/admin/lecturers', icon: MdPersonPin, capability: 'manage_people' },
        { key: 'administrators', label: 'Administrators', path: '/admin/staff', icon: MdAdminPanelSettings, capability: 'manage_people' },
      ],
    },
    {
      group: 'Campus Operations',
      items: [
        { key: 'lecturer-attendance', label: 'Lecturer Clock-in', path: '/admin/lecturer-attendance', icon: MdLogin, capability: 'clock_lecturers' },
        { key: 'shift-history', label: 'Shift History', path: '/admin/shift-history', icon: MdHistory, capability: 'clock_lecturers' },
      ],
    },
    {
      group: 'Academic Operations',
      items: [
        { key: 'timetable', label: 'Timetable', path: '/admin/timetable', icon: MdCalendarToday, capability: 'manage_academic_structure' },
        { key: 'class-sessions', label: 'Class Sessions', path: '/admin/class-sessions', icon: MdSchedule, capability: 'manage_academic_structure' },
        { key: 'student-transfers', label: 'Student Transfers', path: '/admin/student-transfers', icon: MdGroups, capability: 'manage_people' },
        { key: 'academic-events', label: 'Academic Events', path: '/admin/academic-events', icon: MdDateRange, capability: 'manage_academic_structure' },
        { key: 'marks', label: 'Marks', path: '/admin/marks', icon: MdGrade },
        { key: 'mark-approval', label: 'Mark Approval', path: '/admin/mark-approval', icon: MdAssignment, capability: 'approve_marks' },
        {
          key: 'class-attendance',
          label: 'Class Attendance',
          path: '/admin/attendance',
          icon: MdHowToReg,
          capability: 'approve_attendance',
        },
        { key: 'results', label: 'Results', path: '/admin/results', icon: MdBarChart },
        { key: 'announcements', label: 'Announcements', path: '/admin/announcements', icon: MdCampaign },
        { key: 'resources', label: 'Resources', path: '/admin/resources', icon: MdFolder },
        { key: 'notifications', label: 'Notifications', path: '/admin/notifications', icon: MdNotifications },
      ],
    },
    {
      group: 'Reports',
      items: [
        { key: 'lecturer-hours', label: 'Lecturer Hours', path: '/admin/reports/lecturer-hours', icon: MdAccessTime },
        { key: 'attendance-reports', label: 'Attendance Reports', path: '/admin/reports/attendance', icon: MdHowToReg },
        { key: 'course-performance', label: 'Academic Performance', path: '/admin/reports/course-performance', icon: MdBarChart },
        { key: 'results-reports', label: 'Results Reports', path: '/admin/reports/results', icon: MdBarChart },
      ],
    },
    {
      group: 'System',
      items: [
        { key: 'settings', label: 'Settings', path: '/admin/settings', icon: MdSettings, capability: 'manage_settings' },
        { key: 'audit-log', label: 'Audit Log', path: '/admin/audit-log', icon: MdHistory, capability: 'view_audit_log' },
      ],
    },
  ],

  lecturer: [
    {
      group: 'Overview',
      items: [
        { key: 'dashboard', label: 'Dashboard', path: '/lecturer', icon: MdDashboard },
      ],
    },
    {
      group: 'Teaching',
      items: [
        { key: 'my-courses', label: 'My Courses', path: '/lecturer/courses', icon: MdBook },
        {
          key: 'sessions-attendance',
          label: 'Sessions & Attendance',
          path: '/lecturer/sessions',
          icon: MdHowToReg,
          capability: 'mark_attendance',
        },
        { key: 'marks', label: 'Marks', path: '/lecturer/marks', icon: MdGrade, capability: 'enter_marks' },
      ],
    },
    {
      group: 'Info',
      items: [
        { key: 'my-hours', label: 'My Hours', path: '/lecturer/hours', icon: MdAccessTime },
        { key: 'notifications', label: 'Notifications', path: '/lecturer/notifications', icon: MdNotifications },
        { key: 'resources', label: 'Resources', path: '/lecturer/resources', icon: MdFolder },
      ],
    },
  ],

  student: [
    {
      group: 'Overview',
      items: [
        { key: 'dashboard', label: 'Dashboard', path: '/student', icon: MdDashboard },
      ],
    },
    {
      group: 'Academic',
      items: [
        { key: 'my-courses', label: 'My Courses', path: '/student/courses', icon: MdBook },
        { key: 'attendance', label: 'Attendance', path: '/student/attendance', icon: MdHowToReg },
        { key: 'results', label: 'Results', path: '/student/results', icon: MdAssignment, capability: 'view_own_results' },
        { key: 'transcript', label: 'Transcript', path: '/student/transcript', icon: MdAssignment, capability: 'view_own_transcript' },
        { key: 'timetable', label: 'Timetable', path: '/student/timetable', icon: MdCalendarToday },
      ],
    },
    {
      group: 'Info',
      items: [
        { key: 'announcements', label: 'Announcements', path: '/student/announcements', icon: MdCampaign },
        { key: 'notifications', label: 'Notifications', path: '/student/notifications', icon: MdNotifications },
        { key: 'resources', label: 'Resources', path: '/student/resources', icon: MdFolder },
      ],
    },
  ],
};
