import { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import {
  MdGrade,
  MdSave,
  MdSend,
  MdPublish,
  MdWarning,
  MdInfo,
  MdClose,
  MdCheckCircle,
} from 'react-icons/md';
import AppLayout from '../../components/layout/AppLayout';
import { useAuth } from '../../context/AuthContext';
import Modal from '../../components/common/Modal';
import { useToast } from '../../hooks/useToast';
import {
  getMyLecturerProfile,
  getMyCourses,
  getOrCreateMarkSubmission,
  getMarksForSubmission,
  getStudentsInBatch,
  upsertMark,
  submitMarkSubmission,
  resubmitMarkSubmission,
} from '../../services/lecturerService';
import { getSystemSettings } from '../../services/operationsService';
import { computeGrade, gradeBadgeClass } from '../../lib/grading.js';

const STATUS_LABELS = {
  draft: { cls: 'badge-gray', text: 'Draft — Not Submitted' },
  submitted: { cls: 'badge-blue', text: 'Submitted — Pending Review' },
  returned: { cls: 'badge-red', text: 'Returned — Needs Correction' },
  approved: { cls: 'badge-green', text: 'Approved — Awaiting Batch Publish' },
  published: { cls: 'badge-purple', text: 'Published to Students' },
};

function StatusBanner({ submission }) {
  if (!submission) return null;
  const s = STATUS_LABELS[submission.status] || { cls: 'badge-gray', text: submission.status };
  const isReturned = submission.status === 'returned';
  const isApproved = submission.status === 'approved';
  const isPublished = submission.status === 'published';
  return (
    <div
      style={{
        padding: '0.875rem 1.25rem',
        borderRadius: 'var(--radius-md)',
        marginBottom: '1.25rem',
        background: isReturned
          ? 'rgba(183,0,50,0.06)'
          : isPublished
            ? 'rgba(5,150,105,0.08)'
            : isApproved
              ? 'rgba(5,150,105,0.06)'
              : 'rgba(17,47,66,0.05)',
        border: `1px solid ${
          isReturned
            ? 'rgba(183,0,50,0.25)'
            : isPublished || isApproved
              ? 'rgba(5,150,105,0.3)'
              : 'var(--color-border)'
        }`,
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.75rem',
      }}
    >
      {isReturned ? (
        <MdWarning color="var(--color-secondary)" size={20} />
      ) : isPublished || isApproved ? (
        <MdCheckCircle color="#059669" size={20} />
      ) : (
        <MdInfo color="var(--color-primary)" size={20} />
      )}
      <div>
        <div style={{ fontWeight: 700, fontSize: '0.875rem', marginBottom: 4 }}>
          <span className={`badge ${s.cls}`}>{s.text}</span>
        </div>
        {isReturned && submission.admin_comment && (
          <div style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
            Administrator note: "{submission.admin_comment}"
          </div>
        )}
        {isApproved && (
          <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
            Your marksheet is approved. Results will appear for students once the administrator
            publishes the full batch (all courses must be approved first).
          </div>
        )}
        {isPublished && submission.published_at && (
          <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
            Published: {new Date(submission.published_at).toLocaleString('en-GB')}
          </div>
        )}
        {submission.submitted_at && !isPublished && (
          <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
            Submitted: {new Date(submission.submitted_at).toLocaleString('en-GB')}
          </div>
        )}
      </div>
    </div>
  );
}

function ScoreInput({ value, onChange, max, disabled }) {
  const num = Number(value);
  const isOver = num > max;
  const isNeg = num < 0;
  const invalid = isOver || isNeg;
  return (
    <div style={{ position: 'relative' }}>
      <input
        type="number"
        min={0}
        max={max}
        step={0.5}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        style={{
          width: 72,
          padding: '0.375rem 0.5rem',
          border: `1px solid ${invalid ? 'var(--color-secondary)' : 'var(--color-border)'}`,
          borderRadius: 'var(--radius-sm)',
          fontSize: '0.875rem',
          background: disabled ? 'var(--color-bg)' : 'var(--color-surface)',
          color: 'var(--color-text)',
          outline: 'none',
          textAlign: 'center',
        }}
        aria-label={`Score out of ${max}`}
      />
      {invalid && (
        <div style={{ fontSize: '0.65rem', color: 'var(--color-secondary)', position: 'absolute', top: '100%', left: 0, whiteSpace: 'nowrap' }}>
          {isNeg ? 'Min 0' : `Max ${max}`}
        </div>
      )}
    </div>
  );
}

export default function LecturerMarksPage() {
  const { session } = useAuth();
  const [searchParams] = useSearchParams();
  const initialBc = searchParams.get('bc') || '';
  const qc = useQueryClient();
  const { showToast } = useToast();

  const [selectedBcId, setSelectedBcId] = useState(initialBc);
  const [localScores, setLocalScores] = useState({});
  const [submitModal, setSubmitModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const { data: lecturerProfile } = useQuery({
    queryKey: ['my-lecturer-profile'],
    queryFn: getMyLecturerProfile,
    enabled: !!session,
  });
  const lecturerId = lecturerProfile?.id;

  const { data: settings } = useQuery({
    queryKey: ['system-settings'],
    queryFn: getSystemSettings,
  });
  const ATT_MAX = settings?.attendance_max ?? 5;
  const CW_MAX = settings?.coursework_max ?? 25;
  const EXAM_MAX = settings?.exam_max ?? 70;

  const { data: courses = [] } = useQuery({
    queryKey: ['my-courses', lecturerId],
    queryFn: () => getMyCourses(lecturerId),
    enabled: !!lecturerId,
  });

  const selectedCourse = courses.find((c) => c.id === selectedBcId);

  const {
    data: submission,
    isLoading: subLoading,
    refetch: refetchSub,
  } = useQuery({
    queryKey: ['mark-submission', selectedBcId, lecturerId],
    queryFn: () => getOrCreateMarkSubmission(selectedBcId, lecturerId),
    enabled: !!selectedBcId && !!lecturerId,
  });

  const { data: students = [], isLoading: stuLoading } = useQuery({
    queryKey: ['students-in-batch', selectedCourse?.batches?.id],
    queryFn: () => getStudentsInBatch(selectedCourse.batches.id),
    enabled: !!selectedCourse?.batches?.id,
  });

  const { data: existingMarks = [], isLoading: marksLoading, refetch: refetchMarks } = useQuery({
    queryKey: ['marks-for-submission', submission?.id],
    queryFn: () => getMarksForSubmission(submission.id),
    enabled: !!submission?.id,
  });

  const existingMarksMap = useMemo(() => {
    const map = new Map();
    existingMarks.forEach((m) => map.set(m.student_id, m));
    return map;
  }, [existingMarks]);

  const getStudentScores = useCallback((studentId) => {
    if (localScores[studentId]) return localScores[studentId];
    const dbMark = existingMarksMap.get(studentId);
    if (dbMark) {
      return {
        attendance_score: dbMark.attendance_score ?? 0,
        coursework_score: dbMark.coursework_score ?? 0,
        exam_score: dbMark.exam_score ?? 0,
        lecturer_comment: dbMark.lecturer_comment || '',
      };
    }
    return {
      attendance_score: 0,
      coursework_score: 0,
      exam_score: 0,
      lecturer_comment: '',
    };
  }, [localScores, existingMarksMap]);

  const canEdit = submission && (submission.status === 'draft' || submission.status === 'returned');

  const saveOneMark = useCallback(async (studentId) => {
    if (!submission?.id || !canEdit) return;
    const scores = getStudentScores(studentId);
    setSaving(true);
    try {
      await upsertMark({
        mark_submission_id: submission.id,
        student_id: studentId,
        attendance_score: Number(scores.attendance_score) || 0,
        coursework_score: Number(scores.coursework_score) || 0,
        exam_score: Number(scores.exam_score) || 0,
        lecturer_comment: scores.lecturer_comment || null,
      });
      showToast('Mark saved', 'success');
      refetchMarks();
    } catch (err) {
      showToast(err.message || 'Failed to save mark', 'error');
    } finally {
      setSaving(false);
    }
  }, [submission, canEdit, getStudentScores, showToast, refetchMarks]);

  const saveAllMarks = async ({ silent = false } = {}) => {
    if (!submission?.id || !canEdit || students.length === 0) return false;
    setSaving(true);
    try {
      for (const stu of students) {
        const scores = getStudentScores(stu.id);
        const att = Number(scores.attendance_score) || 0;
        const cw = Number(scores.coursework_score) || 0;
        const ex = Number(scores.exam_score) || 0;
        if (att < 0 || att > ATT_MAX || cw < 0 || cw > CW_MAX || ex < 0 || ex > EXAM_MAX) {
          showToast(
            `Invalid scores detected for ${stu.first_name} ${stu.last_name}. Limits: Att ≤ ${ATT_MAX}, CW ≤ ${CW_MAX}, Exam ≤ ${EXAM_MAX}`,
            'error'
          );
          return false;
        }
      }

      for (const stu of students) {
        const scores = getStudentScores(stu.id);
        await upsertMark({
          mark_submission_id: submission.id,
          student_id: stu.id,
          attendance_score: Number(scores.attendance_score) || 0,
          coursework_score: Number(scores.coursework_score) || 0,
          exam_score: Number(scores.exam_score) || 0,
          lecturer_comment: scores.lecturer_comment || null,
        });
      }
      if (!silent) showToast('All marks saved successfully', 'success');
      refetchMarks();
      return true;
    } catch (err) {
      showToast(err.message || 'Failed to save marks', 'error');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const submitMutation = useMutation({
    mutationFn: async () => {
      const saved = await saveAllMarks({ silent: true });
      if (!saved) {
        throw new Error('Please correct invalid scores and save before submitting.');
      }
      if (submission.status === 'returned') {
        return resubmitMarkSubmission(submission.id);
      }
      return submitMarkSubmission(submission.id);
    },
    onSuccess: () => {
      showToast('Marks submitted for review. Admin will approve, then publish the batch.', 'success');
      setSubmitModal(false);
      refetchSub();
      qc.invalidateQueries(['my-mark-submissions']);
    },
    onError: (err) => {
      showToast(err.message || 'Submission failed', 'error');
    },
  });

  const updateScore = (studentId, field, val) => {
    setLocalScores((prev) => ({
      ...prev,
      [studentId]: {
        ...getStudentScores(studentId),
        ...(prev[studentId] || {}),
        [field]: val,
      },
    }));
  };

  const getTotal = (studentId) => {
    const s = getStudentScores(studentId);
    return (
      (Number(s.attendance_score) || 0) +
      (Number(s.coursework_score) || 0) +
      (Number(s.exam_score) || 0)
    );
  };

  const getGrade = (total) => {
    const { grade, grade_point } = computeGrade(total);
    return { grade, gp: grade_point, cls: gradeBadgeClass(grade) };
  };

  const hasErrors = students.some((stu) => {
    const s = getStudentScores(stu.id);
    return (
      Number(s.attendance_score) > ATT_MAX ||
      Number(s.coursework_score) > CW_MAX ||
      Number(s.exam_score) > EXAM_MAX ||
      Number(s.attendance_score) < 0 ||
      Number(s.coursework_score) < 0 ||
      Number(s.exam_score) < 0
    );
  });

  const loading = subLoading || stuLoading || marksLoading;
  const submitLabel =
    submission?.status === 'returned' ? 'Resubmit for Review' : 'Submit for Review';

  return (
    <AppLayout pageTitle="Mark Entry">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Mark Entry</h1>
          <p className="page-subtitle">
            Enter marks, submit for review, then administration publishes the full batch to students
          </p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '1.25rem', padding: '1.25rem' }}>
        <label className="form-label" htmlFor="bc-select">Select Course</label>
        <select
          id="bc-select"
          className="form-input"
          style={{ maxWidth: 400 }}
          value={selectedBcId}
          onChange={(e) => {
            setSelectedBcId(e.target.value);
            setLocalScores({});
          }}
        >
          <option value="">— Select a course —</option>
          {courses.map((bc) => (
            <option key={bc.id} value={bc.id}>
              {bc.courses?.code} — {bc.courses?.name} ({bc.batches?.name}, Sem {bc.semesters?.number})
            </option>
          ))}
        </select>
      </div>

      {!selectedBcId && (
        <div className="empty-state">
          <div className="empty-state-icon"><MdGrade /></div>
          <div className="empty-state-title">Select a course above</div>
          <p className="empty-state-text">Choose one of your assigned courses to enter marks.</p>
        </div>
      )}

      {selectedBcId && (
        <>
          {!loading && <StatusBanner submission={submission} />}

          <div
            style={{
              display: 'flex',
              gap: '1rem',
              marginBottom: '1rem',
              flexWrap: 'wrap',
              fontSize: '0.8125rem',
              color: 'var(--color-text-muted)',
              padding: '0.75rem 1rem',
              background: 'var(--color-surface)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
            }}
          >
            <span><strong>Attendance:</strong> / {ATT_MAX}</span>
            <span><strong>Coursework:</strong> / {CW_MAX}</span>
            <span><strong>Exam:</strong> / {EXAM_MAX}</span>
            <span><strong>Total:</strong> / 100</span>
          </div>

          {canEdit && (
            <div
              style={{
                display: 'flex',
                gap: '0.75rem',
                marginBottom: '1rem',
                justifyContent: 'flex-end',
                flexWrap: 'wrap',
                alignItems: 'center',
              }}
            >
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => saveAllMarks()}
                disabled={saving || hasErrors}
              >
                <MdSave /> {saving ? 'Saving…' : 'Save All'}
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setSubmitModal(true)}
                disabled={saving || hasErrors || students.length === 0}
                style={{ minWidth: '200px' }}
              >
                <MdPublish /> {submitLabel}
              </button>
            </div>
          )}

          {!canEdit && submission?.status === 'submitted' && (
            <div
              style={{
                marginBottom: '1rem',
                padding: '0.75rem 1rem',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(17,47,66,0.05)',
                border: '1px solid var(--color-border)',
                fontSize: '0.875rem',
                color: 'var(--color-text-muted)',
              }}
            >
              <MdPublish style={{ verticalAlign: 'middle', marginRight: 6 }} />
              Marks are locked while under review. You can edit again only if the administrator returns them.
            </div>
          )}

          {hasErrors && (
            <div className="auth-alert error" style={{ marginBottom: '1rem' }}>
              <MdWarning />
              Some scores exceed the maximum or are negative. Please correct them before saving or submitting.
            </div>
          )}

          {loading ? (
            <div className="card">
              <div style={{ padding: '1.5rem' }}>
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} style={{ marginBottom: 12 }}>
                    <div className="skeleton skeleton-text" style={{ width: '60%', marginBottom: 6 }} />
                    <div className="skeleton skeleton-text" style={{ width: '40%' }} />
                  </div>
                ))}
              </div>
            </div>
          ) : students.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon"><MdGrade /></div>
              <div className="empty-state-title">No students in this batch</div>
            </div>
          ) : (
            <div className="card">
              <div className="table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Matricule</th>
                      <th>Student Name</th>
                      <th>Attendance /{ATT_MAX}</th>
                      <th>Coursework /{CW_MAX}</th>
                      <th>Exam /{EXAM_MAX}</th>
                      <th>Total /100</th>
                      <th>Grade</th>
                      {canEdit && <th>Action</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((stu) => {
                      const total = getTotal(stu.id);
                      const { grade, gp, cls } = getGrade(total);
                      const scores = getStudentScores(stu.id);
                      return (
                        <tr key={stu.id}>
                          <td>
                            <span className="badge badge-blue">{stu.matricule}</span>
                          </td>
                          <td>
                            <div style={{ fontWeight: 600 }}>
                              {stu.first_name}{' '}
                              {stu.middle_name ? `${stu.middle_name.charAt(0)}. ` : ''}
                              {stu.last_name}
                            </div>
                          </td>
                          <td>
                            <ScoreInput
                              value={scores.attendance_score ?? 0}
                              onChange={(v) => updateScore(stu.id, 'attendance_score', v)}
                              max={ATT_MAX}
                              disabled={!canEdit}
                            />
                          </td>
                          <td>
                            <ScoreInput
                              value={scores.coursework_score ?? 0}
                              onChange={(v) => updateScore(stu.id, 'coursework_score', v)}
                              max={CW_MAX}
                              disabled={!canEdit}
                            />
                          </td>
                          <td>
                            <ScoreInput
                              value={scores.exam_score ?? 0}
                              onChange={(v) => updateScore(stu.id, 'exam_score', v)}
                              max={EXAM_MAX}
                              disabled={!canEdit}
                            />
                          </td>
                          <td>
                            <strong>{total.toFixed(1)}</strong>
                          </td>
                          <td>
                            <span className={`badge ${cls}`}>{grade} ({gp.toFixed(1)})</span>
                          </td>
                          {canEdit && (
                            <td>
                              <button
                                type="button"
                                className="btn btn-outline btn-sm"
                                onClick={() => saveOneMark(stu.id)}
                                disabled={saving}
                              >
                                <MdSave />
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <Modal
            isOpen={submitModal}
            onClose={() => setSubmitModal(false)}
            title={submitLabel}
            footer={
              <>
                <button type="button" className="btn btn-outline" onClick={() => setSubmitModal(false)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => submitMutation.mutate()}
                  disabled={submitMutation.isPending}
                >
                  {submitMutation.isPending ? 'Submitting…' : submitLabel}
                </button>
              </>
            }
          >
            <p>
              Submit this marksheet for administrator review? You will not be able to edit scores
              until the administrator returns them or publishes the batch.
            </p>
          </Modal>
        </>
      )}
    </AppLayout>
  );
}
