import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MdCheckCircle, MdAssignmentReturn, MdPublish, MdVisibility, MdSearch } from 'react-icons/md';
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
  publishBatchResults,
} from '../../services/operationsService';

export default function MarkApprovalPage() {
  const { translateText } = useTranslation();
  const { canApproveMarks, canPublishResults, isAdmin } = usePermissions();
  const mayApprove = Boolean(canApproveMarks || isAdmin);
  const mayPublish = Boolean(canPublishResults || isAdmin);
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('submitted');
  const [search, setSearch] = useState('');
  const [selectedSubmissionId, setSelectedSubmissionId] = useState(null);
  const [returnComment, setReturnComment] = useState('');
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [submissionToReturn, setSubmissionToReturn] = useState(null);

  const { data: submissions = [], isLoading } = useQuery({
    queryKey: ['admin-mark-submissions', statusFilter],
    queryFn: () => getMarkSubmissions({ status: statusFilter || null }),
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

  const { data: detailData, isLoading: detailLoading } = useQuery({
    queryKey: ['admin-submission-detail', selectedSubmissionId],
    queryFn: () => getSubmissionDetail(selectedSubmissionId),
    enabled: Boolean(selectedSubmissionId),
  });

  const reviewMutation = useMutation({
    mutationFn: ({ id, status, admin_comment }) => reviewSubmission(id, { status, admin_comment }),
    onSuccess: (_d, v) => {
      queryClient.invalidateQueries({ queryKey: ['admin-mark-submissions'] });
      queryClient.invalidateQueries({ queryKey: ['admin-submission-detail', v.id] });
      queryClient.invalidateQueries({ queryKey: ['batch-semester-readiness'] });
      if (v.status === 'approved') toast.success(translateText('Marksheet approved successfully'));
      else if (v.status === 'returned') {
        toast.info(translateText('Marksheet returned to lecturer for correction'));
        setIsReturnModalOpen(false);
        setReturnComment('');
        setSubmissionToReturn(null);
      } else if (v.status === 'published') toast.success(translateText('Results published to student transcripts!'));
    },
    onError: (err) => toast.error(err.message || translateText('Workflow update failed')),
  });

  const publishBatchMutation = useMutation({
    mutationFn: ({ batchId, semesterId }) => publishBatchResults(batchId, semesterId),
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['admin-mark-submissions'] });
      queryClient.invalidateQueries({ queryKey: ['batch-semester-readiness'] });
      toast.success(translateText(`${count} course results published for this batch`));
    },
    onError: (err) => toast.error(err.message || translateText('Batch publish failed')),
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
    reviewMutation.mutate({ id: submissionToReturn.id, status: 'returned', admin_comment: returnComment.trim() });
  };

  const handleApprove = (sub) => {
    if (!sub?.id) return;
    setSelectedSubmissionId(sub.id);
    reviewMutation.mutate({ id: sub.id, status: 'approved', admin_comment: 'Approved by Administrator' });
  };

  const filteredSubmissions = submissions.filter((s) => {
    const term = search.toLowerCase();
    const hay = [s.batch_courses?.courses?.code, s.batch_courses?.courses?.name, s.batch_courses?.batches?.name, s.lecturers?.first_name, s.lecturers?.last_name].filter(Boolean).join(' ').toLowerCase();
    return hay.includes(term);
  });

  const selectedBatchReady = useMemo(() => {
    const b = detailData?.batch_courses?.batches?.id;
    const s = detailData?.batch_courses?.semesters?.id;
    if (!b || !s) return null;
    return batchReadiness.find((r) => r.batch_id === b && r.semester_id === s);
  }, [batchReadiness, detailData]);

  const handlePublishFromRow = (sub) => {
    const batchId = sub?.batch_courses?.batches?.id;
    const semesterId = sub?.batch_courses?.semesters?.id;
    const row = batchId && semesterId ? batchReadiness.find((r) => r.batch_id === batchId && r.semester_id === semesterId) : null;
    if (row?.can_publish && batchId && semesterId) {
      publishBatchMutation.mutate({ batchId, semesterId });
      return;
    }
    if (batchReadiness.length === 0) {
      reviewMutation.mutate({ id: sub.id, status: 'published', admin_comment: 'Officially published to transcripts' });
      return;
    }
    toast.error(translateText('All courses in this batch must be approved before publishing'));
  };

  const getStatusBadge = (status) => {
    const map = {
      submitted: ['badge-amber', 'Awaiting Approval'],
      approved: ['badge-blue', 'Approved'],
      published: ['badge-green', 'Published'],
      returned: ['badge-red', 'Returned'],
      draft: ['badge-gray', 'Draft'],
    };
    const [cls, label] = map[status] || ['badge-gray', status || '—'];
    return <span className={`badge ${cls}`}>{translateText(label)}</span>;
  };

  return (
    <AppLayout pageTitle={translateText('Marks Approval & Publishing')}>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">{translateText('Marks Approval & Publishing')}</h1>
          <p className="page-subtitle">{translateText('Approve submitted marksheets, return them with a complaint, or publish a full batch.')}</p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '1.25rem', padding: '1rem 1.25rem', borderLeft: '4px solid var(--color-primary)' }}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>{translateText('Mark approval workflow')}</div>
        <ol style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
          <li>{translateText('Lecturer: Mark Entry → Save All → Submit for Review')}</li>
          <li>{translateText('Admin: Approve, or Return with complaint (message required)')}</li>
          <li>{translateText('When every course in a batch is approved → Publish batch results')}</li>
        </ol>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-header" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ position: 'relative', minWidth: 240, flex: '1 1 200px' }}>
            <MdSearch style={{ position: 'absolute', left: 10, top: 10, color: 'var(--color-text-muted)' }} />
            <input className="form-input" style={{ paddingLeft: 34 }} placeholder={translateText('Search course, batch, lecturer…')} value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select className="form-input" style={{ maxWidth: 260 }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">{translateText('All Submission States')}</option>
            <option value="submitted">{translateText('Awaiting Review (Submitted)')}</option>
            <option value="approved">{translateText('Approved')}</option>
            <option value="published">{translateText('Published')}</option>
            <option value="returned">{translateText('Returned')}</option>
            <option value="draft">{translateText('Draft')}</option>
          </select>
        </div>

        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>{translateText('Course')}</th>
                <th>{translateText('Batch')}</th>
                <th>{translateText('Semester')}</th>
                <th>{translateText('Lecturer')}</th>
                <th>{translateText('Status')}</th>
                <th>{translateText('Submitted')}</th>
                <th style={{ textAlign: 'right' }}>{translateText('Actions')}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: '2rem' }}>{translateText('Loading…')}</td></tr>
              ) : filteredSubmissions.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '2rem' }}>
                    <div className="empty-state">
                      <div className="empty-state-title">{translateText('No marksheets in this filter')}</div>
                      <div className="empty-state-text">{translateText('Lecturers must submit marks first. Try filter “All Submission States”.')}</div>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredSubmissions.map((sub) => (
                  <tr key={sub.id}>
                    <td>
                      <strong>{sub.batch_courses?.courses?.code}</strong>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{sub.batch_courses?.courses?.name}</div>
                    </td>
                    <td>{sub.batch_courses?.batches?.name}</td>
                    <td>{sub.batch_courses?.semesters?.name}</td>
                    <td>{sub.lecturers?.first_name} {sub.lecturers?.last_name}</td>
                    <td>{getStatusBadge(sub.status)}</td>
                    <td>{sub.submitted_at ? new Date(sub.submitted_at).toLocaleDateString() : '—'}</td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '0.35rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        <button type="button" className="btn btn-outline btn-sm" onClick={() => setSelectedSubmissionId(sub.id)}>
                          <MdVisibility /> {translateText('Inspect')}
                        </button>
                        {sub.status === 'submitted' && mayApprove && (
                          <>
                            <button type="button" className="btn btn-primary btn-sm" disabled={reviewMutation.isPending} onClick={() => handleApprove(sub)} style={{ fontWeight: 600 }}>
                              <MdCheckCircle /> {translateText('Approve')}
                            </button>
                            <button type="button" className="btn btn-secondary btn-sm" disabled={reviewMutation.isPending} onClick={() => handleOpenReturnModal(sub)} style={{ fontWeight: 600 }}>
                              <MdAssignmentReturn /> {translateText('Return with complaint')}
                            </button>
                          </>
                        )}
                        {sub.status === 'approved' && mayPublish && (
                          <button type="button" className="btn btn-primary btn-sm" style={{ background: '#059669', fontWeight: 600 }} disabled={publishBatchMutation.isPending} onClick={() => handlePublishFromRow(sub)}>
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
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div className="card-header" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <h2 className="card-title" style={{ margin: 0 }}>
                {detailData?.batch_courses?.courses?.code} — {detailData?.batch_courses?.courses?.name}
              </h2>
              <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>{getStatusBadge(detailData?.status)}</div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginLeft: 'auto' }}>
              {detailData?.status === 'submitted' && mayApprove && (
                <>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleOpenReturnModal(detailData)} disabled={reviewMutation.isPending}>
                    <MdAssignmentReturn /> {translateText('Return with complaint')}
                  </button>
                  <button type="button" className="btn btn-primary btn-sm" onClick={() => handleApprove(detailData)} disabled={reviewMutation.isPending}>
                    <MdCheckCircle /> {translateText('Approve marksheet')}
                  </button>
                </>
              )}
              {detailData?.status === 'approved' && mayPublish && (
                <button type="button" className="btn btn-primary btn-sm" style={{ background: '#059669' }} disabled={publishBatchMutation.isPending || (selectedBatchReady && !selectedBatchReady.can_publish)} onClick={() => handlePublishFromRow(detailData)}>
                  <MdPublish /> {translateText('Publish batch results')}
                </button>
              )}
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setSelectedSubmissionId(null)}>{translateText('Close')}</button>
            </div>
          </div>
          <div className="card-body">
            {detailLoading ? (
              <div style={{ padding: '2rem', textAlign: 'center' }}>{translateText('Loading marks...')}</div>
            ) : !detailData?.marks?.length ? (
              <div className="empty-state"><div className="empty-state-title">{translateText('No student marks on this sheet')}</div></div>
            ) : (
              <div className="table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>{translateText('Matricule')}</th>
                      <th>{translateText('Student')}</th>
                      <th>{translateText('Attendance')}</th>
                      <th>{translateText('Coursework')}</th>
                      <th>{translateText('Exam')}</th>
                      <th>{translateText('Total')}</th>
                      <th>{translateText('Grade')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailData.marks.map((m) => (
                      <tr key={m.id}>
                        <td>{m.students?.matricule}</td>
                        <td>{m.students?.first_name} {m.students?.last_name}</td>
                        <td>{m.attendance_score}</td>
                        <td>{m.coursework_score}</td>
                        <td>{m.exam_score}</td>
                        <td><strong>{(Number(m.attendance_score) || 0) + (Number(m.coursework_score) || 0) + (Number(m.exam_score) || 0)}</strong></td>
                        <td>{m.grade || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      <Modal
        isOpen={isReturnModalOpen}
        onClose={() => { setIsReturnModalOpen(false); setSubmissionToReturn(null); setReturnComment(''); }}
        title={translateText('Return marksheet with complaint')}
        footer={
          <>
            <button type="button" className="btn btn-outline" onClick={() => { setIsReturnModalOpen(false); setSubmissionToReturn(null); }}>{translateText('Cancel')}</button>
            <button type="button" className="btn btn-secondary" onClick={handleConfirmReturn} disabled={reviewMutation.isPending}>
              {reviewMutation.isPending ? translateText('Sending…') : translateText('Send back to lecturer')}
            </button>
          </>
        }
      >
        <p style={{ marginBottom: '0.75rem', fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
          {translateText('Write a clear complaint or correction message. The lecturer will see this note and must fix the marksheet before resubmitting.')}
        </p>
        <label className="form-label">{translateText('Complaint / instructions for lecturer')} *</label>
        <textarea className="form-input" rows={5} value={returnComment} onChange={(e) => setReturnComment(e.target.value)} placeholder={translateText('e.g. Exam scores for students 3–5 exceed the maximum; please correct.')} />
      </Modal>
    </AppLayout>
  );
}
