import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MdAssignment, MdGrade, MdCheckCircle } from 'react-icons/md';
import AppLayout from '../../../components/layout/AppLayout';
import DataTable from '../../../components/common/DataTable';
import { getResultsReport } from '../../../services/adminReportsService';
import { useTranslation } from '../../../i18n';

export default function ResultsReportPage() {
  const { translateText } = useTranslation();
  const { data: report = [], isLoading } = useQuery({
    queryKey: ['admin-results-report'],
    queryFn: getResultsReport,
  });

  const totalResults = report.length;
  const avgScore = totalResults
    ? (report.reduce((sum, item) => sum + Number(item.total_score || 0), 0) / totalResults).toFixed(1)
    : '0.0';
  const highPasses = report.filter((item) => item.grade === 'A' || item.grade === 'B').length;

  const columns = useMemo(
    () => [
      {
        header: 'Student',
        accessor: 'first_name',
        sortValue: (r) => `${r.first_name} ${r.last_name}`,
        render: (r) => <strong>{r.first_name} {r.last_name}</strong>,
      },
      {
        header: 'Matricule',
        accessor: 'matricule',
        render: (r) => (
          <code style={{ fontSize: '0.85rem', background: 'var(--color-bg)', padding: '2px 6px', borderRadius: '4px', fontWeight: 700, color: 'var(--color-primary)' }}>
            {r.matricule}
          </code>
        ),
      },
      {
        header: 'Academic Year',
        accessor: 'academic_year',
      },
      {
        header: 'Semester',
        accessor: 'semester',
      },
      {
        header: 'Course',
        accessor: 'course_code',
        render: (r) => (
          <div>
            <code style={{ fontWeight: 700, color: 'var(--color-primary)', marginRight: '6px' }}>{r.course_code}</code>
            <span>{r.course_name}</span>
          </div>
        ),
      },
      {
        header: 'Total Score',
        accessor: 'total_score',
        sortValue: (r) => Number(r.total_score || 0),
        render: (r) => <strong>{r.total_score}</strong>,
      },
      {
        header: 'Grade',
        accessor: 'grade',
        render: (r) => (
          <span
            className={`badge ${
              r.grade === 'A' || r.grade === 'B'
                ? 'badge-green'
                : r.grade === 'C' || r.grade === 'D'
                ? 'badge-blue'
                : 'badge-red'
            }`}
          >
            {r.grade}
          </span>
        ),
      },
      {
        header: 'GPA Point',
        accessor: 'grade_point',
        sortValue: (r) => Number(r.grade_point || 0),
        render: (r) => <strong>{r.grade_point}</strong>,
      },
    ],
    []
  );

  return (
    <AppLayout pageTitle="Results Report">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">{translateText('Results Report')}</h1>
          <p className="page-subtitle">
            {translateText('Published student results and academic-year performance summaries')}
          </p>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-card-icon blue"><MdAssignment /></div>
          <div className="stat-card-body">
            <div className="stat-card-value">{totalResults}</div>
            <div className="stat-card-label">{translateText('Published Results')}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon green"><MdGrade /></div>
          <div className="stat-card-body">
            <div className="stat-card-value">{avgScore} / 100</div>
            <div className="stat-card-label">{translateText('Average Score')}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon amber"><MdCheckCircle /></div>
          <div className="stat-card-body">
            <div className="stat-card-value">{highPasses}</div>
            <div className="stat-card-label">{translateText('Distinction / High Passes (A & B)')}</div>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <DataTable
        columns={columns}
        data={report}
        isLoading={isLoading}
        searchPlaceholder="Search matricule, student, course or academic year..."
        emptyTitle="No published results"
        emptySubtitle="Published results will appear here once approved marksheets are published."
        pageSize={15}
        exportable={true}
        exportFileName="unhimas_published_results_report"
      />
    </AppLayout>
  );
}
