import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MdAnalytics, MdCheckCircle, MdCancel } from 'react-icons/md';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import AppLayout from '../../../components/layout/AppLayout';
import DataTable from '../../../components/common/DataTable';
import { getCoursePerformanceReport } from '../../../services/adminReportsService';
import { useTranslation } from '../../../i18n';

export default function CoursePerformanceReportPage() {
  const { translateText } = useTranslation();
  const { data: report = [], isLoading } = useQuery({
    queryKey: ['admin-course-performance-report'],
    queryFn: getCoursePerformanceReport,
  });

  const chartData = useMemo(
    () =>
      report.slice(0, 12).map((item) => ({
        name: item.course_code,
        average: Number(Number(item.average_score || 0).toFixed(1)),
        passes: Number(item.passes || 0),
        failures: Number(item.failures || 0),
      })),
    [report]
  );

  const totalResults = report.reduce((sum, item) => sum + Number(item.students || 0), 0);
  const averageScore = report.length
    ? (report.reduce((sum, item) => sum + Number(item.average_score || 0), 0) / report.length).toFixed(1)
    : '0.0';
  const totalPasses = report.reduce((sum, item) => sum + Number(item.passes || 0), 0);
  const overallPassRate = totalResults > 0 ? ((totalPasses / totalResults) * 100).toFixed(1) : '0.0';

  const columns = useMemo(
    () => [
      {
        header: 'Course',
        accessor: 'course_code',
        sortValue: (r) => r.course_code || '',
        render: (r) => (
          <div>
            <code style={{ fontSize: '0.85rem', background: 'var(--color-bg)', padding: '2px 6px', borderRadius: '4px', fontWeight: 700, color: 'var(--color-primary)' }}>
              {r.course_code}
            </code>{' '}
            <strong>{r.course_name}</strong>
          </div>
        ),
      },
      {
        header: 'Total Graded',
        accessor: 'students',
        sortValue: (r) => Number(r.students || 0),
        render: (r) => <span>{r.students}</span>,
      },
      {
        header: 'Average Score',
        accessor: 'average_score',
        sortValue: (r) => Number(r.average_score || 0),
        render: (r) => (
          <strong style={{ fontSize: '0.95rem' }}>
            {Number(r.average_score || 0).toFixed(1)} / 100
          </strong>
        ),
      },
      {
        header: 'Passed',
        accessor: 'passes',
        sortValue: (r) => Number(r.passes || 0),
        render: (r) => (
          <span className="badge badge-green" style={{ fontSize: '0.8rem' }}>
            {r.passes}
          </span>
        ),
      },
      {
        header: 'Failed',
        accessor: 'failures',
        sortValue: (r) => Number(r.failures || 0),
        render: (r) => (
          <span className={`badge ${Number(r.failures) > 0 ? 'badge-red' : 'badge-gray'}`} style={{ fontSize: '0.8rem' }}>
            {r.failures}
          </span>
        ),
      },
      {
        header: 'Pass Rate',
        accessor: 'pass_rate',
        sortValue: (r) => {
          const total = Number(r.students || 0);
          return total > 0 ? (Number(r.passes || 0) / total) * 100 : 0;
        },
        render: (r) => {
          const total = Number(r.students || 0);
          const rate = total > 0 ? ((Number(r.passes || 0) / total) * 100).toFixed(1) : '0.0';
          const isGood = Number(rate) >= 70;
          return (
            <span style={{ fontWeight: 700, color: isGood ? '#059669' : 'var(--color-secondary)' }}>
              {rate}%
            </span>
          );
        },
      },
    ],
    []
  );

  return (
    <AppLayout pageTitle="Academic Performance Report">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">{translateText('Academic Performance Report')}</h1>
          <p className="page-subtitle">
            {translateText('Curriculum course-by-course performance, grade averages, and pass rate analytics')}
          </p>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-card-icon blue"><MdAnalytics /></div>
          <div className="stat-card-body">
            <div className="stat-card-value">{totalResults}</div>
            <div className="stat-card-label">{translateText('Total Student Results')}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon green"><MdCheckCircle /></div>
          <div className="stat-card-body">
            <div className="stat-card-value">{averageScore}</div>
            <div className="stat-card-label">{translateText('Average Score across Courses')}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon amber"><MdCheckCircle /></div>
          <div className="stat-card-body">
            <div className="stat-card-value">{overallPassRate}%</div>
            <div className="stat-card-label">{translateText('Overall University Pass Rate')}</div>
          </div>
        </div>
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div className="card-header">
            <h2 className="card-title">{translateText('Average Score by Course (Curriculum Sample)')}</h2>
          </div>
          <div className="card-body" style={{ height: 320 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(value) => [`${value} / 100`, translateText('Average Score')]}
                  contentStyle={{
                    background: 'var(--color-surface)',
                    borderColor: 'var(--color-border)',
                    borderRadius: 'var(--radius-sm)',
                    boxShadow: 'var(--shadow-md)',
                  }}
                />
                <Bar dataKey="average" fill="#6366F1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Course Performance Table */}
      <DataTable
        columns={columns}
        data={report}
        searchPlaceholder="Search course code or course name..."
        emptyTitle="No performance data available"
        emptySubtitle="Published results will populate performance metrics here."
        pageSize={10}
        exportable={true}
        exportFileName="unhimas_course_performance_report"
      />
    </AppLayout>
  );
}
