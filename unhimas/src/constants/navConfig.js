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
  MdHowToReg,
  MdCampaign,
  MdFolder,
  MdBook,
  MdAdminPanelSettings,
  MdHistory,
  MdSwapHoriz,
  MdEvent,
} from 'react-icons/md';

/**
 * Compact role navigation. Prefer nested children over long flat lists.
 * Duplicate workflows share one entry (Marks = approve+publish, Attendance = class+campus).
 * Profile lives in the header user menu — not in the sidebar.
 */
export const NAV_CONFIG = {
  admin: [
    {
      group: 'Main',
      items: [
        { key: 'dashboard', label: 'Dashboard', path: '/admin', icon: MdDashboard },
      ],
    },
    {
      group: 'Structure',
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
          label: 'Years & Semesters',
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
        {
          key: 'students',
          label: 'Students',
          path: '/admin/students',
          icon: MdSchool,
          capability: 'manage_people',
          children: [
            {
              key: 'student-transfers',
              label: 'Transfers',
              path: '/admin/student-transfers',
              icon: MdSwapHoriz,
              capability: 'manage_people',
            },
          ],
        },
        {
          key: 'lecturers',
          label: 'Lecturers',
          path: '/admin/lecturers',
          icon: MdPersonPin,
          capability: 'manage_people',
        },
        {
          key: 'administrators',
          label: 'Admins',
          path: '/admin/staff',
          icon: MdAdminPanelSettings,
          capability: 'manage_people',
        },
      ],
    },
    {
      group: 'Operations',
      items: [
        {
          key: 'timetable',
          label: 'Schedule',
          path: '/admin/timetable',
          icon: MdCalendarToday,
          capability: 'manage_academic_structure',
          children: [
            {
              key: 'class-sessions',
              label: 'Sessions',
              path: '/admin/class-sessions',
              icon: MdSchedule,
              capability: 'manage_academic_structure',
            },
            {
              key: 'academic-events',
              label: 'Events',
              path: '/admin/academic-events',
              icon: MdEvent,
              capability: 'manage_academic_structure',
            },
          ],
        },
        {
          key: 'marks',
          label: 'Marks',
          path: '/admin/mark-approval',
          icon: MdAssignment,
          capability: 'approve_marks',
          children: [
            {
              key: 'results',
              label: 'Published',
              path: '/admin/results',
              icon: MdBarChart,
            },
          ],
        },
        {
          key: 'attendance',
          label: 'Attendance',
          path: '/admin/attendance',
          icon: MdHowToReg,
          capability: 'approve_attendance',
        },
        {
          key: 'resources',
          label: 'Resources',
          path: '/admin/resources',
          icon: MdFolder,
        },
        {
          key: 'announcements',
          label: 'Announcements',
          path: '/admin/announcements',
          icon: MdCampaign,
        },
      ],
    },
    {
      group: 'Insights',
      items: [
        {
          key: 'reports',
          label: 'Reports',
          path: '/admin/reports',
          icon: MdBarChart,
        },
      ],
    },
    {
      group: 'System',
      items: [
        {
          key: 'settings',
          label: 'Settings',
          path: '/admin/settings',
          icon: MdSettings,
          capability: 'manage_settings',
          children: [
            {
              key: 'audit-log',
              label: 'Audit log',
              path: '/admin/audit-log',
              icon: MdHistory,
              capability: 'view_audit_log',
            },
          ],
        },
      ],
    },
  ],

  lecturer: [
    {
      group: 'Main',
      items: [
        { key: 'dashboard', label: 'Dashboard', path: '/lecturer', icon: MdDashboard },
        { key: 'my-courses', label: 'Courses', path: '/lecturer/courses', icon: MdBook },
        {
          key: 'sessions-attendance',
          label: 'Sessions',
          path: '/lecturer/sessions',
          icon: MdHowToReg,
          capability: 'mark_attendance',
        },
        {
          key: 'marks',
          label: 'Marks',
          path: '/lecturer/marks',
          icon: MdAssignment,
          capability: 'enter_marks',
        },
      ],
    },
    {
      group: 'More',
      items: [
        { key: 'my-hours', label: 'Hours', path: '/lecturer/hours', icon: MdSchedule },
        { key: 'resources', label: 'Resources', path: '/lecturer/resources', icon: MdFolder },
      ],
    },
  ],

  student: [
    {
      group: 'Main',
      items: [
        { key: 'dashboard', label: 'Dashboard', path: '/student', icon: MdDashboard },
        { key: 'my-courses', label: 'Courses', path: '/student/courses', icon: MdBook },
        { key: 'attendance', label: 'Attendance', path: '/student/attendance', icon: MdHowToReg },
        {
          key: 'results',
          label: 'Results',
          path: '/student/results',
          icon: MdAssignment,
          capability: 'view_own_results',
          children: [
            {
              key: 'transcript',
              label: 'Transcript',
              path: '/student/transcript',
              icon: MdBarChart,
              capability: 'view_own_transcript',
            },
          ],
        },
        { key: 'timetable', label: 'Timetable', path: '/student/timetable', icon: MdCalendarToday },
      ],
    },
    {
      group: 'More',
      items: [
        { key: 'announcements', label: 'News', path: '/student/announcements', icon: MdCampaign },
        { key: 'resources', label: 'Resources', path: '/student/resources', icon: MdFolder },
      ],
    },
  ],
};
