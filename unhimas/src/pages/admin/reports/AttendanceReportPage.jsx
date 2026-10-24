import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MdHowToReg, MdFactCheck, MdTrendingUp, MdWarning } from 'react-icons/md';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import AppLayout from '../../../components/layout/AppLayout';
import DataTable from '../../../components/common/DataTable';
import { getAttendanceReport } from '../../../services/adminReportsService';
import { useTranslation } from '../../../i18n';

export default function AttendanceReportPage() {
  const { translateText } = useTranslation();
  const {
    data: report = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['admin-attendance-report'],
    queryFn: getAttendanceReport,
    retry: 1,
  });

  const chartData = useMemo(
    () =>
      report.slice(0, 12).map((item) => ({
        name: item.course_code,
        percentage: Number(Number(item.attendance_percentage || 0).toFixed(1)),
      })),
    [report],
  );

  const average = report.length
    ? (report.reduce((sum, item) => sum + Number(item.attendance_percentage || 0), 0) / report.length).toFixed(1)
    : '0.0';

  const coursesBelowThreshold = report.filter((item) => Number(item.attendance_percentage || 0) < 75).length;

  const columns = useMemo(
    () => [
      {
        header: 'Course',
        accessor: 'course_code',
        sortValue: (r) => r.course_code || '',
        render: (r) => (
          <div>
            <code
              style={{
                fontSize: '0.85rem',
                background: 'var(--color-bg)',
                padding: '2px 6px',
                borderRadius: '4px',
                fontWeight: 700,
                color: 'var(--color-primary)',
              }}
            >
              {r.course_code}
            </code>{' '}
            <strong>{r.course_name}</strong>
          </div>
        ),
      },
      {
        header: 'Total Student slots',
        accessor: 'total_sessions',
        sortValue: (r) => Number(r.total_sessions || 0),
        render: (r) => <span>{r.total_sessions}</span>,
      },
      {
        header: 'Attended Slots',
        accessor: 'attended_sessions',
        sortValue: (r) => Number(r.attended_sessions || 0),
        render: (r) => <strong>{Number(r.attended_sessions || 0)}</strong>,
      },
      {
        header: 'Attendance Rate',
        accessor: 'attendance_percentage',
        sortValue: (r) => Number(r.attendance_percentage || 0),
        render: (r) => {
          const pct = Number(r.attendance_percentage || 0);
          const isSatisfactory = pct >= 75;
          return (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
              <span
                style={{
                  fontWeight: 700,
                  fontSize: '0.95rem',
                  color: isSatisfactory ? '#059669' : 'var(--color-secondary)',
                }}
              >
                {pct.toFixed(1)}%
              </span>
              <span className={`badge ${isSatisfactory ? 'badge-green' : 'badge-red'}`}>
                {isSatisfactory ? translateText('Satisfactory') : translateText('Low (< 75%)')}
              </span>
            </div>
          );
        },
      },
    ],
    [translateText],
  );

  return (
    <AppLayout pageTitle="Attendance Report">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">{translateText('Attendance Report')}</h1>
          <p className="page-subtitle">
            {translateText(
              'Student lecture presence analytics and course compliance with the 75% examination threshold',
            )}
          </p>
        </div>
      </div>

      {isError && (
        <div className="empty-state" role="alert" style={{ marginBottom: '1.5rem' }}>
          <div className="empty-state-icon">
            <MdWarning />
          </div>
          <div className="empty-state-title">{translateText('Could not load attendance data')}</div>
          <p className="empty-state-text">
            {error?.message ||
              translateText(
                'The attendance report could not be loaded. Ensure class sessions have been recorded.',
              )}
          </p>
          <button type="button" className="btn btn-primary" onClick={() => refetch()}>
            {translateText('Try again')}
          </button>
        </div>
      )}

      {!isError && (
        <>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-card-icon blue">
                <MdHowToReg />
              </div>
              <div className="stat-card-body">
                <div className="stat-card-value">{isLoading ? '…' : report.length}</div>
                <div className="stat-card-label">{translateText('Course Curricula Monitored')}</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-card-icon green">
                <MdTrendingUp />
              </div>
              <div className="stat-card-body">
                <div className="stat-card-value">{isLoading ? '…' : `${average}%`}</div>
                <div className="stat-card-label">{translateText('University Average Attendance')}</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-card-icon red">
                <MdFactCheck />
              </div>
              <div className="stat-card-body">
                <div className="stat-card-value">{isLoading ? '…' : coursesBelowThreshold}</div>
                <div className="stat-card-label">{translateText('Courses Below 75% Threshold')}</div>
              </div>
            </div>
          </div>

          {chartData.length > 0 && (
            <div className="card" style={{ marginBottom: '1.5rem' }}>
              <div className="card-header">
                <h2 className="card-title">{translateText('Course Attendance Rates (%)')}</h2>
              </div>
              <div className="card-body" style={{ height: 320, minHeight: 320 }}>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 12 }} />
                    <Tooltip
                      formatter={(value) => [`${value}%`, translateText('Attendance')]}
                      contentStyle={{
                        background: 'var(--color-surface)',
                        borderColor: 'var(--color-border)',
                        borderRadius: 'var(--radius-sm)',
                        boxShadow: 'var(--shadow-md)',
                      }}
                    />
                    <Bar dataKey="percentage" fill="#10B981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          <DataTable
            columns={columns}
            data={report}
            loading={isLoading}
            searchPlaceholder="Search course code or course name..."
            emptyTitle={translateText('No attendance records found')}
            emptySubtitle={translateText(
              'Attendance records will appear here as lecturers record class sessions.',
            )}
            pageSize={12}
            exportable={true}
            exportFileName="unhimas_course_attendance_report"
          />
        </>
      )}
    </AppLayout>
  );
}
