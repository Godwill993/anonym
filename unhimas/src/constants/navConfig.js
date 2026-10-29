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
  MdBook,
} from 'react-icons/md';

/**
 * Minimal sidebar. Secondary screens (batches, years, news, files, staff, audit,
 * published results, transfers, sessions, events) live under Settings → More tools.
 */
export const NAV_CONFIG = {
  admin: [
    {
      group: 'Menu',
      items: [
        { key: 'dashboard', label: 'Home', path: '/admin', icon: MdDashboard },
        {
          key: 'departments',
          label: 'Structure',
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
      ],
    },
  ],
};
