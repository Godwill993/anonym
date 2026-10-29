import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
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
import {
  submitSessionAttendance,
  resubmitSessionAttendance,
  canEditSessionAttendance,
} from '../../services/attendanceSubmit';
import { createZoomMeeting, deleteZoomMeeting } from '../../services/zoomService';
import { splitLocalDateTime, combineLocalDateTime } from '../../utils/sessionDateTime';
import { MdAdd, MdEdit, MdDelete, MdHowToReg, MdVideocam, MdVideocamOff, MdSend, MdReplay } from 'react-icons/md';

const emptyForm = { session_date: '', start_time: '', end_time: '', room: '', topic: '', notes: '', is_online: false };

function attendanceStatusBadge(status) {
  const st = status || 'draft';
  const map = {
    draft: ['badge-gray', 'Draft'],
    submitted: ['badge-amber', 'Submitted — awaiting admin'],
    returned: ['badge-red', 'Returned by admin'],
    approved: ['badge-green', 'Approved'],
  };
  const [cls, label] = map[st] || ['badge-gray', st];
  return <span className={`badge ${cls}`}>{label}</span>;
}

export default function LecturerSessionsPage() {
  const { session, profile } = useAuth();
  const [searchParams] = useSearchParams();
  const initialBc = searchParams.get('bc') || '';
  const { showToast } = useToast();
  const [selectedBcId, setSelectedBcId] = useState(initialBc);
  const [selectedSessionId, setSelectedSessionId] = useState(null);
  const [sessionModal, setSessionModal] = useState(false);
  const [editingSession, setEditingSession] = useState(null);
  const [sessionForm, setSessionForm] = useState(emptyForm);
  const [zoomLoading, setZoomLoading] = useState(null); // session id being processed

  const { data: lecturerProfile } = useQuery({
    queryKey: ['my-lecturer-profile'],
    queryFn: getMyLecturerProfile,
    enabled: !!session,
  });
  const lecturerId = lecturerProfile?.id;

  const { data: courses = [] } = useQuery({
    queryKey: ['my-courses', lecturerId],
    queryFn: () => getMyCourses(lecturerId),
    enabled: !!lecturerId,
  });

  const { data: sessions = [], refetch: refetchSessions } = useQuery({
    queryKey: ['sessions-for-bc', selectedBcId, lecturerId],
    queryFn: () => getSessionsForBatchCourse(selectedBcId, lecturerId),
    enabled: !!selectedBcId && !!lecturerId,
  });

  const selectedCourse = courses.find((c) => c.id === selectedBcId);
  const selectedSession = sessions.find((s) => s.id === selectedSessionId) || null;
  const attendanceEditable = canEditSessionAttendance(selectedSession);

  const { data: students = [] } = useQuery({
    queryKey: ['students-in-batch', selectedCourse?.batches?.id],
    queryFn: () => getStudentsInBatch(selectedCourse.batches.id),
    enabled: !!selectedCourse?.batches?.id,
  });

  const { data: attendanceRecords = [], refetch: refetchAtt } = useQuery({
    queryKey: ['attendance-session', selectedSessionId],
    queryFn: () => getAttendanceForSession(selectedSessionId),
    enabled: !!selectedSessionId,
  });

  const combinedStart = combineLocalDateTime(sessionForm.session_date, sessionForm.start_time);
  const combinedEnd = combineLocalDateTime(sessionForm.session_date, sessionForm.end_time);
  const formInvalid =
    !sessionForm.session_date ||
    !sessionForm.start_time ||
    !sessionForm.end_time ||
    !combinedStart ||
    !combinedEnd ||
    combinedEnd.getTime() <= combinedStart.getTime();

  const saveMutation = useMutation({
    mutationFn: async () => {
      const start = combineLocalDateTime(sessionForm.session_date, sessionForm.start_time);
      const end = combineLocalDateTime(sessionForm.session_date, sessionForm.end_time);
      if (!start || !end) throw new Error('Please enter a valid session date, start time, and end time.');
      if (!(end.getTime() > start.getTime())) {
        throw new Error('End time must be later than start time on the same day.');
      }
      const payload = {
        batch_course_id: selectedBcId,
        lecturer_id: lecturerId,
        scheduled_start: start.toISOString(),
        scheduled_end: end.toISOString(),
        room: sessionForm.room,
        topic: sessionForm.topic,
        notes: sessionForm.notes,
      };
      const savedSession = editingSession
        ? await updateClassSession(editingSession.id, payload)
        : await createClassSession(payload);

      // If the lecturer toggled "Online Class", auto-create a Zoom meeting
      if (!editingSession && sessionForm.is_online && savedSession?.id) {
        const durationMs = end.getTime() - start.getTime();
        const durationMinutes = Math.round(durationMs / 60000);
        try {
          await createZoomMeeting({
            sessionId: savedSession.id,
            topic: sessionForm.topic || selectedCourse?.courses?.name || 'Online Class',
            scheduledStart: start.toISOString(),
            durationMinutes,
          });
        } catch (zoomErr) {
          // Session was created — just warn about Zoom
          showToast(
            `Session created but Zoom meeting failed: ${zoomErr.message}. Check your Zoom API keys.`,
            'error',
          );
          return savedSession;
        }
      }
      return savedSession;
    },
    onSuccess: (data) => {
      showToast(editingSession ? 'Session updated' : 'Session created', 'success');
      setSessionModal(false);
      setEditingSession(null);
      setSessionForm(emptyForm);
      refetchSessions();
      if (data?.id) setSelectedSessionId(data.id);
    },
    onError: (err) => showToast(err.message || 'Failed to save session', 'error'),
  });

  const submitAttendanceMutation = useMutation({
    mutationFn: async () => {
      if (!selectedSessionId) throw new Error('No session selected');
      const st = selectedSession?.attendance_status || 'draft';
      if (st === 'returned') return resubmitSessionAttendance(selectedSessionId);
      return submitSessionAttendance(selectedSessionId);
    },
    onSuccess: () => {
      showToast('Attendance submitted to admin for approval', 'success');
      refetchSessions();
    },
    onError: (err) => showToast(err.message || 'Could not submit attendance', 'error'),
  });

  const openCreate = () => {
    setEditingSession(null);
    setSessionForm(emptyForm);
    setSessionModal(true);
  };

  const openEdit = (s) => {
    setEditingSession(s);
    const startParts = splitLocalDateTime(s.scheduled_start);
    const endParts = splitLocalDateTime(s.scheduled_end);
    setSessionForm({
      session_date: startParts.date || endParts.date,
      start_time: startParts.time,
      end_time: endParts.time,
      room: s.room || '',
      topic: s.topic || '',
      notes: s.notes || '',
      is_online: false, // editing: Zoom is managed separately
    });
    setSessionModal(true);
  };

  const handleAddZoom = async (s) => {
    if (!s?.id) return;
    setZoomLoading(s.id);
    try {
      const start = new Date(s.scheduled_start);
      const end = new Date(s.scheduled_end);
      const durationMinutes = Math.round((end - start) / 60000);
      await createZoomMeeting({
        sessionId: s.id,
        topic: s.topic || selectedCourse?.courses?.name || 'Online Class',
        scheduledStart: s.scheduled_start,
        durationMinutes,
      });
      showToast('Zoom meeting created!', 'success');
      refetchSessions();
    } catch (err) {
      showToast(err.message || 'Could not create Zoom meeting', 'error');
    } finally {
      setZoomLoading(null);
    }
  };

  const handleRemoveZoom = async (s) => {
    if (!s?.zoom_meeting_id) return;
    if (!window.confirm('Remove the Zoom meeting from this session?')) return;
    setZoomLoading(s.id);
    try {
      await deleteZoomMeeting({ zoomMeetingId: s.zoom_meeting_id, sessionId: s.id });
      showToast('Zoom meeting removed.', 'success');
      refetchSessions();
    } catch (err) {
      showToast(err.message || 'Could not remove Zoom meeting', 'error');
    } finally {
      setZoomLoading(null);
    }
  };

  const handleDeleteSession = async (s) => {
    if (!window.confirm('Delete this class session?')) return;
    try {
      if (s.zoom_meeting_id) {
        try {
          await deleteZoomMeeting({ zoomMeetingId: s.zoom_meeting_id, sessionId: s.id });
        } catch (_) {
          // Continue with session delete even if Zoom cleanup fails
        }
      }
      await deleteClassSession(s.id);
      showToast('Session deleted', 'success');
      if (selectedSessionId === s.id) setSelectedSessionId(null);
      refetchSessions();
    } catch (err) {
      showToast(err.message || 'Could not delete session', 'error');
    }
  };

  const markStatus = async (studentId, status) => {
    if (!selectedSessionId) return;
    if (!attendanceEditable) {
      showToast('Attendance is locked. Wait for admin return or use a draft session.', 'error');
      return;
    }
    try {
      await upsertAttendance({
        session_id: selectedSessionId,
        student_id: studentId,
        status,
        marked_by: profile?.id,
      });
      refetchAtt();
    } catch (err) {
      showToast(err.message || 'Could not save attendance', 'error');
    }
  };

  const markAll = async () => {
    if (!selectedSessionId || students.length === 0) return;
    if (!attendanceEditable) {
      showToast('Attendance is locked. Wait for admin return or use a draft session.', 'error');
      return;
    }
    try {
      await markAllPresent(selectedSessionId, students.map((s) => s.id), profile?.id);
      showToast('All students marked present.', 'success');
      refetchAtt();
    } catch (err) {
      showToast(err.message || 'Could not save attendance', 'error');
    }
  };

  const attMap = new Map(attendanceRecords.map((r) => [r.student_id, r]));

  return (
    <AppLayout pageTitle="Class Sessions">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Class Sessions & Attendance</h1>
          <p className="page-subtitle">Create sessions, mark attendance, then submit to admin for approval</p>
        </div>
      </div>

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
        >
          <option value="">— Select a course —</option>
          {courses.map((bc) => (
            <option key={bc.id} value={bc.id}>
              {bc.courses?.code} — {bc.courses?.name} ({bc.batches?.name}, Sem {bc.semesters?.number})
            </option>
          ))}
        </select>
      </div>

      {selectedBcId && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(240px, 320px) 1fr', gap: '1rem' }}>
          <div className="card">
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="card-title">Sessions</span>
              <button type="button" className="btn btn-primary btn-sm" onClick={openCreate} disabled={!lecturerId}>
                <MdAdd /> New
              </button>
            </div>
            <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
              {sessions.length === 0 ? (
                <div className="empty-state" style={{ padding: '1.5rem' }}>
                  <div className="empty-state-title">No sessions yet</div>
                  <p className="empty-state-text">Create a session to start marking attendance.</p>
                </div>
              ) : (
                sessions.map((s) => (
                  <div
                    key={s.id}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      borderBottom: '1px solid var(--color-border)',
                      background: s.id === selectedSessionId ? 'rgba(17,47,66,0.06)' : 'transparent',
                    }}
                  >
                    <div style={{ display: 'flex' }}>
                      <button
                        type="button"
                        onClick={() => setSelectedSessionId(s.id)}
                        style={{
                          flex: 1,
                          textAlign: 'left',
                          padding: '0.75rem',
                          border: 'none',
                          background: 'transparent',
                          cursor: 'pointer',
                        }}
                      >
                        <div style={{ fontWeight: 600, fontSize: '0.8125rem', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          {new Date(s.scheduled_start).toLocaleDateString('en-GB', {
                            day: 'numeric', month: 'short', year: 'numeric',
                          })}
                          {s.zoom_join_url && (
                            <span style={{ fontSize: '0.65rem', background: '#2d8cff', color: '#fff', borderRadius: 4, padding: '1px 6px', fontWeight: 700 }}>
                              ONLINE
                            </span>
                          )}
                          {attendanceStatusBadge(s.attendance_status)}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                          {new Date(s.scheduled_start).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                          {' – '}
                          {new Date(s.scheduled_end).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                          {s.room ? ` · ${s.room}` : ''}
                        </div>
                        {s.topic && (
                          <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>{s.topic}</div>
                        )}
                      </button>
                      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 2, paddingRight: 6 }}>
                        <button type="button" className="btn btn-outline btn-sm" style={{ padding: '0.2rem 0.4rem' }} onClick={() => openEdit(s)}>
                          <MdEdit size={14} />
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          style={{ padding: '0.2rem 0.4rem' }}
                          onClick={() => handleDeleteSession(s)}
                        >
                          <MdDelete size={14} />
                        </button>
                      </div>
                    </div>

                    {/* Zoom action row */}
                    <div style={{ padding: '0 0.75rem 0.6rem', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {s.zoom_join_url ? (
                        <>
                          <a
                            href={s.zoom_start_url || s.zoom_join_url}
                            target="_blank"
                            rel="noreferrer"
                            className="btn btn-primary btn-sm"
                            style={{ fontSize: '0.72rem', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                          >
                            <MdVideocam size={13} /> Start Meeting
                          </a>
                          <button
                            type="button"
                            className="btn btn-outline btn-sm"
                            style={{ fontSize: '0.72rem' }}
                            disabled={zoomLoading === s.id}
                            onClick={() => handleRemoveZoom(s)}
                          >
                            <MdVideocamOff size={13} /> Remove Zoom
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          style={{ fontSize: '0.72rem', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                          disabled={zoomLoading === s.id}
                          onClick={() => handleAddZoom(s)}
                        >
                          <MdVideocam size={13} />
                          {zoomLoading === s.id ? 'Creating…' : 'Add Zoom'}
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <span className="card-title">
                <MdHowToReg style={{ verticalAlign: 'middle', marginRight: 6 }} />
                Attendance
                {selectedSession && (
                  <span style={{ marginLeft: 8, fontWeight: 500 }}>{attendanceStatusBadge(selectedSession.attendance_status)}</span>
                )}
              </span>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {selectedSessionId && students.length > 0 && attendanceEditable && (
                  <button type="button" className="btn btn-outline btn-sm" onClick={markAll}>
                    Mark all present
                  </button>
                )}
                {selectedSessionId && attendanceEditable && (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    disabled={submitAttendanceMutation.isPending}
                    onClick={() => {
                      if (!window.confirm('Submit this session attendance to admin for approval? You will not be able to edit until it is returned or approved.')) return;
                      submitAttendanceMutation.mutate();
                    }}
                  >
                    {(selectedSession?.attendance_status || 'draft') === 'returned' ? (
                      <><MdReplay /> Resubmit to admin</>
                    ) : (
                      <><MdSend /> Submit to admin</>
                    )}
                  </button>
                )}
              </div>
            </div>

            {selectedSession?.attendance_status === 'returned' && selectedSession.attendance_admin_comment && (
              <div
                style={{
                  margin: '0 1rem 0.75rem',
                  padding: '0.75rem 1rem',
                  background: 'rgba(220, 38, 38, 0.08)',
                  border: '1px solid rgba(220, 38, 38, 0.25)',
                  borderRadius: 8,
                  fontSize: '0.875rem',
                }}
              >
                <strong style={{ color: '#b91c1c' }}>Admin feedback:</strong>{' '}
                {selectedSession.attendance_admin_comment}
              </div>
            )}

            {!selectedSessionId ? (
              <div className="empty-state" style={{ padding: '2rem' }}>
                <div className="empty-state-title">Select a session</div>
                <p className="empty-state-text">Choose a session on the left to mark attendance, then submit to admin.</p>
              </div>
            ) : students.length === 0 ? (
              <div className="empty-state" style={{ padding: '2rem' }}>
                <div className="empty-state-title">No students in this batch</div>
              </div>
            ) : (
              <div className="table-wrapper">
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
                      const rec = attMap.get(stu.id);
                      return (
                        <tr key={stu.id}>
                          <td>{stu.matricule}</td>
                          <td>{stu.first_name} {stu.last_name}</td>
                          <td>
                            <select
                              className="form-input"
                              style={{ maxWidth: 140 }}
                              value={rec?.status || ''}
                              disabled={!attendanceEditable}
                              onChange={(e) => markStatus(stu.id, e.target.value)}
                            >
                              <option value="">—</option>
                              <option value="present">Present</option>
                              <option value="absent">Absent</option>
                              <option value="late">Late</option>
                              <option value="excused">Excused</option>
                            </select>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {!attendanceEditable && (
                  <p style={{ padding: '0.75rem 1rem', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                    {(selectedSession?.attendance_status || '') === 'submitted' &&
                      'Attendance is submitted and locked until admin approves or returns it.'}
                    {(selectedSession?.attendance_status || '') === 'approved' &&
                      'Attendance has been approved by admin and cannot be edited.'}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <Modal
        isOpen={sessionModal}
        onClose={() => {
          setSessionModal(false);
          setEditingSession(null);
          setSessionForm(emptyForm);
        }}
        title={editingSession ? 'Edit class session' : 'Create class session'}
        footer={
          <>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => {
                setSessionModal(false);
                setEditingSession(null);
                setSessionForm(emptyForm);
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || formInvalid}
            >
              {saveMutation.isPending ? 'Saving…' : editingSession ? 'Save changes' : 'Create Session'}
            </button>
          </>
        }
      >
        <div>
          <div className="form-group">
            <label className="form-label" htmlFor="session-date">Session date *</label>
            <input
              id="session-date"
              type="date"
              className="form-input"
              value={sessionForm.session_date}
              onChange={(e) => setSessionForm((f) => ({ ...f, session_date: e.target.value }))}
              required
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div className="form-group">
              <label className="form-label" htmlFor="session-start-time">Start time *</label>
              <input
                id="session-start-time"
                type="time"
                className="form-input"
                value={sessionForm.start_time}
                onChange={(e) => setSessionForm((f) => ({ ...f, start_time: e.target.value }))}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="session-end-time">End time *</label>
              <input
                id="session-end-time"
                type="time"
                className="form-input"
                value={sessionForm.end_time}
                onChange={(e) => setSessionForm((f) => ({ ...f, end_time: e.target.value }))}
                required
              />
            </div>
          </div>
          {sessionForm.session_date &&
            sessionForm.start_time &&
            sessionForm.end_time &&
            combinedStart &&
            combinedEnd &&
            combinedEnd.getTime() <= combinedStart.getTime() && (
              <p className="form-error" role="alert" style={{ marginTop: -4, marginBottom: 8 }}>
                End time must be later than start time (same day).
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
          {/* Online class toggle — only for new sessions */}
          {!editingSession && (
            <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.25rem' }}>
              <input
                id="session-is-online"
                type="checkbox"
                style={{ width: 18, height: 18, cursor: 'pointer', accentColor: '#2d8cff' }}
                checked={sessionForm.is_online}
                onChange={(e) => setSessionForm((f) => ({ ...f, is_online: e.target.checked }))}
              />
              <label htmlFor="session-is-online" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, margin: 0 }}>
                <MdVideocam size={16} style={{ color: '#2d8cff' }} />
                <span style={{ fontWeight: 500 }}>Create Zoom meeting for this session</span>
              </label>
            </div>
          )}
        </div>
      </Modal>
    </AppLayout>
  );
}
