import {
  MdDashboard,
  MdSchool,
  MdCalendarToday,
  MdBarChart,
  MdSettings,
  MdApartment,
  MdPersonPin,
  MdAssignment,
  MdHowToReg,
  MdCampaign,
  MdFolder,
  MdBook,
} from 'react-icons/md';

/**
 * Ultra-compact navigation — one level, no nested sidebar children.
 * Secondary screens (batches, semesters, sessions, transfers, audit, results,
 * published registry, staff) remain on routes and are linked from related pages.
 */
export const NAV_CONFIG = {
  admin: [
    {
      group: 'Menu',
      items: [
        { key: 'dashboard', label: 'Dashboard', path: '/admin', icon: MdDashboard },
        {
          key: 'departments',
          label: 'Departments',
          path: '/admin/departments',
          icon: MdApartment,
          capability: 'manage_academic_structure',
        },
        {
          key: 'courses',
          label: 'Courses',
          path: '/admin/courses',
          icon: MdBook,
          capability: 'manage_academic_structure',
        },
        {
          key: 'students',
          label: 'Students',
          path: '/admin/students',
          icon: MdSchool,
          capability: 'manage_people',
        },
        {
          key: 'lecturers',
          label: 'Lecturers',
          path: '/admin/lecturers',
          icon: MdPersonPin,
          capability: 'manage_people',
        },
        {
          key: 'marks',
          label: 'Marks',
          path: '/admin/mark-approval',
          icon: MdAssignment,
          capability: 'approve_marks',
        },
        {
          key: 'attendance',
          label: 'Attendance',
          path: '/admin/attendance',
          icon: MdHowToReg,
          capability: 'approve_attendance',
        },
        {
          key: 'timetable',
          label: 'Schedule',
          path: '/admin/timetable',
          icon: MdCalendarToday,
          capability: 'manage_academic_structure',
        },
        {
          key: 'announcements',
          label: 'News',
          path: '/admin/announcements',
          icon: MdCampaign,
        },
        {
          key: 'resources',
          label: 'Files',
          path: '/admin/resources',
          icon: MdFolder,
        },
        {
          key: 'reports',
          label: 'Reports',
          path: '/admin/reports',
          icon: MdBarChart,
        },
        {
          key: 'settings',
          label: 'Settings',
          path: '/admin/settings',
          icon: MdSettings,
          capability: 'manage_settings',
        },
      ],
    },
  ],

  lecturer: [
    {
      group: 'Menu',
      items: [
        { key: 'dashboard', label: 'Home', path: '/lecturer', icon: MdDashboard },
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
        { key: 'resources', label: 'Files', path: '/lecturer/resources', icon: MdFolder },
      ],
    },
  ],

  student: [
    {
      group: 'Menu',
      items: [
        { key: 'dashboard', label: 'Home', path: '/student', icon: MdDashboard },
        { key: 'my-courses', label: 'Courses', path: '/student/courses', icon: MdBook },
        { key: 'attendance', label: 'Attendance', path: '/student/attendance', icon: MdHowToReg },
        {
          key: 'results',
          label: 'Results',
          path: '/student/results',
          icon: MdAssignment,
          capability: 'view_own_results',
        },
        { key: 'timetable', label: 'Timetable', path: '/student/timetable', icon: MdCalendarToday },
        { key: 'announcements', label: 'News', path: '/student/announcements', icon: MdCampaign },
        { key: 'resources', label: 'Files', path: '/student/resources', icon: MdFolder },
      ],
    },
  ],
};
