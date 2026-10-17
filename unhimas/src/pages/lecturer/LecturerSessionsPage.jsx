import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import {
  MdHowToReg,
  MdAdd,
  MdCheckCircle,
  MdSchedule,
  MdPeopleAlt,
  MdSend,
  MdFactCheck,
} from 'react-icons/md';
import AppLayout from '../../components/layout/AppLayout';
import { useAuth } from '../../context/AuthContext';
import Modal from '../../components/common/Modal';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import { useToast } from '../../hooks/useToast';
import {
  getMyLecturerProfile,
  getMyCourses,
  getSessionsForBatchCourse,
  createClassSession,
  getAttendanceForSession,
  getStudentsInBatch,
  upsertAttendance,
  markAllPresent,
  submitSessionAttendance,
} from '../../services/lecturerService';

const STATUS_OPTS = ['present', 'absent', 'late', 'excused'];

const STATUS_STYLE = {
  present: { cls: 'badge-green', label: 'Present' },
  absent: { cls: 'badge-red', label: 'Absent' },
  late: { cls: 'badge-amber', label: 'Late' },
  excused: { cls: 'badge-gray', label: 'Excused' },
};

function fmtDT(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export default function LecturerSessionsPage() {
  const { session, profile } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const initialBc = searchParams.get('bc') || '';
  const initialSession = searchParams.get('session') || null;
  const { showToast } = useToast();

  const [selectedBcId, setSelectedBcId] = useState(initialBc);
  const [selectedSessionId, setSelectedSessionId] = useState(initialSession);
  const [newSessionModal, setNewSessionModal] = useState(false);
  const [submitModalOpen, setSubmitModalOpen] = useState(false);
  const [newSessionForm, setNewSessionForm] = useState({
    scheduled_start: '', scheduled_end: '', room: '', topic: '', notes: '',
  });

  const { data: lecturerProfile } = useQuery({
    queryKey: ['my-lecturer-profile'],
    queryFn: getMyLecturerProfile,
    enabled: !!session,
  });
  const lecturerId = lecturerProfile?.id;

  const { data: courses = [], isLoading: coursesLoading, error: coursesError } = useQuery({
    queryKey: ['my-courses', lecturerId],
    queryFn: () => getMyCourses(lecturerId),
    enabled: !!lecturerId,
  });

  const selectedCourse = courses.find((c) => c.id === selectedBcId);

  const { data: sessions = [], isLoading: sessLoading, error: sessionsError, refetch: refetchSessions } = useQuery({
    queryKey: ['sessions-for-bc', selectedBcId, lecturerId],
    queryFn: () => getSessionsForBatchCourse(selectedBcId, lecturerId),
    enabled: !!selectedBcId && !!lecturerId,
  });

  const selectedSession = sessions.find((s) => s.id === selectedSessionId);
  const activeSessionId = selectedCourse && selectedSession ? selectedSession.id : null;

  const { data: students = [], isLoading: studentsLoading, error: studentsError } = useQuery({
    queryKey: ['students-in-batch', selectedCourse?.batches?.id],
    queryFn: () => getStudentsInBatch(selectedCourse.batches.id),
    enabled: !!selectedCourse?.batches?.id,
  });

  const attendanceQueryKey = ['attendance-session', activeSessionId];
  const { data: attendanceRecords = [], isLoading: attLoading, error: attendanceError } = useQuery({
    queryKey: attendanceQueryKey,
    queryFn: () => getAttendanceForSession(activeSessionId),
    enabled: !!activeSessionId,
  });

  const attendanceByStudent = new Map(attendanceRecords.map((record) => [record.student_id, record]));

  const saveAttendanceMutation = useMutation({
    mutationFn: upsertAttendance,
    onMutate: async (nextRecord) => {
      await queryClient.cancelQueries({ queryKey: attendanceQueryKey });
      const previousRecords = queryClient.getQueryData(attendanceQueryKey);
      queryClient.setQueryData(attendanceQueryKey, (current = []) => {
        const updated = {
          ...(current.find((record) => record.student_id === nextRecord.student_id) || {}),
          ...nextRecord,
          marked_at: new Date().toISOString(),
        };
        const exists = current.some((record) => record.student_id === nextRecord.student_id);
        return exists
          ? current.map((record) => record.student_id === nextRecord.student_id ? updated : record)
          : [...current, updated];
      });
      return { previousRecords };
    },
    onError: (error, _nextRecord, context) => {
      if (context?.previousRecords) queryClient.setQueryData(attendanceQueryKey, context.previousRecords);
      showToast(error.message || 'Attendance could not be saved.', 'error');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: attendanceQueryKey });
      queryClient.invalidateQueries({ queryKey: ['my-attendance-summary'] });
      queryClient.invalidateQueries({ queryKey: ['student-dashboard-stats'] });
    },
  });

  const markAllMutation = useMutation({
    mutationFn: () => markAllPresent(activeSessionId, students.map((student) => student.id), profile?.id),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: attendanceQueryKey });
      const previousRecords = queryClient.getQueryData(attendanceQueryKey);
      queryClient.setQueryData(attendanceQueryKey, (current = []) => {
        const now = new Date().toISOString();
        const byStudent = new Map(current.map((record) => [record.student_id, record]));
        students.forEach((student) => {
          byStudent.set(student.id, {
            ...(byStudent.get(student.id) || {}),
            session_id: activeSessionId,
            student_id: student.id,
            status: 'present',
            marked_at: now,
            marked_by: profile?.id || null,
          });
        });
        return Array.from(byStudent.values());
      });
      return { previousRecords };
    },
    onSuccess: () => showToast('All students marked present.', 'success'),
    onError: (error, _variables, context) => {
      if (context?.previousRecords) queryClient.setQueryData(attendanceQueryKey, context.previousRecords);
      showToast(error.message || 'Attendance could not be saved.', 'error');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: attendanceQueryKey });
      queryClient.invalidateQueries({ queryKey: ['my-attendance-summary'] });
      queryClient.invalidateQueries({ queryKey: ['student-dashboard-stats'] });
    },
  });

  const createSessionMutation = useMutation({
    mutationFn: () => createClassSession({
      batch_course_id: selectedBcId,
      lecturer_id: lecturerId,
      ...newSessionForm,
    }),
    onSuccess: () => {
      showToast('Session created', 'success');
      setNewSessionModal(false);
      setNewSessionForm({ scheduled_start: '', scheduled_end: '', room: '', topic: '', notes: '' });
      refetchSessions();
    },
    onError: (err) => showToast(err.message || 'Failed to create session', 'error'),
  });

  const submitAttendanceMutation = useMutation({
    mutationFn: () => {
      const unmarked = students
        .filter((s) => !attendanceByStudent.get(s.id)?.marked_at)
        .map((s) => s.id);
      return submitSessionAttendance({
        sessionId: activeSessionId,
        unmarkedStudentIds: unmarked,
        profileId: profile?.id,
      });
    },
    onSuccess: () => {
      showToast('Session attendance submitted successfully.', 'success');
      setSubmitModalOpen(false);
      refetchSessions();
      queryClient.invalidateQueries({ queryKey: attendanceQueryKey });
      queryClient.invalidateQueries({ queryKey: ['my-attendance-summary'] });
      queryClient.invalidateQueries({ queryKey: ['student-dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['admin-class-sessions'] });
    },
    onError: (err) => {
      showToast(err.message || 'Failed to submit attendance', 'error');
    },
  });

  const markAllPresentFn = () => {
    if (!activeSessionId || students.length === 0) return;
    markAllMutation.mutate();
  };

  const saveAttendance = (studentId, status) => {
    if (!activeSessionId) return;
    saveAttendanceMutation.mutate({ session_id: activeSessionId, student_id: studentId, status, marked_by: profile?.id });
  };

  // Summary
  const totalStu = students.length;
  const present = attendanceRecords.filter((record) => record.status === 'present' && record.marked_at).length;
  const absent = attendanceRecords.filter((record) => record.status === 'absent' && record.marked_at).length;
  const late = attendanceRecords.filter((record) => record.status === 'late' && record.marked_at).length;
  const excused = attendanceRecords.filter((record) => record.status === 'excused' && record.marked_at).length;
  const unrecorded = students.filter((student) => !attendanceByStudent.get(student.id)?.marked_at).length;
  const pct = totalStu > 0 ? Math.round(((present + late) / totalStu) * 100) : 0;

  return (
    <AppLayout pageTitle="Class Sessions">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Class Sessions &amp; Attendance</h1>
          <p className="page-subtitle">Manage sessions and mark student attendance</p>
        </div>
      </div>

      {/* Course selector */}
      {coursesError && (
        <div className="auth-alert error" role="alert" style={{ marginBottom: '1rem' }}>
          Assigned courses could not be loaded. Check your connection or account permissions.
        </div>
      )}
      <div className="card" style={{ marginBottom: '1.25rem', padding: '1.25rem' }}>
        <label className="form-label" htmlFor="sess-bc-select">Select Course</label>
        <select
          id="sess-bc-select"
          className="form-input"
          style={{ maxWidth: 420 }}
          value={selectedBcId}
          onChange={(e) => { setSelectedBcId(e.target.value); setSelectedSessionId(null); }}
          disabled={coursesLoading}
        >
          <option value="">{coursesLoading ? 'Loading assigned courses…' : '— Select a course —'}</option>
          {courses.map((bc) => (
            <option key={bc.id} value={bc.id}>
              {bc.courses?.code} — {bc.courses?.name} ({bc.batches?.name}, Sem {bc.semesters?.number})
            </option>
          ))}
        </select>
      </div>

      {selectedBcId && (
        <div className="lecturer-attendance-layout">
          {/* Sessions list */}
          <div className="card" style={{ alignSelf: 'start' }}>
            <div className="card-header">
              <span className="card-title">Sessions</span>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => setNewSessionModal(true)}
                disabled={!selectedCourse || !lecturerId || !!sessionsError}
              >
                <MdAdd /> New
              </button>
            </div>
            <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
              {sessLoading ? (
                <div style={{ padding: '1rem' }}>
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="skeleton skeleton-text" style={{ marginBottom: 10, height: 48 }} />
                  ))}
                </div>
              ) : sessionsError ? (
                <div className="empty-state" role="alert" style={{ padding: '1.5rem' }}>
                  <div className="empty-state-title">Sessions unavailable</div>
                  <p className="empty-state-text">Sessions could not be loaded for this assigned course.</p>
                </div>
              ) : sessions.length === 0 ? (
                <div className="empty-state" style={{ padding: '1.5rem' }}>
                  <div className="empty-state-title" style={{ fontSize: '0.875rem' }}>No sessions yet</div>
                  <p className="empty-state-text">Create a session to start marking attendance.</p>
                </div>
              ) : (
                sessions.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setSelectedSessionId(s.id)}
                    style={{
                      display: 'block',
                      width: '100%',
                      textAlign: 'left',
                      padding: '0.75rem 1rem',
                      borderBottom: '1px solid var(--color-border)',
                      background: s.id === selectedSessionId ? 'rgba(17,47,66,0.06)' : 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      borderLeft: s.id === selectedSessionId ? '3px solid var(--color-primary)' : '3px solid transparent',
                      transition: 'background 0.1s',
                    }}
                  >
                    <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text)' }}>
                      {new Date(s.scheduled_start).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                      {new Date(s.scheduled_start).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                      {' – '}
                      {new Date(s.scheduled_end).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    {s.topic && <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.topic}</div>}
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Attendance panel */}
          <div>
            {!activeSessionId ? (
              <div className="card">
                <div className="empty-state" style={{ padding: '3rem' }}>
                  <div className="empty-state-icon"><MdHowToReg /></div>
                  <div className="empty-state-title">Select a session</div>
                  <p className="empty-state-text">Select a session from the left to mark attendance.</p>
                </div>
              </div>
            ) : (
              <>
                {/* Summary row */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(95px, 1fr))',
                    gap: '0.75rem',
                    marginBottom: '1rem',
                  }}
                >
                  {[
                    { label: 'Total', value: totalStu, color: 'var(--color-primary)' },
                    { label: 'Present', value: present, color: '#059669' },
                    { label: 'Absent', value: absent, color: 'var(--color-secondary)' },
                    { label: 'Late', value: late, color: '#b45309' },
                    { label: 'Excused', value: excused, color: 'var(--color-text-muted)' },
                    { label: 'Not marked', value: unrecorded, color: 'var(--color-text-muted)' },
                    { label: 'Attendance', value: `${pct}%`, color: pct >= 75 ? '#059669' : '#b45309' },
                  ].map((item) => (
                    <div
                      key={item.label}
                      style={{
                        background: 'var(--color-surface)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-md)',
                        padding: '0.875rem 1rem',
                        textAlign: 'center',
                      }}
                    >
                      <div style={{ fontSize: '1.5rem', fontWeight: 800, color: item.color }}>{item.value}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2 }}>{item.label}</div>
                    </div>
                  ))}
                </div>

                <div className="card">
                  <div className="card-header" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                      <span className="card-title" style={{ margin: 0 }}>
                        <MdPeopleAlt style={{ verticalAlign: 'middle', marginRight: 6 }} />
                        {selectedSession && fmtDT(selectedSession.scheduled_start)}
                      </span>
                      {selectedSession?.actual_end ? (
                        <span className="badge badge-green" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <MdCheckCircle /> Attendance Finalized
                        </span>
                      ) : (
                        <span className="badge badge-amber">
                          Draft / Unsubmitted
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <button
                        className="btn btn-outline btn-sm"
                        onClick={markAllPresentFn}
                        disabled={markAllMutation.isPending || students.length === 0 || studentsLoading || attLoading}
                      >
                        <MdCheckCircle /> {markAllMutation.isPending ? 'Marking…' : 'Mark All Present'}
                      </button>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => setSubmitModalOpen(true)}
                        disabled={submitAttendanceMutation.isPending || students.length === 0 || studentsLoading || attLoading}
                      >
                        <MdSend /> {selectedSession?.actual_end ? 'Resubmit Attendance' : 'Submit Attendance'}
                      </button>
                    </div>
                  </div>
                  <div className="table-wrapper">
                    {attLoading ? (
                      <div style={{ padding: '1rem' }}>
                        {[1, 2, 3].map((i) => (
                          <div key={i} className="skeleton skeleton-text" style={{ marginBottom: 10 }} />
                        ))}
                      </div>
                    ) : attendanceError ? (
                      <div className="empty-state" role="alert">
                        <div className="empty-state-title">Attendance unavailable</div>
                        <p className="empty-state-text">Attendance records could not be loaded. No default statuses are assumed.</p>
                      </div>
                    ) : studentsError ? (
                      <div className="empty-state" role="alert">
                        <div className="empty-state-title">Student list unavailable</div>
                        <p className="empty-state-text">Students in this batch could not be loaded.</p>
                      </div>
                    ) : studentsLoading ? (
                      <div style={{ padding: '1rem' }}>
                        {[1, 2, 3].map((i) => <div key={i} className="skeleton skeleton-text" style={{ marginBottom: 10 }} />)}
                      </div>
                    ) : students.length === 0 ? (
                      <div className="empty-state"><div className="empty-state-title">No students in batch</div></div>
                    ) : (
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Matricule</th>
                            <th>Name</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {students.map((stu) => {
                            const attendanceRecord = attendanceByStudent.get(stu.id);
                            const status = attendanceRecord?.marked_at ? attendanceRecord.status : null;
                            const isSaving = saveAttendanceMutation.isPending
                              && saveAttendanceMutation.variables?.student_id === stu.id;
                            return (
                              <tr key={stu.id}>
                                <td><span className="badge badge-blue">{stu.matricule}</span></td>
                                <td style={{ fontWeight: 600 }}>{stu.first_name} {stu.last_name}</td>
                                <td>
                                  <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
                                    {STATUS_OPTS.map((opt) => (
                                      <button
                                        key={opt}
                                        className={`btn btn-sm ${status === opt ? (opt === 'present' ? 'btn-primary' : opt === 'absent' ? 'btn-danger' : 'btn-outline') : 'btn-outline'}`}
                                        style={{
                                          padding: '0.25rem 0.625rem',
                                          fontSize: '0.75rem',
                                          opacity: status === opt ? 1 : 0.75,
                                        }}
                                        onClick={() => saveAttendance(stu.id, opt)}
                                        disabled={saveAttendanceMutation.isPending}
                                        aria-pressed={status === opt}
                                      >
                                        {STATUS_STYLE[opt].label}
                                      </button>
                                    ))}
                                    {isSaving && <span className="form-hint" role="status">Saving…</span>}
                                    {!attendanceRecord && <span className="form-hint">Not marked</span>}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {!selectedBcId && (
        <div className="empty-state">
          <div className="empty-state-icon"><MdSchedule /></div>
          <div className="empty-state-title">Select a course to manage sessions</div>
        </div>
      )}

      {/* New Session Modal */}
      {newSessionModal && (
        <Modal isOpen={newSessionModal} title="Create Class Session" onClose={() => setNewSessionModal(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Start Time *</label>
              <input
                type="datetime-local"
                className="form-input"
                required
                value={newSessionForm.scheduled_start}
                onChange={(e) => setNewSessionForm((f) => ({ ...f, scheduled_start: e.target.value }))}
              />
            </div>
            <div className="form-group">
              <label className="form-label">End Time *</label>
              <input
                type="datetime-local"
                className="form-input"
                required
                value={newSessionForm.scheduled_end}
                onChange={(e) => setNewSessionForm((f) => ({ ...f, scheduled_end: e.target.value }))}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Room</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Room 101"
                value={newSessionForm.room}
                onChange={(e) => setNewSessionForm((f) => ({ ...f, room: e.target.value }))}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Topic</label>
              <input
                type="text"
                className="form-input"
                placeholder="Session topic (optional)"
                value={newSessionForm.topic}
                onChange={(e) => setNewSessionForm((f) => ({ ...f, topic: e.target.value }))}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Notes</label>
              <textarea
                className="form-input"
                rows={2}
                value={newSessionForm.notes}
                onChange={(e) => setNewSessionForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
            <div className="modal-footer" style={{ padding: 0 }}>
              <button className="btn btn-outline" onClick={() => setNewSessionModal(false)}>Cancel</button>
              {newSessionForm.scheduled_start && newSessionForm.scheduled_end
                && new Date(newSessionForm.scheduled_end) <= new Date(newSessionForm.scheduled_start) && (
                  <span className="form-error" role="alert">End time must be later than start time.</span>
                )}
              <button
                className="btn btn-primary"
                onClick={() => createSessionMutation.mutate()}
                disabled={
                  createSessionMutation.isPending
                  || !newSessionForm.scheduled_start
                  || !newSessionForm.scheduled_end
                  || new Date(newSessionForm.scheduled_end) <= new Date(newSessionForm.scheduled_start)
                }
              >
                <MdAdd /> {createSessionMutation.isPending ? 'Creating…' : 'Create Session'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Submit Attendance Confirmation Dialog */}
      <ConfirmDialog
        isOpen={submitModalOpen}
        onClose={() => setSubmitModalOpen(false)}
        onConfirm={() => submitAttendanceMutation.mutate()}
        title={selectedSession?.actual_end ? 'Resubmit Session Attendance' : 'Submit Session Attendance'}
        confirmLabel={selectedSession?.actual_end ? 'Confirm & Resubmit' : 'Confirm & Submit Attendance'}
        variant="success"
        icon={<MdFactCheck />}
        isLoading={submitAttendanceMutation.isPending}
        maxWidth="500px"
      >
        <div style={{ marginTop: '0.75rem' }}>
          <div
            style={{
              padding: '0.75rem 1rem',
              background: 'rgba(17, 47, 66, 0.04)',
              borderRadius: 'var(--radius-sm)',
              marginBottom: '1rem',
              fontSize: '0.8125rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.25rem',
            }}
          >
            <div><strong>Course:</strong> {selectedCourse?.courses?.code} — {selectedCourse?.courses?.name}</div>
            <div><strong>Batch:</strong> {selectedCourse?.batches?.name}</div>
            <div><strong>Scheduled:</strong> {selectedSession && fmtDT(selectedSession.scheduled_start)}</div>
            {selectedSession?.room && <div><strong>Room:</strong> {selectedSession.room}</div>}
            {selectedSession?.topic && <div><strong>Topic:</strong> {selectedSession.topic}</div>}
          </div>

          <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.5rem' }}>
            Attendance Register Summary:
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '0.5rem',
              marginBottom: '1rem',
              textAlign: 'center',
            }}
          >
            <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', padding: '0.5rem' }}>
              <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-primary)' }}>{totalStu}</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>Enrolled</div>
            </div>
            <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', padding: '0.5rem' }}>
              <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#059669' }}>{present}</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>Present</div>
            </div>
            <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', padding: '0.5rem' }}>
              <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#b45309' }}>{late}</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>Late</div>
            </div>
            <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', padding: '0.5rem' }}>
              <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-secondary)' }}>{absent}</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>Absent</div>
            </div>
            <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', padding: '0.5rem' }}>
              <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-text-muted)' }}>{excused}</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>Excused</div>
            </div>
            <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', padding: '0.5rem' }}>
              <div style={{ fontSize: '1.2rem', fontWeight: 800, color: unrecorded > 0 ? '#b45309' : '#059669' }}>{unrecorded}</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>Not Marked</div>
            </div>
          </div>

          {unrecorded > 0 && (
            <div
              style={{
                padding: '0.6rem 0.75rem',
                background: 'rgba(245, 158, 11, 0.1)',
                borderLeft: '3px solid #d97706',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.78rem',
                color: '#b45309',
                marginBottom: '0.75rem',
                fontWeight: 600,
              }}
            >
              Note: {unrecorded} unmarked student(s) will automatically be recorded as Absent upon submission.
            </div>
          )}

          <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', lineHeight: 1.5, margin: 0 }}>
            Submitting this attendance will finalize the attendance register for this session, calculate session hours, and immediately update student attendance analytics.
          </p>
        </div>
      </ConfirmDialog>
    </AppLayout>
  );
}
