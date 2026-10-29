import { Link } from 'react-router-dom';
import {
  MdAccessTime,
  MdHowToReg,
  MdBarChart,
  MdAssignment,
  MdArrowForward,
} from 'react-icons/md';
import AppLayout from '../../components/layout/AppLayout';
import { useTranslation } from '../../i18n';

const REPORTS = [
  {
    to: '/admin/reports/lecturer-hours',
    title: 'Lecturer hours',
    desc: 'Teaching and campus hours by lecturer',
    icon: MdAccessTime,
  },
  {
    to: '/admin/reports/attendance',
    title: 'Attendance',
    desc: 'Class and session attendance summaries',
    icon: MdHowToReg,
  },
  {
    to: '/admin/reports/course-performance',
    title: 'Academic performance',
    desc: 'Course and cohort performance indicators',
    icon: MdBarChart,
  },
  {
    to: '/admin/reports/results',
    title: 'Results reports',
    desc: 'Published results analytics and exports',
    icon: MdAssignment,
  },
];

/** One sidebar item opens this hub; individual reports stay on their own routes. */
export default function AdminReportsHub() {
  const { translateText } = useTranslation();

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
        className="stats-grid"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}
      >
        {REPORTS.map(({ to, title, desc, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className="card"
            style={{
              textDecoration: 'none',
              color: 'inherit',
              padding: '1.15rem 1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
              minHeight: 120,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span
                className="stat-card-icon blue"
                style={{ width: 40, height: 40, displayRadius: 10 }}
              >
                <Icon size={20} />
              </span>
              <strong style={{ fontSize: '0.95rem' }}>{translateText(title)}</strong>
            </div>
            <p
              style={{
                margin: 0,
                fontSize: '0.8125rem',
                color: 'var(--color-text-muted)',
                lineHeight: 1.4,
                flex: 1,
              }}
            >
              {translateText(desc)}
            </p>
            <span
              style={{
                fontSize: '0.8rem',
                fontWeight: 600,
                color: 'var(--color-primary)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              {translateText('Open')} <MdArrowForward size={14} />
            </span>
          </Link>
        ))}
      </div>
    </AppLayout>
  );
}
