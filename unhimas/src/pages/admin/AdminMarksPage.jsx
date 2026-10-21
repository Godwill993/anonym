import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { MdGrade, MdCheckCircle, MdVisibility, MdFilterList, MdPublish } from 'react-icons/md';
import AppLayout from '../../components/layout/AppLayout';
import DataTable from '../../components/common/DataTable';
import { toast } from '../../components/common/Toast';
import {
  getMarkSubmissions,
  listBatchSemesterReadiness,
  publishBatchResults,
  reviewSubmission,
} from '../../services/operationsService';
import { usePermissions } from '../../hooks/usePermissions';
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
  const { canPublishResults } = usePermissions();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');

  const { data: submissions = [], isLoading } = useQuery({
    queryKey: ['admin-all-marks'],
    queryFn: () => getMarkSubmissions(),
  });

  const { data: batchReadiness = [] } = useQuery({
    queryKey: ['batch-semester-readiness'],
    queryFn: async () => {
      try {
        return await listBatchSemesterReadiness();
      } catch {
        return [];
      }
    },
  });

  const publishMutation = useMutation({
    mutationFn: async (sub) => {
      const batchId = sub?.batch_courses?.batches?.id;
      const semesterId = sub?.batch_courses?.semesters?.id;
      const row =
        batchId && semesterId
          ? batchReadiness.find((r) => r.batch_id === batchId && r.semester_id === semesterId)
          : null;

      if (row?.can_publish && batchId && semesterId) {
        return { mode: 'batch', count: await publishBatchResults(batchId, semesterId) };
      }

      if (!row && batchReadiness.length === 0) {
        await reviewSubmission(sub.id, {
          status: 'published',
          admin_comment: 'Officially published to transcripts',
        });
        return { mode: 'single', count: 1 };
      }

      throw new Error(
        translateText(
          'Cannot publish yet — every course in this batch must be approved first. Open Mark Approvals to review pending marksheets.'
        )
      );
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['admin-all-marks'] });
      queryClient.invalidateQueries({ queryKey: ['admin-mark-submissions'] });
      queryClient.invalidateQueries({ queryKey: ['batch-semester-readiness'] });
      if (result.mode === 'batch') {
        toast.success(
          result.count === 1
            ? translateText('1 course result published for this batch')
            : translateText(`${result.count} course results published for this batch`)
        );
      } else {
        toast.success(translateText('Results published to student transcripts!'));
      }
    },
    onError: (err) => {
      toast.error(err.message || translateText('Publish failed'));
    },
  });

  const filteredSubmissions = useMemo(() => {
    if (!statusFilter) return submissions;
    return submissions.filter((s) => s.status === statusFilter);
  }, [submissions, statusFilter]);

  const canPublishRow = (s) => {
    if (s.status !== 'approved' || !canPublishResults) return false;
    const batchId = s?.batch_courses?.batches?.id;
    const semesterId = s?.batch_courses?.semesters?.id;
    if (!batchId || !semesterId) return true;
    const row = batchReadiness.find((r) => r.batch_id === batchId && r.semester_id === semesterId);
    if (!row && batchReadiness.length === 0) return true;
    return Boolean(row?.can_publish);
  };

  const columns = useMemo(
    () => [
      {
        header: 'Course',
        accessor: 'course_code',
        sortValue: (s) => s.batch_courses?.courses?.code || '',
        render: (s) => (
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
            <strong>
              {s.lecturers?.first_name} {s.lecturers?.last_name}
            </strong>
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
        render: (s) => (
          <div style={{ display: 'inline-flex', justifyContent: 'flex-end', gap: '0.35rem', flexWrap: 'wrap' }}>
            <Link
              to="/admin/mark-approval"
              className="btn btn-outline btn-sm"
              title={translateText('Inspect in Mark Approval')}
            >
              <MdVisibility /> {translateText('Inspect')}
            </Link>
            {s.status === 'approved' && canPublishResults && (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                style={{ background: '#059669' }}
                disabled={publishMutation.isPending || !canPublishRow(s)}
                title={
                  canPublishRow(s)
                    ? translateText('Publish results to students')
                    : translateText('All courses in this batch must be approved before publishing')
                }
                onClick={() => publishMutation.mutate(s)}
              >
                <MdPublish /> {translateText('Publish')}
              </button>
            )}
          </div>
        ),
      },
    ],
    [translateText, canPublishResults, canPublishRow, publishMutation.isPending]
  );

  return (
    <AppLayout pageTitle="Marks Overview">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">{translateText('Marks Management')}</h1>
          <p className="page-subtitle">
            {translateText(
              'Continuous Assessment (CA 30%) and Final Exam (70%) marks by batch course. Publish when the full batch is approved.'
            )}
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
