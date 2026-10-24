import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MdAccessTime, MdPersonPin, MdWarning } from 'react-icons/md';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import AppLayout from '../../../components/layout/AppLayout';
import DataTable from '../../../components/common/DataTable';
import { getLecturerHoursReport } from '../../../services/adminReportsService';
import { useTranslation } from '../../../i18n';

function formatMonth(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
}

export default function LecturerHoursReportPage() {
  const { translateText } = useTranslation();
  const {
    data: report = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['admin-lecturer-hours-report'],
    queryFn: getLecturerHoursReport,
    retry: 1,
  });

  const chartData = useMemo(
    () =>
      report.slice(0, 12).map((item) => ({
        name: `${item.last_name || ''} (${formatMonth(item.month)})`,
        hours: Number(Number(item.hours_taught || 0).toFixed(1)),
      })),
    [report],
  );

  const totalHours = report.reduce((sum, item) => sum + Number(item.hours_taught || 0), 0);
  const activeLecturers = new Set(report.map((item) => item.lecturer_id)).size;
  const avgHoursPerLec = activeLecturers > 0 ? (totalHours / activeLecturers).toFixed(1) : '0.0';

  const columns = useMemo(
    () => [
      {
        header: 'Lecturer',
        accessor: 'first_name',
        sortValue: (r) => `${r.first_name} ${r.last_name}`,
        render: (r) => (
          <div>
            <strong>
              {r.first_name} {r.last_name}
            </strong>
            <div>
              <code
                style={{
                  fontSize: '0.75rem',
                  background: 'var(--color-bg)',
                  padding: '1px 5px',
                  borderRadius: '4px',
                  color: 'var(--color-secondary)',
                }}
              >
                {r.staff_id}
              </code>
            </div>
          </div>
        ),
      },
      {
        header: 'Billing Month',
        accessor: 'month',
        sortValue: (r) => new Date(r.month).getTime(),
        render: (r) => <span>{formatMonth(r.month)}</span>,
      },
      {
        header: 'Approved Teaching Hours',
        accessor: 'hours_taught',
        sortValue: (r) => Number(r.hours_taught || 0),
        render: (r) => (
          <strong style={{ fontSize: '0.95rem', color: 'var(--color-primary)' }}>
            {Number(r.hours_taught || 0).toFixed(2)} hrs
          </strong>
        ),
      },
    ],
    [],
  );

  return (
    <AppLayout pageTitle="Lecturer Hours Report">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">{translateText('Lecturer Hours Report')}</h1>
          <p className="page-subtitle">
            {translateText(
              'Faculty teaching hours and campus workload recorded via administrator clock-in',
            )}
          </p>
        </div>
      </div>

      {isError && (
        <div className="empty-state" role="alert" style={{ marginBottom: '1.5rem' }}>
          <div className="empty-state-icon">
            <MdWarning />
          </div>
          <div className="empty-state-title">{translateText('Could not load lecturer hours')}</div>
          <p className="empty-state-text">
            {error?.message ||
              translateText(
                'The hours report could not be loaded. Ensure shift logs exist and try again.',
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
                <MdAccessTime />
              </div>
              <div className="stat-card-body">
                <div className="stat-card-value">
                  {isLoading ? '…' : `${totalHours.toFixed(1)} hrs`}
                </div>
                <div className="stat-card-label">{translateText('Total Campus Hours')}</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-card-icon red">
                <MdPersonPin />
              </div>
              <div className="stat-card-body">
                <div className="stat-card-value">{isLoading ? '…' : activeLecturers}</div>
                <div className="stat-card-label">{translateText('Active Faculty Members')}</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-card-icon green">
                <MdAccessTime />
              </div>
              <div className="stat-card-body">
                <div className="stat-card-value">
                  {isLoading ? '…' : `${avgHoursPerLec} hrs`}
                </div>
                <div className="stat-card-label">{translateText('Average per Lecturer')}</div>
              </div>
            </div>
          </div>

          {chartData.length > 0 && (
            <div className="card" style={{ marginBottom: '1.5rem' }}>
              <div className="card-header">
                <h2 className="card-title">{translateText('Faculty Workload Overview')}</h2>
              </div>
              <div className="card-body" style={{ height: 320, minHeight: 320 }}>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis unit="h" tick={{ fontSize: 12 }} />
                    <Tooltip
                      formatter={(value) => [`${value} hrs`, translateText('Hours Taught')]}
                      contentStyle={{
                        background: 'var(--color-surface)',
                        borderColor: 'var(--color-border)',
                        borderRadius: 'var(--radius-sm)',
                        boxShadow: 'var(--shadow-md)',
                      }}
                    />
                    <Bar dataKey="hours" fill="#B70032" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          <DataTable
            columns={columns}
            data={report}
            loading={isLoading}
            searchPlaceholder="Search by lecturer name or staff ID..."
            emptyTitle={translateText('No hours recorded')}
            emptySubtitle={translateText(
              'Lecturer hours will appear here once administrators record campus clock-in and clock-out.',
            )}
            pageSize={12}
            exportable={true}
            exportFileName="unhimas_lecturer_hours_report"
          />
        </>
      )}
    </AppLayout>
  );
}
