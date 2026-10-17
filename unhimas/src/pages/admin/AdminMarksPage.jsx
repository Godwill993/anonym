import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { MdCheckCircle, MdVisibility, MdFilterList } from 'react-icons/md';
import AppLayout from '../../components/layout/AppLayout';
import DataTable from '../../components/common/DataTable';
import { getMarkSubmissions } from '../../services/operationsService';
import { useTranslation } from '../../i18n';

const STATUS_CONFIG = {
  draft: { label: 'Draft', cls: 'badge-gray' },
  submitted: { label: 'Awaiting Review', cls: 'badge-amber' },
  returned: { label: 'Returned', cls: 'badge-red' },
  approved: { label: 'Approved', cls: 'badge-blue' },
  published: { label: 'Published', cls: 'badge-green' },
};

export default function AdminMarksPage() {
  const { translateText } = useTranslation();
  const [statusFilter, setStatusFilter] = useState('');

  const { data: submissions = [], isLoading } = useQuery({
    queryKey: ['admin-all-marks'],
    queryFn: () => getMarkSubmissions(),
  });

  const filteredSubmissions = useMemo(() => {
    if (!statusFilter) return submissions;
    return submissions.filter((s) => s.status === statusFilter);
  }, [submissions, statusFilter]);

  const columns = useMemo(
    () => [
      {
        header: 'Course',
        accessor: 'course_code',
        sortValue: (s) => s.batch_courses?.courses?.code || '',
        render: (s) => (
          <div>
            <code style={{ fontSize: '0.85rem', background: 'var(--color-bg)', padding: '2px 6px', borderRadius: '4px', fontWeight: 700, color: 'var(--color-primary)' }}>
              {s.batch_courses?.courses?.code}
            </code>{' '}
            <strong>{s.batch_courses?.courses?.name}</strong>
            <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>
              {s.batch_courses?.courses?.credit_units} credits
            </div>
          </div>
        ),
      },
      {
        header: 'Batch / Cohort',
        accessor: 'batch_name',
        sortValue: (s) => s.batch_courses?.batches?.name || '',
        render: (s) => (
          <div>
            <div>{s.batch_courses?.batches?.name}</div>
            <code style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
              {s.batch_courses?.batches?.code}
            </code>
          </div>
        ),
      },
      {
        header: 'Semester',
        accessor: 'semester_name',
        sortValue: (s) => s.batch_courses?.semesters?.name || '',
        render: (s) => <span>{s.batch_courses?.semesters?.name}</span>,
      },
      {
        header: 'Lecturer',
        accessor: 'lecturer_name',
        sortValue: (s) => `${s.lecturers?.first_name} ${s.lecturers?.last_name}`,
        render: (s) => (
          <div>
            <strong>{s.lecturers?.first_name} {s.lecturers?.last_name}</strong>
            <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
              ID: {s.lecturers?.staff_id}
            </div>
          </div>
        ),
      },
      {
        header: 'Status',
        accessor: 'status',
        render: (s) => {
          const cfg = STATUS_CONFIG[s.status] || { label: s.status, cls: 'badge-gray' };
          return <span className={`badge ${cfg.cls}`}>{translateText(cfg.label)}</span>;
        },
      },
      {
        header: 'Last Updated',
        accessor: 'updated_at',
        sortValue: (s) => new Date(s.updated_at).getTime(),
        render: (s) => (
          <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
            {new Date(s.updated_at).toLocaleDateString()}
          </span>
        ),
      },
      {
        header: 'Actions',
        sortable: false,
        style: { textAlign: 'right' },
        render: () => (
          <div style={{ display: 'inline-flex', justifyContent: 'flex-end', gap: '0.35rem' }}>
            <Link
              to="/admin/mark-approval"
              className="btn btn-outline btn-sm"
              title={translateText('Inspect in Mark Approval')}
            >
              <MdVisibility /> {translateText('Inspect')}
            </Link>
          </div>
        ),
      },
    ],
    [translateText]
  );

  return (
    <AppLayout pageTitle="Marks Overview">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">{translateText('Marks Management')}</h1>
          <p className="page-subtitle">
            {translateText('Continuous Assessment (CA 30%) and Final Exam (70%) marks by batch course')}
          </p>
        </div>
        <div className="page-header-actions">
          <Link to="/admin/mark-approval" className="btn btn-primary btn-sm">
            <MdCheckCircle /> {translateText('Mark Approvals')}
          </Link>
        </div>
      </div>

      <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <MdFilterList style={{ color: 'var(--color-text-muted)' }} />
          <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>
            {translateText('Status Filter:')}
          </span>
          <select
            className="form-input"
            style={{ width: 'auto', height: '36px', padding: '0.25rem 0.75rem' }}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label={translateText('Filter by submission status')}
          >
            <option value="">{translateText('All Statuses')}</option>
            <option value="draft">{translateText('Draft')}</option>
            <option value="submitted">{translateText('Awaiting Review (Submitted)')}</option>
            <option value="returned">{translateText('Returned for Correction')}</option>
            <option value="approved">{translateText('Approved')}</option>
            <option value="published">{translateText('Published')}</option>
          </select>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={filteredSubmissions}
        isLoading={isLoading}
        searchPlaceholder="Search by course code, batch, or lecturer..."
        emptyTitle="No Marksheets Created"
        emptySubtitle="Marksheets are initiated when lecturers enter assessments for allocated courses."
        pageSize={12}
        exportable={true}
        exportFileName="unhimas_marksheets_overview"
      />
    </AppLayout>
  );
}
