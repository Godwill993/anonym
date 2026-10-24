import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MdFilterList } from 'react-icons/md';
import AppLayout from '../../components/layout/AppLayout';
import DataTable from '../../components/common/DataTable';
import { getPublishedResults } from '../../services/results';
import { useTranslation } from '../../i18n';

export default function AdminResultsPage() {
  const { translateText } = useTranslation();
  const [gradeFilter, setGradeFilter] = useState('');

  // Fetch published results from the SQL view 'results'.
  const { data: results = [], isLoading } = useQuery({
    queryKey: ['admin-results-view'],
    queryFn: getPublishedResults,
  });

  const filteredResults = useMemo(() => {
    if (!gradeFilter) return results;
    return results.filter((r) => r.grade === gradeFilter);
  }, [results, gradeFilter]);

  const columns = useMemo(
    () => [
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
        header: 'Student Name',
        accessor: 'last_name',
        sortValue: (r) => `${r.last_name || ''} ${r.first_name || ''}`,
        render: (r) => <strong>{r.last_name} {r.first_name}</strong>,
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
        header: 'CA (/30)',
        accessor: 'ca_score',
        sortValue: (r) => (Number(r.attendance_score || 0) + Number(r.coursework_score || 0)),
        render: (r) => (
          <span>{(Number(r.attendance_score || 0) + Number(r.coursework_score || 0)).toFixed(1)}</span>
        ),
      },
      {
        header: 'Exam (/70)',
        accessor: 'exam_score',
        render: (r) => r.exam_score ?? '—',
      },
      {
        header: 'Total (/100)',
        accessor: 'total_score',
        render: (r) => <strong style={{ fontSize: '0.95rem' }}>{r.total_score}</strong>,
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
            {r.grade || '—'}
          </span>
        ),
      },
      {
        header: 'Grade Point',
        accessor: 'grade_point',
        render: (r) => <strong>{r.grade_point ?? '—'}</strong>,
      },
    ],
    []
  );

  return (
    <AppLayout pageTitle="Official Results">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">{translateText('Published Results Registry')}</h1>
          <p className="page-subtitle">
            {translateText('Official verified academic results, letter grades, and grade points populated from official approvals')}
          </p>
        </div>
      </div>

      <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <MdFilterList style={{ color: 'var(--color-text-muted)' }} />
          <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>
            {translateText('Filter by Grade:')}
          </span>
          <select
            className="form-input"
            style={{ width: 'auto', height: '36px', padding: '0.25rem 0.75rem' }}
            value={gradeFilter}
            onChange={(e) => setGradeFilter(e.target.value)}
            aria-label={translateText('Filter by grade')}
          >
            <option value="">{translateText('All Grades')}</option>
            <option value="A">Grade A (Excellent)</option>
            <option value="B">Grade B (Very Good)</option>
            <option value="C">Grade C (Good)</option>
            <option value="D">Grade D (Pass)</option>
            <option value="F">Grade F (Fail)</option>
          </select>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={filteredResults}
        loading={isLoading}
        searchPlaceholder="Search by matricule, student name, or course code..."
        emptyTitle="No Published Results Yet"
        emptySubtitle="Results become visible here once approved marksheets are published by administrators."
        pageSize={15}
        exportable={true}
        exportFileName="unhimas_published_results"
      />
    </AppLayout>
  );
}
