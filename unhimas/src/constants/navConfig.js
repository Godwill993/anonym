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
} from 'react-icons/md';

/**
 * Minimal, objective navigation — only what staff and students need daily.
 * Other routes remain valid in App.jsx; they are not sidebar noise.
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
            { key: 'batches', label: 'Batches', path: '/admin/batches', icon: MdGroups, capability: 'manage_academic_structure' },
            { key: 'years', label: 'Years', path: '/admin/academic-years', icon: MdDateRange, capability: 'manage_academic_structure' },
            { key: 'semesters', label: 'Semesters', path: '/admin/semesters', icon: MdSchedule, capability: 'manage_academic_structure' },
            { key: 'courses', label: 'Courses', path: '/admin/courses', icon: MdBook, capability: 'manage_academic_structure' },
            { key: 'timetable', label: 'Timetable', path: '/admin/timetable', icon: MdCalendarToday, capability: 'manage_academic_structure' },
          ],
        },
        {
          key: 'people',
          label: 'People',
          path: '/admin/students',
          icon: MdSchool,
          capability: 'manage_people',
          children: [
            { key: 'lecturers', label: 'Lecturers', path: '/admin/lecturers', icon: MdPersonPin, capability: 'manage_people' },
            { key: 'admissions', label: 'Admissions', path: '/admin/admissions', icon: MdHowToReg, capability: 'manage_admissions' },
          ],
        },
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
        { key: 'results', label: 'Results', path: '/admin/results', icon: MdBarChart },
        { key: 'settings', label: 'Settings', path: '/admin/settings', icon: MdSettings, capability: 'manage_settings' },
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
      ],
    },
  ],

  student: [
    {
      group: '',
      items: [
        { key: 'dashboard', label: 'Dashboard', path: '/student', icon: MdDashboard },
        { key: 'courses', label: 'Courses', path: '/student/courses', icon: MdBook },
        { key: 'results', label: 'Results', path: '/student/results', icon: MdGrade, capability: 'view_own_results' },
        { key: 'fees', label: 'Fees', path: '/student/fees', icon: MdPayments, capability: 'view_own_fees' },
        { key: 'timetable', label: 'Timetable', path: '/student/timetable', icon: MdCalendarToday },
      ],
    },
  ],
};
