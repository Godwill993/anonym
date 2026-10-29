import { NavLink, Outlet, Navigate, useLocation } from 'react-router-dom';
import {
  MdAccessTime,
  MdHowToReg,
  MdBarChart,
  MdAssignment,
} from 'react-icons/md';
import AppLayout from '../../components/layout/AppLayout';
import { useTranslation } from '../../i18n';

const TABS = [
  {
    to: '/admin/reports/lecturer-hours',
    label: 'Lecturer hours',
    icon: MdAccessTime,
  },
  {
    to: '/admin/reports/attendance',
    label: 'Attendance',
    icon: MdHowToReg,
  },
  {
    to: '/admin/reports/course-performance',
    label: 'Performance',
    icon: MdBarChart,
  },
  {
    to: '/admin/reports/results',
    label: 'Results',
    icon: MdAssignment,
  },
];

/** Single sidebar entry → tabbed access to all report pages (no duplicate nav items). */
export default function AdminReportsHub() {
  const { translateText } = useTranslation();
  const { pathname } = useLocation();

  if (pathname === '/admin/reports' || pathname === '/admin/reports/') {
    return <Navigate to="/admin/reports/lecturer-hours" replace />;
  }

  return (
    <AppLayout pageTitle={translateText('Reports')}>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">{translateText('Reports')}</h1>
          <p className="page-subtitle">
            {translateText('Hours, attendance, performance, and results in one place')}
          </p>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 6,
          marginBottom: '1.25rem',
          padding: 4,
          background: 'var(--color-bg)',
          borderRadius: 'var(--radius-md, 12px)',
          border: '1px solid var(--color-border)',
        }}
        role="tablist"
        aria-label={translateText('Report type')}
      >
        {TABS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            role="tab"
            className={({ isActive }) =>
              `btn btn-sm ${isActive ? 'btn-primary' : 'btn-ghost'}`
            }
            style={{ textDecoration: 'none' }}
          >
            <Icon size={16} /> {translateText(label)}
          </NavLink>
        ))}
      </div>

      <Outlet />
    </AppLayout>
  );
}
