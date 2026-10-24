import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MdAssignment, MdCheckCircle, MdGrade, MdWarning } from 'react-icons/md';
import AppLayout from '../../../components/layout/AppLayout';
import DataTable from '../../../components/common/DataTable';
import { getResultsReport } from '../../../services/adminReportsService';
import { useTranslation } from '../../../i18n';

export default function ResultsReportPage() {
  const { translateText } = useTranslation();
  const {
    data: report = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['admin-results-report'],
    queryFn: getResultsReport,
    retry: 1,
  });

  const totalResults = report.length;
  const avgScore = report.length
    ? (
        report.reduce((sum, r) => sum + Number(r.total_score || 0), 0) / report.length
      ).toFixed(1)
    : '0.0';
  const highPasses = report.filter((r) => ['A', 'B+', 'B'].includes(r.grade)).length;

  const columns = useMemo(
    () => [
      {
        header: 'Matricule',
        accessor: 'matricule',
        sortValue: (r) => r.matricule || '',
        render: (r) => <code style={{ fontSize: '0.85rem' }}>{r.matricule}</code>,
      },
      {
        header: 'Student',
        accessor: 'last_name',
        sortValue: (r) => `${r.last_name || ''} ${r.first_name || ''}`,
        render: (r) => (
          <strong>
            {r.last_name} {r.first_name}
          </strong>
        ),
      },
      {
        header: 'Course',
        accessor: 'course_code',
        sortValue: (r) => r.course_code || '',
        render: (r) => (
          <span>
            <code style={{ fontSize: '0.8rem' }}>{r.course_code}</code> {r.course_name}
          </span>
        ),
      },
      {
        header: 'Year / Semester',
        accessor: 'academic_year',
        sortValue: (r) => `${r.academic_year || ''} ${r.semester || ''}`,
        render: (r) => (
          <span style={{ fontSize: '0.85rem' }}>
            {r.academic_year || '—'} · {r.semester || '—'}
          </span>
        ),
      },
      {
        header: 'Total',
        accessor: 'total_score',
        sortValue: (r) => Number(r.total_score || 0),
        render: (r) => <strong>{Number(r.total_score || 0).toFixed(1)}</strong>,
      },
      {
        header: 'Grade',
        accessor: 'grade',
        sortValue: (r) => r.grade || '',
        render: (r) => (
          <span
            className={`badge ${
              r.grade === 'F' ? 'badge-red' : r.grade === 'A' ? 'badge-green' : 'badge-gray'
            }`}
          >
            {r.grade || '—'}
          </span>
        ),
      },
      {
        header: 'GP',
        accessor: 'grade_point',
        sortValue: (r) => Number(r.grade_point || 0),
        render: (r) => <span>{r.grade_point ?? '—'}</span>,
      },
    ],
    [],
  );

  return (
    <AppLayout pageTitle="Results Report">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">{translateText('Results Report')}</h1>
          <p className="page-subtitle">
            {translateText('Published academic results only')}
          </p>
        </div>
      </div>

      {isError && (
        <div className="empty-state" role="alert" style={{ marginBottom: '1.5rem' }}>
          <div className="empty-state-icon">
            <MdWarning />
          </div>
          <div className="empty-state-title">{translateText('Could not load results')}</div>
          <p className="empty-state-text">
            {error?.message ||
              translateText('Published results could not be loaded. Try again later.')}
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
                <MdAssignment />
              </div>
              <div className="stat-card-body">
                <div className="stat-card-value">{isLoading ? '…' : totalResults}</div>
                <div className="stat-card-label">{translateText('Published Results')}</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-card-icon green">
                <MdGrade />
              </div>
              <div className="stat-card-body">
                <div className="stat-card-value">{isLoading ? '…' : `${avgScore} / 100`}</div>
                <div className="stat-card-label">{translateText('Average Score')}</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-card-icon amber">
                <MdCheckCircle />
              </div>
              <div className="stat-card-body">
                <div className="stat-card-value">{isLoading ? '…' : highPasses}</div>
                <div className="stat-card-label">
                  {translateText('Distinction / High Passes (A & B)')}
                </div>
              </div>
            </div>
          </div>

          <DataTable
            columns={columns}
            data={report}
            loading={isLoading}
            searchPlaceholder="Search matricule, student, course or academic year..."
            emptyTitle={translateText('No published results')}
            emptySubtitle={translateText(
              'Published results will appear here once approved marksheets are published.',
            )}
            pageSize={15}
            exportable={true}
            exportFileName="unhimas_published_results_report"
          />
        </>
      )}
    </AppLayout>
  );
}
