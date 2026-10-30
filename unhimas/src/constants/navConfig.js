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
  MdGrade,
  MdHowToReg,
  MdCampaign,
  MdLogin,
  MdBook,
  MdPayments,
  MdReceiptLong,
  MdAccessTime,
  MdAssignment,
} from 'react-icons/md';

/**
 * Compact navigation by role.
 * Secondary pages stay routable; they are reached from parent pages or dashboards.
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
      group: 'Academics',
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
          key: 'years',
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
        {
          key: 'timetable',
          label: 'Timetable',
          path: '/admin/timetable',
          icon: MdCalendarToday,
          capability: 'manage_academic_structure',
        },
      ],
    },
    {
      group: 'People',
      items: [
        { key: 'students', label: 'Students', path: '/admin/students', icon: MdSchool, capability: 'manage_people' },
        { key: 'lecturers', label: 'Lecturers', path: '/admin/lecturers', icon: MdPersonPin, capability: 'manage_people' },
        { key: 'admissions', label: 'Admissions', path: '/admin/admissions', icon: MdHowToReg, capability: 'manage_admissions' },
      ],
    },
    {
      group: 'Finance',
      items: [
        { key: 'fees', label: 'Fees', path: '/admin/fees', icon: MdPayments, capability: 'manage_fees' },
        { key: 'payments', label: 'Payments', path: '/admin/payments', icon: MdReceiptLong, capability: 'manage_fees' },
      ],
    },
    {
      group: 'Work',
      items: [
        { key: 'marks', label: 'Marks', path: '/admin/mark-approval', icon: MdGrade, capability: 'approve_marks' },
        { key: 'results', label: 'Results', path: '/admin/results', icon: MdBarChart },
        { key: 'attendance', label: 'Attendance', path: '/admin/attendance', icon: MdHowToReg, capability: 'approve_attendance' },
        { key: 'announcements', label: 'Announcements', path: '/admin/announcements', icon: MdCampaign },
        { key: 'clock-in', label: 'Clock-in', path: '/admin/lecturer-attendance', icon: MdLogin, capability: 'clock_lecturers' },
      ],
    },
    {
      group: 'System',
      items: [
        { key: 'settings', label: 'Settings', path: '/admin/settings', icon: MdSettings, capability: 'manage_settings' },
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
          key: 'sessions',
          label: 'Sessions',
          path: '/lecturer/sessions',
          icon: MdHowToReg,
          capability: 'mark_attendance',
        },
        { key: 'marks', label: 'Marks', path: '/lecturer/marks', icon: MdGrade, capability: 'enter_marks' },
        { key: 'hours', label: 'Hours', path: '/lecturer/hours', icon: MdAccessTime },
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
        { key: 'results', label: 'Results', path: '/student/results', icon: MdAssignment, capability: 'view_own_results' },
        { key: 'timetable', label: 'Timetable', path: '/student/timetable', icon: MdCalendarToday },
        { key: 'fees', label: 'Fees', path: '/student/fees', icon: MdPayments, capability: 'view_own_fees' },
      ],
    },
  ],
};
