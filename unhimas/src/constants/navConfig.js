import {
  MdDashboard,
  MdSchool,
  MdPeople,
  MdCalendarToday,
  MdFactCheck,
  MdBarChart,
  MdSettings,
  MdApartment,
  MdClass,
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
  MdAnalytics,
  MdHistory,
  MdAccountCircle,
  MdLogin,
  MdBook,
  MdCheckCircle,
} from 'react-icons/md';

/** Navigation tree keyed by role */
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
        { key: 'departments', label: 'Departments', path: '/admin/departments', icon: MdApartment },
        { key: 'batches', label: 'Batches', path: '/admin/batches', icon: MdGroups },
        { key: 'academic-years', label: 'Academic Years', path: '/admin/academic-years', icon: MdDateRange },
        { key: 'semesters', label: 'Semesters', path: '/admin/semesters', icon: MdSchedule },
        { key: 'courses', label: 'Courses', path: '/admin/courses', icon: MdBook },
        { key: 'batch-courses', label: 'Batch Courses', path: '/admin/batch-courses', icon: MdClass },
      ],
    },
    {
      group: 'People',
      items: [
        { key: 'students', label: 'Students', path: '/admin/students', icon: MdSchool },
        { key: 'lecturers', label: 'Lecturers', path: '/admin/lecturers', icon: MdPersonPin },
        { key: 'staff', label: 'Front Desk / Staff', path: '/admin/staff', icon: MdPeople },
      ],
    },
    {
      group: 'Academic Operations',
      items: [
        { key: 'timetable', label: 'Timetable', path: '/admin/timetable', icon: MdCalendarToday },
        { key: 'class-sessions', label: 'Class Sessions', path: '/admin/class-sessions', icon: MdSchedule },
        { key: 'student-transfers', label: 'Student Transfers', path: '/admin/student-transfers', icon: MdPeople },
        { key: 'academic-events', label: 'Academic Events', path: '/admin/academic-events', icon: MdDateRange },
        { key: 'attendance', label: 'Attendance', path: '/admin/attendance', icon: MdHowToReg },
        { key: 'marks', label: 'Marks', path: '/admin/marks', icon: MdGrade },
        { key: 'mark-approval', label: 'Mark Approval', path: '/admin/mark-approval', icon: MdCheckCircle },
        { key: 'results', label: 'Results', path: '/admin/results', icon: MdAssignment },
      ],
    },
    {
      group: 'Communication',
      items: [
        { key: 'announcements', label: 'Announcements', path: '/admin/announcements', icon: MdCampaign },
        { key: 'notifications', label: 'Notifications', path: '/admin/notifications', icon: MdNotifications },
        { key: 'resources', label: 'Resources', path: '/admin/resources', icon: MdFolder },
      ],
    },
    {
      group: 'Reports',
      items: [
        { key: 'lecturer-hours', label: 'Lecturer Hours', path: '/admin/reports/lecturer-hours', icon: MdAccessTime },
        { key: 'attendance-reports', label: 'Attendance Reports', path: '/admin/reports/attendance', icon: MdFactCheck },
        { key: 'performance', label: 'Academic Performance', path: '/admin/reports/performance', icon: MdAnalytics },
        { key: 'results-reports', label: 'Results Reports', path: '/admin/reports/results', icon: MdBarChart },
      ],
    },
    {
      group: 'System',
      items: [
        { key: 'settings', label: 'Settings', path: '/admin/settings', icon: MdSettings },
        { key: 'audit-log', label: 'Audit Log', path: '/admin/audit-log', icon: MdHistory },
        { key: 'profile', label: 'Profile', path: '/admin/profile', icon: MdAccountCircle },
      ],
    },
  ],

  frontdesk: [
    {
      group: 'Overview',
      items: [
        { key: 'dashboard', label: 'Dashboard', path: '/frontdesk', icon: MdDashboard },
      ],
    },
    {
      group: 'Attendance',
      items: [
        { key: 'lecturer-attendance', label: 'Lecturer Attendance', path: '/frontdesk/lecturer-attendance', icon: MdLogin },
        { key: 'history', label: 'Shift History', path: '/frontdesk/history', icon: MdHistory },
      ],
    },
    {
      group: 'Account',
      items: [
        { key: 'profile', label: 'Profile', path: '/frontdesk/profile', icon: MdAccountCircle },
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
        { key: 'class-sessions', label: 'Class Sessions', path: '/lecturer/sessions', icon: MdSchedule },
        { key: 'attendance', label: 'Attendance', path: '/lecturer/attendance', icon: MdHowToReg },
        { key: 'marks', label: 'Marks', path: '/lecturer/marks', icon: MdGrade },
      ],
    },
    {
      group: 'Info',
      items: [
        { key: 'my-hours', label: 'My Hours', path: '/lecturer/hours', icon: MdAccessTime },
        { key: 'notifications', label: 'Notifications', path: '/lecturer/notifications', icon: MdNotifications },
        { key: 'resources', label: 'Resources', path: '/lecturer/resources', icon: MdFolder },
        { key: 'profile', label: 'Profile', path: '/lecturer/profile', icon: MdAccountCircle },
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
        { key: 'results', label: 'Results', path: '/student/results', icon: MdAssignment },
        { key: 'transcript', label: 'Transcript', path: '/student/transcript', icon: MdAssignment },
        { key: 'timetable', label: 'Timetable', path: '/student/timetable', icon: MdCalendarToday },
      ],
    },
    {
      group: 'Info',
      items: [
        { key: 'announcements', label: 'Announcements', path: '/student/announcements', icon: MdCampaign },
        { key: 'resources', label: 'Resources', path: '/student/resources', icon: MdFolder },
        { key: 'profile', label: 'Profile', path: '/student/profile', icon: MdAccountCircle },
      ],
    },
  ],
};
