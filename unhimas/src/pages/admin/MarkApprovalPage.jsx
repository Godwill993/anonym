import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  MdCheckCircle,
  MdAssignmentReturn,
  MdPublish,
  MdVisibility,
  MdSearch,
  MdPendingActions,
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

  const { data: submissions = [], isLoading } = useQuery({
    queryKey: ['admin-mark-submissions', statusFilter],
    queryFn: () => getMarkSubmissions({ status: statusFilter || null }),
  });

  const { data: detailData, isLoading: detailLoading } = useQuery({
    queryKey: ['admin-submission-detail', selectedSubmissionId],
    queryFn: () => getSubmissionDetail(selectedSubmissionId),
    enabled: Boolean(selectedSubmissionId),
  });

  const reviewMutation = useMutation({
    mutationFn: ({ id, status, admin_comment }) =>
      reviewSubmission(id, { status, admin_comment }),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin-mark-submissions'] });
      queryClient.invalidateQueries({ queryKey: ['admin-submission-detail', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['admin-overview-stats'] });
      if (variables.status === 'approved') {
        toast.success(translateText('Marksheet approved successfully'));
      } else if (variables.status === 'returned') {
        toast.info(translateText('Marksheet returned to lecturer for correction'));
        setIsReturnModalOpen(false);
        setReturnComment('');
      } else if (variables.status === 'published') {
        toast.success(translateText('Results published to student transcripts!'));
      }
    },
    onError: (err) => {
      toast.error(err.message || translateText('Workflow update failed'));
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
    reviewMutation.mutate({
      id: submissionToReturn.id,
      status: 'returned',
      admin_comment: returnComment.trim(),
    });
  };

  const filteredSubmissions = submissions.filter((s) => {
    const term = search.toLowerCase();
    const courseCode = s.batch_courses?.courses?.code?.toLowerCase() || '';
    const courseName = s.batch_courses?.courses?.name?.toLowerCase() || '';
    const batchName = s.batch_courses?.batches?.name?.toLowerCase() || '';
    const lecturerName = `${s.lecturers?.first_name} ${s.lecturers?.last_name}`.toLowerCase();
    return (
      courseCode.includes(term) ||
      courseName.includes(term) ||
      batchName.includes(term) ||
      lecturerName.includes(term)
    );
  });

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
      default:
        return <span className="badge badge-gray">{status}</span>;
    }
  };

  return (
    <AppLayout pageTitle={translateText('Marks Approval')}>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">{translateText('Marks Approval & Publishing')}</h1>
          <p className="page-subtitle">
            {translateText('Rigorous examination verification workflow — Bilingual 30% CA (5% Attendance + 25% Continuous Assessment) + 70% Final Exam')}
          </p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-header" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ position: 'relative', minWidth: '240px', flex: '1 1 200px' }}>
            <MdSearch style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)', fontSize: '1.1rem' }} />
            <input type="text" className="form-input" style={{ paddingLeft: '2.25rem' }} placeholder={translateText('Search by course, batch, or lecturer...')} value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div style={{ minWidth: '200px' }}>
            <select className="form-input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label={translateText('Filter by submission status')}>
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
                <tr><td colSpan="7" style={{ textAlign: 'center', padding: '3rem' }}>{translateText('Loading mark submissions...')}</td></tr>
              ) : filteredSubmissions.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '3rem' }}>
                    <div className="empty-state">
                      <MdPendingActions className="empty-state-icon" />
                      <div className="empty-state-title">{translateText('No Marksheets in this Category')}</div>
                      <div className="empty-state-text">{translateText('When lecturers submit CA and Exam grades, they will appear here for verification.')}</div>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredSubmissions.map((sub) => (
                  <tr key={sub.id} style={{ background: selectedSubmissionId === sub.id ? 'rgba(17, 47, 66, 0.05)' : 'inherit' }}>
                    <td>
                      <div>
                        <code style={{ fontSize: '0.85rem', background: 'var(--color-bg)', padding: '2px 6px', borderRadius: '4px', fontWeight: 700, color: 'var(--color-primary)' }}>{sub.batch_courses?.courses?.code}</code>{' '}
                        <strong>{sub.batch_courses?.courses?.name}</strong>
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>{sub.batch_courses?.courses?.credit_units} {translateText('credits')}</div>
                    </td>
                    <td>
                      <div>{sub.batch_courses?.batches?.name}</div>
                      <code style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>{sub.batch_courses?.batches?.code}</code>
                    </td>
                    <td>{sub.batch_courses?.semesters?.name}</td>
                    <td>
                      <strong>{sub.lecturers?.first_name} {sub.lecturers?.last_name}</strong>
                      <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>ID: {sub.lecturers?.staff_id}</div>
                    </td>
                    <td>{getStatusBadge(sub.status)}</td>
                    <td>{sub.submitted_at ? new Date(sub.submitted_at).toLocaleDateString() : '—'}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="btn btn-outline btn-sm" onClick={() => setSelectedSubmissionId(sub.id)}>
                        <MdVisibility /> {selectedSubmissionId === sub.id ? translateText('Viewing') : translateText('Inspect')}
                      </button>
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
                {translateText('Inspection')}: {detailData?.batch_courses?.courses?.code} — {detailData?.batch_courses?.courses?.name}
              </div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginTop: '0.2rem' }}>
                {translateText('Cohort')}: {detailData?.batch_courses?.batches?.name} • {translateText('Lecturer')}: {detailData?.lecturers?.first_name} {detailData?.lecturers?.last_name} • {translateText('Status')}: {detailData?.status?.toUpperCase()}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {detailData?.status === 'submitted' && canApproveMarks && (
                <>
                  <button className="btn btn-secondary btn-sm" onClick={() => handleOpenReturnModal(detailData)} disabled={reviewMutation.isPending}>
                    <MdAssignmentReturn /> {translateText('Return with Comments')}
                  </button>
                  <button className="btn btn-primary btn-sm" onClick={() => reviewMutation.mutate({ id: detailData.id, status: 'approved', admin_comment: 'Approved by Administrator' })} disabled={reviewMutation.isPending}>
                    <MdCheckCircle /> {translateText('Approve Marksheet')}
                  </button>
                </>
              )}
              {detailData?.status === 'approved' && canPublishResults && (
                <button className="btn btn-primary btn-sm" style={{ background: '#059669' }} onClick={() => reviewMutation.mutate({ id: detailData.id, status: 'published', admin_comment: 'Officially published to transcripts' })} disabled={reviewMutation.isPending}>
                  <MdPublish /> {translateText('Publish Results to Students')}
                </button>
              )}
              <button className="btn btn-outline btn-sm" onClick={() => setSelectedSubmissionId(null)}>{translateText('Close')}</button>
            </div>
          </div>

          <div className="card-body">
            {detailLoading ? (
              <div style={{ textAlign: 'center', padding: '2rem' }}>{translateText('Loading student marks...')}</div>
            ) : detailData?.marks?.length === 0 ? (
              <div className="empty-state" style={{ padding: '2rem' }}>
                <div className="empty-state-title">{translateText('No Student Marks Recorded Yet')}</div>
                <div className="empty-state-text">{translateText('The lecturer has not entered individual student assessment scores for this submission.')}</div>
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
                    {detailData?.marks?.map((m) => {
                      const caSubtotal = (Number(m.attendance_score) || 0) + (Number(m.coursework_score) || 0);
                      return (
                        <tr key={m.id}>
                          <td><code>{m.students?.matricule}</code></td>
                          <td><strong>{m.students?.first_name} {m.students?.last_name}</strong></td>
                          <td>{m.attendance_score}</td>
                          <td>{m.coursework_score}</td>
                          <td><strong>{caSubtotal.toFixed(1)}</strong></td>
                          <td>{m.exam_score}</td>
                          <td><strong style={{ fontSize: '0.95rem' }}>{m.total_score}</strong></td>
                          <td>
                            <span className={`badge ${m.grade === 'A' || m.grade === 'B' ? 'badge-green' : m.grade === 'C' || m.grade === 'D' ? 'badge-blue' : 'badge-red'}`}>
                              {m.grade || '—'}
                            </span>
                          </td>
                          <td>{m.grade_point ?? '—'}</td>
                          <td style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>{m.lecturer_comment || '—'}</td>
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
        onClose={() => setIsReturnModalOpen(false)}
        title={translateText('Return Marksheet to Lecturer')}
        footer={
          <>
            <button type="button" className="btn btn-outline" onClick={() => setIsReturnModalOpen(false)}>{translateText('Cancel')}</button>
            <button type="button" className="btn btn-secondary" onClick={handleConfirmReturn} disabled={reviewMutation.isPending}>{translateText('Return Marksheet')}</button>
          </>
        }
      >
        <p style={{ fontSize: '0.875rem', marginBottom: '1rem', color: 'var(--color-text-muted)' }}>
          {translateText('Please specify what errors or issues need to be corrected by the lecturer before this mark sheet can be approved:')}
        </p>
        <div className="form-group">
          <label className="form-label">{translateText('Reviewer Comments / Instructions')} *</label>
          <textarea className="form-input" rows="4" placeholder={translateText('e.g. Please re-check coursework scores for student UNH/2026/004. Exam score exceeds 70...')} value={returnComment} onChange={(e) => setReturnComment(e.target.value)} required />
        </div>
      </Modal>
    </AppLayout>
  );
}
