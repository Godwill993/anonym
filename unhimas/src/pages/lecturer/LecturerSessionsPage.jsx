import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import {
  MdHowToReg,
  MdAdd,
  MdCheckCircle,
  MdSchedule,
  MdPeopleAlt,
  MdEdit,
  MdDelete,
} from 'react-icons/md';
import AppLayout from '../../components/layout/AppLayout';
import { useAuth } from '../../context/AuthContext';
import Modal from '../../components/common/Modal';
import { useToast } from '../../hooks/useToast';
import {
  getMyLecturerProfile,
  getMyCourses,
  getSessionsForBatchCourse,
  createClassSession,
  updateClassSession,
  deleteClassSession,
  getAttendanceForSession,
  getStudentsInBatch,
  upsertAttendance,
  markAllPresent,
} from '../../services/lecturerService';

const STATUS_OPTS = ['present', 'absent', 'late', 'excused'];

const STATUS_STYLE = {
  present: { cls: 'badge-green', label: 'Present' },
  absent: { cls: 'badge-red', label: 'Absent' },
  late: { cls: 'badge-amber', label: 'Late' },
  excused: { cls: 'badge-gray', label: 'Excused' },
};

function toLocalInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fmtDT(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

const emptySessionForm = {
  scheduled_start: '',
  scheduled_end: '',
  room: '',
  topic: '',
  notes: '',
};

export default function LecturerSessionsPage() {
  const { session, profile } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const initialBc = searchParams.get('bc') || '';
  const initialSession = searchParams.get('session') || null;
  const { showToast } = useToast();

  const [selectedBcId, setSelectedBcId] = useState(initialBc);
  const [selectedSessionId, setSelectedSessionId] = useState(initialSession);
  const [sessionModal, setSessionModal] = useState(false);
  const [editingSession, setEditingSession] = useState(null);
  const [sessionForm, setSessionForm] = useState(emptySessionForm);
  const [sessionFilter, setSessionFilter] = useState('all');

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

  const now = Date.now();

  const filteredSessions = useMemo(() => {
    return sessions.filter((s) => {
      const start = new Date(s.scheduled_start).getTime();
      if (sessionFilter === 'upcoming' && start < now) return false;
      if (sessionFilter === 'past' && start >= now) return false;
      return true;
    });
  }, [sessions, sessionFilter, now]);

  const selectedSession = sessions.find((s) => s.id === selectedSessionId);
  const activeSessionId = selectedCourse && selectedSession ? selectedSession.id : null;
  const selectedIsPast = selectedSession
    ? new Date(selectedSession.scheduled_start).getTime() < now
    : false;

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
  const hasAnyMarked = attendanceRecords.some((r) => r.marked_at);

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
          ? current.map((record) => (record.student_id === nextRecord.student_id ? updated : record))
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
        const ts = new Date().toISOString();
        const byStudent = new Map(current.map((record) => [record.student_id, record]));
        students.forEach((student) => {
          byStudent.set(student.id, {
            ...(byStudent.get(student.id) || {}),
            session_id: activeSessionId,
            student_id: student.id,
            status: 'present',
            marked_at: ts,
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

  const saveSessionMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        batch_course_id: selectedBcId,
        lecturer_id: lecturerId,
        ...sessionForm,
      };
      if (editingSession) {
        return updateClassSession(editingSession.id, payload);
      }
      return createClassSession(payload);
    },
    onSuccess: (data) => {
      showToast(editingSession ? 'Session updated' : 'Session created', 'success');
      closeSessionModal();
      refetchSessions();
      if (data?.id) setSelectedSessionId(data.id);
    },
    onError: (err) => showToast(err.message || 'Failed to save session', 'error'),
  });

  const deleteSessionMutation = useMutation({
    mutationFn: (id) => deleteClassSession(id),
    onSuccess: () => {
      showToast('Session deleted', 'success');
      setSelectedSessionId(null);
      refetchSessions();
    },
    onError: (err) => showToast(err.message || 'Could not delete session. Sessions with attendance cannot be deleted by lecturers.', 'error'),
  });

  const openCreateSession = () => {
    setEditingSession(null);
    setSessionForm(emptySessionForm);
    setSessionModal(true);
  };

  const openEditSession = (s) => {
    setEditingSession(s);
    setSessionForm({
      scheduled_start: toLocalInput(s.scheduled_start),
      scheduled_end: toLocalInput(s.scheduled_end),
      room: s.room || '',
      topic: s.topic || '',
      notes: s.notes || '',
    });
    setSessionModal(true);
  };

  const closeSessionModal = () => {
    setSessionModal(false);
    setEditingSession(null);
    setSessionForm(emptySessionForm);
  };

  const markAllPresentFn = () => {
    if (!activeSessionId || students.length === 0) return;
    markAllMutation.mutate();
  };

  const saveAttendance = (studentId, status) => {
    if (!activeSessionId) return;
    saveAttendanceMutation.mutate({
      session_id: activeSessionId,
      student_id: studentId,
      status,
      marked_by: profile?.id,
    });
  };

  const totalStu = students.length;
  const present = attendanceRecords.filter((record) => record.status === 'present' && record.marked_at).length;
  const absent = attendanceRecords.filter((record) => record.status === 'absent' && record.marked_at).length;
  const late = attendanceRecords.filter((record) => record.status === 'late' && record.marked_at).length;
  const excused = attendanceRecords.filter((record) => record.status === 'excused' && record.marked_at).length;
  const unrecorded = students.filter((student) => !attendanceByStudent.get(student.id)?.marked_at).length;
  const pct = totalStu > 0 ? Math.round(((present + late) / totalStu) * 100) : 0;

  const formInvalid =
    !sessionForm.scheduled_start
    || !sessionForm.scheduled_end
    || new Date(sessionForm.scheduled_end) <= new Date(sessionForm.scheduled_start);

  return (
    <AppLayout pageTitle="Class Sessions">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Class Sessions & Attendance</h1>
          <p className="page-subtitle">Create sessions for your courses and mark student attendance</p>
        </div>
      </div>

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
          style={{ maxWidth: 480 }}
          value={selectedBcId}
          onChange={(e) => {
            setSelectedBcId(e.target.value);
            setSelectedSessionId(null);
          }}
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
          <div className="card" style={{ alignSelf: 'start' }}>
            <div className="card-header" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
              <span className="card-title">Sessions</span>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginLeft: 'auto' }}>
                <select
                  className="form-input"
                  style={{ maxWidth: 120, padding: '0.3rem 0.5rem', fontSize: '0.8rem' }}
                  value={sessionFilter}
                  onChange={(e) => setSessionFilter(e.target.value)}
                >
                  <option value="all">All</option>
                  <option value="upcoming">Upcoming</option>
                  <option value="past">Past</option>
                </select>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={openCreateSession}
                  disabled={!selectedCourse || !lecturerId || !!sessionsError}
                >
                  <MdAdd /> New
                </button>
              </div>
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
              ) : filteredSessions.length === 0 ? (
                <div className="empty-state" style={{ padding: '1.5rem' }}>
                  <div className="empty-state-title" style={{ fontSize: '0.875rem' }}>
                    {sessions.length === 0 ? 'No sessions yet' : 'No sessions match filter'}
                  </div>
                  <p className="empty-state-text">
                    {sessions.length === 0
                      ? 'Create a session to start marking attendance.'
                      : 'Try changing the filter above.'}
                  </p>
                </div>
              ) : (
                filteredSessions.map((s) => {
                  const isPast = new Date(s.scheduled_start).getTime() < now;
                  const isSelected = s.id === selectedSessionId;
                  return (
                    <div
                      key={s.id}
                      style={{
                        display: 'flex',
                        alignItems: 'stretch',
                        borderBottom: '1px solid var(--color-border)',
                        background: isSelected ? 'rgba(17,47,66,0.06)' : 'transparent',
                        borderLeft: isSelected ? '3px solid var(--color-primary)' : '3px solid transparent',
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedSessionId(s.id)}
                        style={{
                          flex: 1,
                          textAlign: 'left',
                          padding: '0.75rem 0.75rem',
                          border: 'none',
                          background: 'transparent',
                          cursor: 'pointer',
                        }}
                      >
                        <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text)' }}>
                          {new Date(s.scheduled_start).toLocaleDateString('en-GB', {
                            day: 'numeric', month: 'short', year: 'numeric',
                          })}
                          <span
                            style={{
                              marginLeft: 6,
                              fontSize: '0.68rem',
                              fontWeight: 600,
                              color: isPast ? 'var(--color-text-muted)' : '#059669',
                            }}
                          >
                            {isPast ? 'past' : 'upcoming'}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                          {new Date(s.scheduled_start).toLocaleTimeString('en-GB', {
                            hour: '2-digit', minute: '2-digit',
                          })}
                          {' – '}
                          {new Date(s.scheduled_end).toLocaleTimeString('en-GB', {
                            hour: '2-digit', minute: '2-digit',
                          })}
                          {s.room ? ` · ${s.room}` : ''}
                        </div>
                        {s.topic && (
                          <div
                            style={{
                              fontSize: '0.72rem',
                              color: 'var(--color-text-muted)',
                              marginTop: 2,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {s.topic}
                          </div>
                        )}
                      </button>
                      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 2, paddingRight: 6 }}>
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          style={{ padding: '0.2rem 0.4rem' }}
                          title="Edit session"
                          onClick={() => openEditSession(s)}
                        >
                          <MdEdit size={14} />
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          style={{ padding: '0.2rem 0.4rem' }}
                          title="Delete session"
                          onClick={() => {
                            if (
                              window.confirm(
                                'Delete this class session? You can only delete sessions that have no attendance marked.',
                              )
                            ) {
                              deleteSessionMutation.mutate(s.id);
                            }
                          }}
                        >
                          <MdDelete size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

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
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                        {item.label}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="card">
                  <div className="card-header" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
                    <span className="card-title">
                      <MdPeopleAlt style={{ verticalAlign: 'middle', marginRight: 6 }} />
                      {selectedSession && fmtDT(selectedSession.scheduled_start)}
                      {selectedSession?.topic ? ` · ${selectedSession.topic}` : ''}
                      {selectedIsPast && (
                        <span className="badge badge-gray" style={{ marginLeft: 8, fontSize: '0.7rem' }}>
                          Past
                        </span>
                      )}
                    </span>
                    <div style={{ display: 'flex', gap: '0.5rem', marginLeft: 'auto' }}>
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() => openEditSession(selectedSession)}
                      >
                        <MdEdit /> Edit
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={markAllPresentFn}
                        disabled={
                          markAllMutation.isPending
                          || students.length === 0
                          || studentsLoading
                          || attLoading
                        }
                      >
                        <MdCheckCircle />{' '}
                        {markAllMutation.isPending ? 'Marking…' : 'Mark All Present'}
                      </button>
                    </div>
                  </div>
                  {selectedSession?.room && (
                    <div style={{ padding: '0 1.25rem 0.5rem', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                      Room: {selectedSession.room}
                      {selectedSession.notes ? ` · ${selectedSession.notes}` : ''}
                    </div>
                  )}
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
                        <p className="empty-state-text">
                          Attendance records could not be loaded. No default statuses are assumed.
                        </p>
                      </div>
                    ) : studentsError ? (
                      <div className="empty-state" role="alert">
                        <div className="empty-state-title">Student list unavailable</div>
                        <p className="empty-state-text">Students in this batch could not be loaded.</p>
                      </div>
                    ) : studentsLoading ? (
                      <div style={{ padding: '1rem' }}>
                        {[1, 2, 3].map((i) => (
                          <div key={i} className="skeleton skeleton-text" style={{ marginBottom: 10 }} />
                        ))}
                      </div>
                    ) : students.length === 0 ? (
                      <div className="empty-state">
                        <div className="empty-state-title">No students in batch</div>
                      </div>
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
                            const status = attendanceRecord?.marked_at
                              ? attendanceRecord.status
                              : null;
                            const isSaving =
                              saveAttendanceMutation.isPending
                              && saveAttendanceMutation.variables?.student_id === stu.id;
                            return (
                              <tr key={stu.id}>
                                <td>
                                  <span className="badge badge-blue">{stu.matricule}</span>
                                </td>
                                <td style={{ fontWeight: 600 }}>
                                  {stu.first_name} {stu.last_name}
                                </td>
                                <td>
                                  <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
                                    {STATUS_OPTS.map((opt) => (
                                      <button
                                        key={opt}
                                        type="button"
                                        className={`btn btn-sm ${
                                          status === opt
                                            ? opt === 'present'
                                              ? 'btn-primary'
                                              : opt === 'absent'
                                                ? 'btn-danger'
                                                : 'btn-outline'
                                            : 'btn-outline'
                                        }`}
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
                                    {isSaving && (
                                      <span className="form-hint" role="status">
                                        Saving…
                                      </span>
                                    )}
                                    {!attendanceRecord?.marked_at && (
                                      <span className="form-hint">Not marked</span>
                                    )}
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
          <div className="empty-state-icon">
            <MdSchedule />
          </div>
          <div className="empty-state-title">Choose a course</div>
          <p className="empty-state-text">
            Select one of your assigned courses to manage class sessions and attendance.
          </p>
        </div>
      )}

      <Modal
        isOpen={sessionModal}
        onClose={closeSessionModal}
        title={editingSession ? 'Edit class session' : 'Create class session'}
        footer={
          <>
            <button type="button" className="btn btn-outline" onClick={closeSessionModal}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => saveSessionMutation.mutate()}
              disabled={saveSessionMutation.isPending || formInvalid}
            >
              {saveSessionMutation.isPending
                ? 'Saving…'
                : editingSession
                  ? 'Save changes'
                  : 'Create Session'}
            </button>
          </>
        }
      >
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div className="form-group">
              <label className="form-label">Start *</label>
              <input
                type="datetime-local"
                className="form-input"
                value={sessionForm.scheduled_start}
                onChange={(e) =>
                  setSessionForm((f) => ({ ...f, scheduled_start: e.target.value }))
                }
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">End *</label>
              <input
                type="datetime-local"
                className="form-input"
                value={sessionForm.scheduled_end}
                onChange={(e) =>
                  setSessionForm((f) => ({ ...f, scheduled_end: e.target.value }))
                }
                required
              />
            </div>
          </div>
          {sessionForm.scheduled_start
            && sessionForm.scheduled_end
            && new Date(sessionForm.scheduled_end) <= new Date(sessionForm.scheduled_start) && (
              <p className="form-error" role="alert" style={{ marginTop: -4, marginBottom: 8 }}>
                End time must be later than start time.
              </p>
            )}
          <div className="form-group">
            <label className="form-label">Room</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Room 101, Hall A"
              value={sessionForm.room}
              onChange={(e) => setSessionForm((f) => ({ ...f, room: e.target.value }))}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Topic</label>
            <input
              type="text"
              className="form-input"
              placeholder="Session topic (optional)"
              value={sessionForm.topic}
              onChange={(e) => setSessionForm((f) => ({ ...f, topic: e.target.value }))}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Notes</label>
            <textarea
              className="form-input"
              rows={2}
              value={sessionForm.notes}
              onChange={(e) => setSessionForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Optional notes for this session"
            />
          </div>
          {editingSession && hasAnyMarked && selectedSessionId === editingSession.id && (
            <p style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
              This session already has attendance. You can still update time, room and topic.
            </p>
          )}
        </div>
      </Modal>
    </AppLayout>
  );
}
