import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  MdCheckCircle,
  MdAssignmentReturn,
  MdPublish,
  MdVisibility,
  MdSearch,
  MdPendingActions,
  MdGroups,
} from 'react-icons/md';
import AppLayout from '../../components/layout/AppLayout';
import Modal from '../../components/common/Modal';
import { toast } from '../../components/common/Toast';
import { useTranslation } from '../../i18n';
import { usePermissions } from '../../hooks/usePermissions';
import {
  getMarkSubmissions,
  getSubmissionDetail,
  reviewSubmission,
  listBatchSemesterReadiness,
  getBatchResultsReadiness,
  publishBatchResults,
} from '../../services/operationsService';

export default function MarkApprovalPage() {
  const { translateText } = useTranslation();
  const { canApproveMarks, canPublishResults } = usePermissions();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [selectedSubmissionId, setSelectedSubmissionId] = useState(null);
  const [returnComment, setReturnComment] = useState('');
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [submissionToReturn, setSubmissionToReturn] = useState(null);
  const [readinessFocus, setReadinessFocus] = useState(null);

  const { data: submissions = [], isLoading } = useQuery({
    queryKey: ['admin-mark-submissions', statusFilter],
    queryFn: () => getMarkSubmissions({ status: statusFilter || null }),
  });

  const { data: batchReadiness = [], isLoading: readinessLoading } = useQuery({
    queryKey: ['batch-semester-readiness'],
    queryFn: async () => {
      try {
        return await listBatchSemesterReadiness();
      } catch (err) {
        console.warn('list_batch_semester_readiness unavailable:', err?.message || err);
        return [];
      }
    },
  });

  const { data: detailData, isLoading: detailLoading } = useQuery({
    queryKey: ['admin-submission-detail', selectedSubmissionId],
    queryFn: () => getSubmissionDetail(selectedSubmissionId),
    enabled: Boolean(selectedSubmissionId),
  });

  const focusKey = readinessFocus
    ? `${readinessFocus.batch_id}:${readinessFocus.semester_id}`
    : null;

  const { data: courseReadiness = [], isLoading: courseReadinessLoading } = useQuery({
    queryKey: ['batch-results-readiness', focusKey],
    queryFn: async () => {
      try {
        return await getBatchResultsReadiness(readinessFocus.batch_id, readinessFocus.semester_id);
      } catch (err) {
        console.warn('get_batch_results_readiness unavailable:', err?.message || err);
        return [];
      }
    },
    enabled: Boolean(readinessFocus?.batch_id && readinessFocus?.semester_id),
  });

  const reviewMutation = useMutation({
    mutationFn: ({ id, status, admin_comment }) =>
      reviewSubmission(id, { status, admin_comment }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin-mark-submissions'] });
      queryClient.invalidateQueries({ queryKey: ['admin-submission-detail', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['admin-overview-stats'] });
      queryClient.invalidateQueries({ queryKey: ['batch-semester-readiness'] });
      queryClient.invalidateQueries({ queryKey: ['batch-results-readiness'] });
      if (variables.status === 'approved') {
        toast.success(translateText('Marksheet approved successfully'));
      } else if (variables.status === 'returned') {
        toast.info(translateText('Marksheet returned to lecturer for correction'));
        setIsReturnModalOpen(false);
        setReturnComment('');
        setSubmissionToReturn(null);
      } else if (variables.status === 'published') {
        toast.success(translateText('Results published to student transcripts!'));
      }
    },
    onError: (err) => {
      toast.error(err.message || translateText('Workflow update failed'));
    },
  });

  const publishBatchMutation = useMutation({
    mutationFn: ({ batchId, semesterId }) => publishBatchResults(batchId, semesterId),
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['admin-mark-submissions'] });
      queryClient.invalidateQueries({ queryKey: ['admin-submission-detail'] });
      queryClient.invalidateQueries({ queryKey: ['batch-semester-readiness'] });
      queryClient.invalidateQueries({ queryKey: ['batch-results-readiness'] });
      queryClient.invalidateQueries({ queryKey: ['admin-overview-stats'] });
      toast.success(
        translateText(
          count === 1
            ? '1 course result published for this batch'
            : `${count} course results published for this batch`
        )
      );
    },
    onError: (err) => {
      toast.error(err.message || translateText('Batch publish failed'));
    },
  });

  const handleOpenReturnModal = (sub) => {
    setSubmissionToReturn(sub);
    setReturnComment(sub.admin_comment || '');
    setIsReturnModalOpen(true);
  };

  const handleConfirmReturn = () => {
    if (!returnComment.trim()) {
      toast.error(translateText('Please specify reasons for returning the mark sheet'));
      return;
    }
    if (!submissionToReturn?.id) return;
    reviewMutation.mutate({
      id: submissionToReturn.id,
      status: 'returned',
      admin_comment: returnComment.trim(),
    });
  };

  const handleApprove = (sub) => {
    if (!sub?.id) return;
    setSelectedSubmissionId(sub.id);
    reviewMutation.mutate({
      id: sub.id,
      status: 'approved',
      admin_comment: 'Approved by Administrator',
    });
  };

  const filteredSubmissions = submissions.filter((s) => {
    const term = search.toLowerCase();
    const courseCode = s.batch_courses?.courses?.code?.toLowerCase() || '';
    const courseName = s.batch_courses?.courses?.name?.toLowerCase() || '';
    const batchName = s.batch_courses?.batches?.name?.toLowerCase() || '';
    const lecturerName = `${s.lecturers?.first_name || ''} ${s.lecturers?.last_name || ''}`.toLowerCase();
    return (
      courseCode.includes(term) ||
      courseName.includes(term) ||
      batchName.includes(term) ||
      lecturerName.includes(term)
    );
  });

  const selectedBatchReady = useMemo(() => {
    if (!detailData?.batch_courses?.batches?.id || !detailData?.batch_courses?.semesters?.id) {
      return null;
    }
    return batchReadiness.find(
      (r) =>
        r.batch_id === detailData.batch_courses.batches.id &&
        r.semester_id === detailData.batch_courses.semesters.id
    );
  }, [batchReadiness, detailData]);

  const handlePublishFromRow = (sub) => {
    const batchId = sub?.batch_courses?.batches?.id;
    const semesterId = sub?.batch_courses?.semesters?.id;
    const row =
      batchId && semesterId
        ? batchReadiness.find((r) => r.batch_id === batchId && r.semester_id === semesterId)
        : null;
    if (row?.can_publish && batchId && semesterId) {
      publishBatchMutation.mutate({ batchId, semesterId });
      return;
    }
    if (batchReadiness.length === 0) {
      reviewMutation.mutate({
        id: sub.id,
        status: 'published',
        admin_comment: 'Officially published to transcripts',
      });
      return;
    }
    toast.error(translateText('All courses in this batch must be approved before publishing'));
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'submitted':
        return <span className="badge badge-amber">{translateText('Awaiting Approval')}</span>;
      case 'approved':
        return <span className="badge badge-blue">{translateText('Approved (Ready to Publish)')}</span>;
      case 'published':
        return <span className="badge badge-green">{translateText('Published to Students')}</span>;
      case 'returned':
        return <span className="badge badge-red">{translateText('Returned to Lecturer')}</span>;
      case 'draft':
        return <span className="badge badge-gray">{translateText('Draft')}</span>;
      default:
        return <span className="badge badge-gray">{status || translateText('No submission')}</span>;
    }
  };

  return (
    <AppLayout pageTitle={translateText('Marks Approval')}>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">{translateText('Marks Approval & Publishing')}</h1>
          <p className="page-subtitle">
            {translateText(
              'Approve each course marksheet, or return it to the lecturer with a complaint message. Publish the full batch only when every course is approved.'
            )}
          </p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-header">
          <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <MdGroups /> {translateText('Batch results readiness')}
          </div>
          <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', margin: 0 }}>
            {translateText('Students see results only after the entire batch–semester is published.')}
          </p>
        </div>
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>{translateText('Batch')}</th>
                <th>{translateText('Department')}</th>
                <th>{translateText('Semester')}</th>
                <th>{translateText('Courses')}</th>
                <th>{translateText('Ready')}</th>
                <th>{translateText('Published')}</th>
                <th>{translateText('Pending')}</th>
                <th style={{ textAlign: 'right' }}>{translateText('Actions')}</th>
              </tr>
            </thead>
            <tbody>
              {readinessLoading ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '2rem' }}>
                    {translateText('Loading batch readiness...')}
                  </td>
                </tr>
              ) : batchReadiness.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '2rem' }}>
                    <div className="empty-state">
                      <div className="empty-state-title">{translateText('No batch courses yet')}</div>
                      <div className="empty-state-text">
                        {translateText('Assign courses to batches to track mark submission progress.')}
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                batchReadiness.map((row) => (
                  <tr key={`${row.batch_id}-${row.semester_id}`}>
                    <td>
                      <strong>{row.batch_name}</strong>
                      {row.batch_code && (
                        <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                          {row.batch_code}
                        </div>
                      )}
                    </td>
                    <td>{row.department_name}</td>
                    <td>
                      {row.semester_name}
                      <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                        {row.academic_year}
                      </div>
                    </td>
                    <td>{row.total_courses}</td>
                    <td>
                      <span className={`badge ${row.ready_courses === row.total_courses ? 'badge-green' : 'badge-amber'}`}>
                        {row.ready_courses}/{row.total_courses}
                      </span>
                    </td>
                    <td>{row.published_courses}</td>
                    <td>
                      {row.pending_courses > 0 ? (
                        <span className="badge badge-red">{row.pending_courses}</span>
                      ) : (
                        <span className="badge badge-green">0</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          onClick={() =>
                            setReadinessFocus({
                              batch_id: row.batch_id,
                              semester_id: row.semester_id,
                              label: `${row.batch_name} · ${row.semester_name}`,
                            })
                          }
                        >
                          <MdVisibility /> {translateText('Details')}
                        </button>
                        {canPublishResults && row.can_publish && (
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            style={{ background: '#059669' }}
                            disabled={publishBatchMutation.isPending}
                            onClick={() =>
                              publishBatchMutation.mutate({
                                batchId: row.batch_id,
                                semesterId: row.semester_id,
                              })
                            }
                          >
                            <MdPublish /> {translateText('Publish batch results')}
                          </button>
                        )}
                        {row.all_published && (
                          <span className="badge badge-green">{translateText('Fully published')}</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {readinessFocus && (
          <div className="card-body" style={{ borderTop: '1px solid var(--color-border)', marginTop: '0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <strong>
                {translateText('Course status')}: {readinessFocus.label}
              </strong>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setReadinessFocus(null)}>
                {translateText('Close')}
              </button>
            </div>
            {courseReadinessLoading ? (
              <div style={{ padding: '1rem', textAlign: 'center' }}>{translateText('Loading...')}</div>
            ) : (
              <div className="table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>{translateText('Course')}</th>
                      <th>{translateText('Lecturer')}</th>
                      <th>{translateText('Status')}</th>
                      <th>{translateText('Ready')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {courseReadiness.map((c) => (
                      <tr key={c.batch_course_id}>
                        <td>
                          <code style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-primary)' }}>
                            {c.course_code}
                          </code>{' '}
                          {c.course_name}
                        </td>
                        <td>{c.lecturer_name || '—'}</td>
                        <td>{getStatusBadge(c.submission_status)}</td>
                        <td>
                          {c.is_ready ? (
                            <span className="badge badge-green">{translateText('Yes')}</span>
                          ) : (
                            <span className="badge badge-red">{translateText('No')}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-header" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ position: 'relative', minWidth: '240px', flex: '1 1 200px' }}>
            <MdSearch style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)', fontSize: '1.1rem' }} />
            <input
              type="text"
              className="form-input"
              style={{ paddingLeft: '2.25rem' }}
              placeholder={translateText('Search by course, batch, or lecturer...')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div style={{ minWidth: '200px' }}>
            <select
              className="form-input"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label={translateText('Filter by submission status')}
            >
              <option value="">{translateText('All Submission States')}</option>
              <option value="submitted">{translateText('Awaiting Review (Submitted)')}</option>
              <option value="approved">{translateText('Approved')}</option>
              <option value="published">{translateText('Published')}</option>
              <option value="returned">{translateText('Returned for correction')}</option>
            </select>
          </div>
        </div>

        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>{translateText('Course')}</th>
                <th>{translateText('Batch / Cohort')}</th>
                <th>{translateText('Semester')}</th>
                <th>{translateText('Lecturer')}</th>
                <th>{translateText('Submission Status')}</th>
                <th>{translateText('Submitted Date')}</th>
                <th style={{ textAlign: 'right' }}>{translateText('Actions')}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '3rem' }}>
                    {translateText('Loading mark submissions...')}
                  </td>
                </tr>
              ) : filteredSubmissions.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '3rem' }}>
                    <div className="empty-state">
                      <MdPendingActions className="empty-state-icon" />
                      <div className="empty-state-title">{translateText('No Marksheets in this Category')}</div>
                      <div className="empty-state-text">
                        {translateText('When lecturers submit CA and Exam grades, they will appear here for verification.')}
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredSubmissions.map((sub) => (
                  <tr
                    key={sub.id}
                    style={{
                      background: selectedSubmissionId === sub.id ? 'rgba(17, 47, 66, 0.05)' : 'inherit',
                    }}
                  >
                    <td>
                      <div>
                        <code style={{ fontSize: '0.85rem', background: 'var(--color-bg)', padding: '2px 6px', borderRadius: '4px', fontWeight: 700, color: 'var(--color-primary)' }}>
                          {sub.batch_courses?.courses?.code}
                        </code>{' '}
                        <strong>{sub.batch_courses?.courses?.name}</strong>
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                        {sub.batch_courses?.courses?.credit_units} {translateText('credits')}
                      </div>
                    </td>
                    <td>
                      <div>{sub.batch_courses?.batches?.name}</div>
                      <code style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                        {sub.batch_courses?.batches?.code}
                      </code>
                    </td>
                    <td>{sub.batch_courses?.semesters?.name}</td>
                    <td>
                      <strong>
                        {sub.lecturers?.first_name} {sub.lecturers?.last_name}
                      </strong>
                      <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                        ID: {sub.lecturers?.staff_id}
                      </div>
                    </td>
                    <td>{getStatusBadge(sub.status)}</td>
                    <td>{sub.submitted_at ? new Date(sub.submitted_at).toLocaleDateString() : '—'}</td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '0.35rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          onClick={() => setSelectedSubmissionId(sub.id)}
                        >
                          <MdVisibility />{' '}
                          {selectedSubmissionId === sub.id ? translateText('Viewing') : translateText('Inspect')}
                        </button>
                        {sub.status === 'submitted' && canApproveMarks && (
                          <>
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              disabled={reviewMutation.isPending}
                              title={translateText('Approve this marksheet')}
                              onClick={() => handleApprove(sub)}
                            >
                              <MdCheckCircle /> {translateText('Approve')}
                            </button>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              disabled={reviewMutation.isPending}
                              title={translateText('Return to lecturer with a complaint message')}
                              onClick={() => handleOpenReturnModal(sub)}
                            >
                              <MdAssignmentReturn /> {translateText('Return')}
                            </button>
                          </>
                        )}
                        {sub.status === 'approved' && canPublishResults && (
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            style={{ background: '#059669' }}
                            disabled={publishBatchMutation.isPending || reviewMutation.isPending}
                            onClick={() => handlePublishFromRow(sub)}
                          >
                            <MdPublish /> {translateText('Publish')}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedSubmissionId && (
        <div className="card" style={{ border: '2px solid var(--color-primary)' }}>
          <div className="card-header" style={{ background: 'rgba(17, 47, 66, 0.04)' }}>
            <div>
              <div className="card-title" style={{ fontSize: '1.1rem' }}>
                {translateText('Inspection')}: {detailData?.batch_courses?.courses?.code} —{' '}
                {detailData?.batch_courses?.courses?.name}
              </div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginTop: '0.2rem' }}>
                {translateText('Cohort')}: {detailData?.batch_courses?.batches?.name} • {translateText('Lecturer')}:{' '}
                {detailData?.lecturers?.first_name} {detailData?.lecturers?.last_name} • {translateText('Status')}:{' '}
                {detailData?.status?.toUpperCase()}
              </div>
              {detailData?.admin_comment && (
                <div
                  style={{
                    marginTop: '0.5rem',
                    padding: '0.65rem 0.85rem',
                    borderRadius: 'var(--radius-md)',
                    background: detailData.status === 'returned' ? 'rgba(183,0,50,0.06)' : 'rgba(17,47,66,0.04)',
                    border: `1px solid ${detailData.status === 'returned' ? 'rgba(183,0,50,0.25)' : 'var(--color-border)'}`,
                    fontSize: '0.8125rem',
                  }}
                >
                  <strong style={{ color: detailData.status === 'returned' ? 'var(--color-secondary)' : 'var(--color-text)' }}>
                    {detailData.status === 'returned'
                      ? translateText('Return message to lecturer')
                      : translateText('Admin comment')}
                    :
                  </strong>{' '}
                  {detailData.admin_comment}
                </div>
              )}
              {selectedBatchReady && (
                <div style={{ fontSize: '0.78rem', marginTop: '0.35rem' }}>
                  {translateText('Batch readiness')}:{' '}
                  <strong>
                    {selectedBatchReady.ready_courses}/{selectedBatchReady.total_courses}
                  </strong>{' '}
                  {translateText('courses approved')}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {detailData?.status === 'submitted' && canApproveMarks && (
                <>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleOpenReturnModal(detailData)}
                    disabled={reviewMutation.isPending}
                  >
                    <MdAssignmentReturn /> {translateText('Return with Comments')}
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => handleApprove(detailData)}
                    disabled={reviewMutation.isPending}
                  >
                    <MdCheckCircle /> {translateText('Approve Marksheet')}
                  </button>
                </>
              )}
              {detailData?.status === 'approved' && canPublishResults && (
                <>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    style={{ background: '#059669' }}
                    disabled={
                      publishBatchMutation.isPending ||
                      reviewMutation.isPending ||
                      (selectedBatchReady && !selectedBatchReady.can_publish)
                    }
                    onClick={() => handlePublishFromRow(detailData)}
                  >
                    <MdPublish />{' '}
                    {selectedBatchReady?.can_publish
                      ? translateText('Publish batch results')
                      : translateText('Publish')}
                  </button>
                  {selectedBatchReady && !selectedBatchReady.can_publish && !selectedBatchReady.all_published && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', alignSelf: 'center' }}>
                      {translateText('Waiting for other courses in this batch')}
                    </span>
                  )}
                </>
              )}
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setSelectedSubmissionId(null)}
              >
                {translateText('Close')}
              </button>
            </div>
          </div>

          <div className="card-body">
            {detailLoading ? (
              <div style={{ padding: '2rem', textAlign: 'center' }}>{translateText('Loading marks...')}</div>
            ) : !detailData?.marks?.length ? (
              <div className="empty-state">
                <div className="empty-state-title">{translateText('No Student Marks Recorded Yet')}</div>
                <div className="empty-state-text">
                  {translateText('The lecturer has not entered individual student assessment scores for this submission.')}
                </div>
              </div>
            ) : (
              <div className="table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>{translateText('Matricule')}</th>
                      <th>{translateText('Student Name')}</th>
                      <th>{translateText('Attendance (/5)')}</th>
                      <th>{translateText('Coursework (/25)')}</th>
                      <th>{translateText('CA Subtotal (/30)')}</th>
                      <th>{translateText('Exam (/70)')}</th>
                      <th>{translateText('Total Score (/100)')}</th>
                      <th>{translateText('Grade')}</th>
                      <th>{translateText('Grade Point')}</th>
                      <th>{translateText('Lecturer Comment')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailData.marks.map((m) => {
                      const caSubtotal =
                        (Number(m.attendance_score) || 0) + (Number(m.coursework_score) || 0);
                      return (
                        <tr key={m.id}>
                          <td>
                            <code>{m.students?.matricule}</code>
                          </td>
                          <td>
                            <strong>
                              {m.students?.first_name} {m.students?.last_name}
                            </strong>
                          </td>
                          <td>{m.attendance_score}</td>
                          <td>{m.coursework_score}</td>
                          <td>
                            <strong>{caSubtotal.toFixed(1)}</strong>
                          </td>
                          <td>{m.exam_score}</td>
                          <td>
                            <strong style={{ fontSize: '0.95rem' }}>{m.total_score}</strong>
                          </td>
                          <td>
                            <span
                              className={`badge ${
                                m.grade === 'A' || m.grade === 'B'
                                  ? 'badge-green'
                                  : m.grade === 'C' || m.grade === 'D'
                                    ? 'badge-amber'
                                    : 'badge-red'
                              }`}
                            >
                              {m.grade || '—'}
                            </span>
                          </td>
                          <td>{m.grade_point ?? '—'}</td>
                          <td style={{ maxWidth: 180, fontSize: '0.8rem' }}>
                            {m.lecturer_comment || '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      <Modal
        isOpen={isReturnModalOpen}
        onClose={() => {
          setIsReturnModalOpen(false);
          setSubmissionToReturn(null);
        }}
        title={translateText('Return Marksheet to Lecturer')}
        footer={
          <>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => {
                setIsReturnModalOpen(false);
                setSubmissionToReturn(null);
              }}
            >
              {translateText('Cancel')}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleConfirmReturn}
              disabled={reviewMutation.isPending}
            >
              {reviewMutation.isPending
                ? translateText('Returning…')
                : translateText('Return Marksheet')}
            </button>
          </>
        }
      >
        <p style={{ fontSize: '0.875rem', marginBottom: '1rem', color: 'var(--color-text-muted)' }}>
          {translateText(
            'Write a clear complaint or correction message. The lecturer will see this note and must fix the marksheet before resubmitting.'
          )}
        </p>
        <div className="form-group">
          <label className="form-label">{translateText('Complaint / instructions for lecturer')} *</label>
          <textarea
            className="form-input"
            rows={4}
            placeholder={translateText(
              'e.g. Coursework scores for several students look incorrect. Please re-check CA for matricule UNH/2026/004. Exam must not exceed 70.'
            )}
            value={returnComment}
            onChange={(e) => setReturnComment(e.target.value)}
            required
          />
        </div>
      </Modal>
    </AppLayout>
  );
}
