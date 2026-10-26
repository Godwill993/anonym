import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MdAdd, MdDelete, MdEdit, MdSearch, MdSchedule, MdVideocam, MdVideocamOff } from 'react-icons/md';
import AppLayout from '../../components/layout/AppLayout';
import Modal from '../../components/common/Modal';
import { toast } from '../../components/common/Toast';
import { useTranslation } from '../../i18n';
import {
  getBatchCourses,
  getClassSessions,
  createClassSessionAdmin,
  generateSessionsFromTimetable,
  updateClassSessionAdmin,
  deleteClassSessionAdmin,
} from '../../services/academicService';
import { getLecturers } from '../../services/peopleService';
import { createZoomMeeting, deleteZoomMeeting } from '../../services/zoomService';

function toLocalInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const emptyForm = {
  batch_course_id: '',
  lecturer_id: '',
  scheduled_start: '',
  scheduled_end: '',
  room: '',
  topic: '',
  notes: '',
  is_online: false,
};

export default function ClassSessionsPage() {
  const { translateText: tx } = useTranslation();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('upcoming');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [genFrom, setGenFrom] = useState('');
  const [genTo, setGenTo] = useState('');
  const [generating, setGenerating] = useState(false);
  const [zoomLoading, setZoomLoading] = useState(null);

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ['admin-class-sessions'],
    queryFn: () => getClassSessions({ limit: 300 }),
  });

  const { data: batchCourses = [] } = useQuery({
    queryKey: ['admin-batch-courses'],
    queryFn: getBatchCourses,
  });

  const { data: lecturers = [] } = useQuery({
    queryKey: ['admin-lecturers'],
    queryFn: getLecturers,
  });

  const saveMutation = useMutation({
    mutationFn: async (payload) => {
      const { is_online, ...sessionPayload } = payload;
      let saved;
      if (editing) {
        saved = await updateClassSessionAdmin(editing.id, sessionPayload);
      } else {
        saved = await createClassSessionAdmin(sessionPayload);
        if (is_online && saved?.id) {
          const start = new Date(sessionPayload.scheduled_start);
          const end = new Date(sessionPayload.scheduled_end);
          const durationMinutes = Math.max(1, Math.round((end - start) / 60000));
          try {
            await createZoomMeeting({
              sessionId: saved.id,
              topic: sessionPayload.topic || 'Online Class',
              scheduledStart: new Date(sessionPayload.scheduled_start).toISOString(),
              durationMinutes,
            });
          } catch (zoomErr) {
            toast.error(
              `Session created but Zoom failed: ${zoomErr.message}. Check Zoom API secrets.`,
            );
          }
        }
      }
      return saved;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-class-sessions'] });
      toast.success(tx(editing ? 'Class session updated' : 'Class session created'));
      closeModal();
    },
    onError: (err) => toast.error(err.message || tx('Could not save session')),
  });

  const deleteMutation = useMutation({
    mutationFn: async (session) => {
      if (session.zoom_meeting_id) {
        try {
          await deleteZoomMeeting({
            zoomMeetingId: session.zoom_meeting_id,
            sessionId: session.id,
          });
        } catch (_) {
          // still delete the session
        }
      }
      return deleteClassSessionAdmin(session.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-class-sessions'] });
      toast.success(tx('Class session removed'));
    },
    onError: (err) => toast.error(err.message || tx('Could not delete session')),
  });

  const now = Date.now();

  const filtered = useMemo(() => {
    const term = search.toLowerCase();
    return sessions.filter((session) => {
      const start = new Date(session.scheduled_start).getTime();
      if (filter === 'upcoming' && start < now) return false;
      if (filter === 'past' && start >= now) return false;
      const hay = `${session.batch_courses?.courses?.code || ''} ${session.batch_courses?.courses?.name || ''} ${session.batch_courses?.batches?.name || ''} ${session.lecturers?.first_name || ''} ${session.lecturers?.last_name || ''} ${session.room || ''} ${session.topic || ''}`.toLowerCase();
      return hay.includes(term);
    });
  }, [sessions, search, filter, now]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const openEdit = (session) => {
    setEditing(session);
    setForm({
      batch_course_id: session.batch_course_id || '',
      lecturer_id: session.lecturer_id || '',
      scheduled_start: toLocalInput(session.scheduled_start),
      scheduled_end: toLocalInput(session.scheduled_end),
      room: session.room || '',
      topic: session.topic || '',
      notes: session.notes || '',
      is_online: false,
    });
    setOpen(true);
  };

  const closeModal = () => {
    setOpen(false);
    setEditing(null);
    setForm(emptyForm);
  };

  const onBatchCourseChange = (batchCourseId) => {
    const bc = batchCourses.find((item) => item.id === batchCourseId);
    setForm((prev) => ({
      ...prev,
      batch_course_id: batchCourseId,
      lecturer_id: bc?.lecturer_id || bc?.lecturers?.id || prev.lecturer_id,
    }));
  };

  const submit = (event) => {
    event.preventDefault();
    if (!form.batch_course_id || !form.lecturer_id || !form.scheduled_start || !form.scheduled_end) {
      toast.error(tx('Course, lecturer, start and end times are required.'));
      return;
    }
    if (!(new Date(form.scheduled_end) > new Date(form.scheduled_start))) {
      toast.error(tx('End time must be after start time.'));
      return;
    }
    saveMutation.mutate(form);
  };

  const handleAddZoom = async (session) => {
    if (!session?.id) return;
    setZoomLoading(session.id);
    try {
      const start = new Date(session.scheduled_start);
      const end = new Date(session.scheduled_end);
      const durationMinutes = Math.max(1, Math.round((end - start) / 60000));
      await createZoomMeeting({
        sessionId: session.id,
        topic: session.topic || session.batch_courses?.courses?.name || 'Online Class',
        scheduledStart: session.scheduled_start,
        durationMinutes,
      });
      toast.success(tx('Zoom meeting created'));
      queryClient.invalidateQueries({ queryKey: ['admin-class-sessions'] });
    } catch (err) {
      toast.error(err.message || tx('Could not create Zoom meeting'));
    } finally {
      setZoomLoading(null);
    }
  };

  const handleRemoveZoom = async (session) => {
    if (!session?.zoom_meeting_id) return;
    if (!window.confirm(tx('Remove the Zoom meeting from this session?'))) return;
    setZoomLoading(session.id);
    try {
      await deleteZoomMeeting({
        zoomMeetingId: session.zoom_meeting_id,
        sessionId: session.id,
      });
      toast.success(tx('Zoom meeting removed'));
      queryClient.invalidateQueries({ queryKey: ['admin-class-sessions'] });
    } catch (err) {
      toast.error(err.message || tx('Could not remove Zoom meeting'));
    } finally {
      setZoomLoading(null);
    }
  };

  const handleGenerate = async () => {
    if (!genFrom || !genTo) {
      toast.error(tx('Please select both start and end dates.'));
      return;
    }
    if (genTo < genFrom) {
      toast.error(tx('End date must be on or after the start date.'));
      return;
    }
    setGenerating(true);
    try {
      const count = await generateSessionsFromTimetable({ from: genFrom, to: genTo });
      toast.success(
        count === 0
          ? tx('No new sessions created (slots may already exist for these days, or no timetable slots match)')
          : `${count} session(s) created from timetable`
      );
      queryClient.invalidateQueries({ queryKey: ['admin-class-sessions'] });
    } catch (err) {
      const msg = err?.message || 'Failed to generate sessions';
      if (msg.includes('generate_sessions_from_timetable') || msg.includes('function') || msg.includes('does not exist')) {
        toast.error(tx('Session generation is not available yet. Apply migration 20261022000000 on Supabase first.'));
      } else {
        toast.error(msg);
      }
    } finally {
      setGenerating(false);
    }
  };

  return (
    <AppLayout pageTitle={tx('Class Sessions')}>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">{tx('Class Sessions')}</h1>
          <p className="page-subtitle">
            {tx('Schedule, edit and remove lecture sessions. Lecturers mark student attendance against these sessions.')}
          </p>
        </div>
        <button type="button" className="btn btn-primary" onClick={openCreate}>
          <MdAdd /> {tx('Create session')}
        </button>
      </div>

      <div className="card" style={{ marginBottom: '1.25rem', padding: '1rem 1.25rem' }}>
        <div style={{ fontWeight: 700, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <MdSchedule /> {tx('Generate sessions from weekly timetable')}
        </div>
        <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginBottom: '0.75rem' }}>
          {tx('Creates concrete class sessions for every timetable slot in the date range (max 90 days). Existing sessions on the same day for the same course and lecturer are skipped.')}
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'flex-end' }}>
          <div>
            <label className="form-label" htmlFor="gen-from">{tx('From')}</label>
            <input
              id="gen-from"
              type="date"
              className="form-input"
              value={genFrom}
              onChange={(e) => setGenFrom(e.target.value)}
            />
          </div>
          <div>
            <label className="form-label" htmlFor="gen-to">{tx('To')}</label>
            <input
              id="gen-to"
              type="date"
              className="form-input"
              value={genTo}
              onChange={(e) => setGenTo(e.target.value)}
            />
          </div>
          <button
            type="button"
            className="btn btn-primary"
            disabled={generating || !genFrom || !genTo}
            onClick={handleGenerate}
          >
            {generating ? tx('Generating…') : tx('Generate sessions')}
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-header" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ position: 'relative', flex: '1 1 220px', minWidth: 200 }}>
            <MdSearch style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
            <input
              className="form-input"
              style={{ paddingLeft: 40 }}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={tx('Search course, batch, lecturer, room, topic…')}
            />
          </div>
          <select className="form-input" style={{ maxWidth: 180 }} value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="upcoming">{tx('Upcoming')}</option>
            <option value="past">{tx('Past')}</option>
            <option value="all">{tx('All sessions')}</option>
          </select>
        </div>

        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>{tx('Course')}</th>
                <th>{tx('Batch')}</th>
                <th>{tx('Lecturer')}</th>
                <th>{tx('Schedule')}</th>
                <th>{tx('Room')}</th>
                <th>{tx('Topic')}</th>
                <th>{tx('Online')}</th>
                <th style={{ textAlign: 'right' }}>{tx('Actions')}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '3rem' }}>
                    {tx('Loading sessions…')}
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '3rem' }}>
                    <div className="empty-state">
                      <MdSchedule className="empty-state-icon" />
                      <div className="empty-state-title">{tx('No class sessions found')}</div>
                      <div className="empty-state-text">{tx('Create a session, generate from the timetable, or adjust the filters.')}</div>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((session) => {
                  const isPast = new Date(session.scheduled_start).getTime() < now;
                  return (
                    <tr key={session.id} style={{ opacity: isPast ? 0.85 : 1 }}>
                      <td>
                        <strong style={{ color: 'var(--color-primary)' }}>
                          {session.batch_courses?.courses?.code}
                        </strong>{' '}
                        {session.batch_courses?.courses?.name}
                      </td>
                      <td>
                        {session.batch_courses?.batches?.name}
                        <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                          {session.batch_courses?.batches?.code}
                        </div>
                      </td>
                      <td>
                        {session.lecturers?.first_name} {session.lecturers?.last_name}
                      </td>
                      <td>
                        <div>{new Date(session.scheduled_start).toLocaleString()}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                          → {new Date(session.scheduled_end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          {isPast ? ' · past' : ' · upcoming'}
                        </div>
                      </td>
                      <td>{session.room || '—'}</td>
                      <td>{session.topic || '—'}</td>
                      <td>
                        {session.zoom_join_url ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <span style={{ fontSize: '0.65rem', background: '#2d8cff', color: '#fff', borderRadius: 4, padding: '2px 6px', fontWeight: 700, width: 'fit-content' }}>
                              ONLINE
                            </span>
                            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                              <a
                                href={session.zoom_start_url || session.zoom_join_url}
                                target="_blank"
                                rel="noreferrer"
                                className="btn btn-primary btn-sm"
                                style={{ fontSize: '0.7rem', padding: '0.15rem 0.4rem' }}
                              >
                                <MdVideocam size={12} /> Start
                              </a>
                              <button
                                type="button"
                                className="btn btn-outline btn-sm"
                                style={{ fontSize: '0.7rem', padding: '0.15rem 0.4rem' }}
                                disabled={zoomLoading === session.id}
                                onClick={() => handleRemoveZoom(session)}
                              >
                                <MdVideocamOff size={12} />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-outline btn-sm"
                            style={{ fontSize: '0.7rem' }}
                            disabled={zoomLoading === session.id}
                            onClick={() => handleAddZoom(session)}
                          >
                            <MdVideocam size={12} /> {zoomLoading === session.id ? '…' : 'Add Zoom'}
                          </button>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                          <button type="button" className="btn btn-outline btn-sm" onClick={() => openEdit(session)}>
                            <MdEdit /> {tx('Edit')}
                          </button>
                          <button
                            type="button"
                            className="btn btn-outline btn-sm"
                            title={tx('Delete')}
                            onClick={() => {
                              if (window.confirm(tx('Delete this class session? Attendance records for it will also be removed.'))) {
                                deleteMutation.mutate(session);
                              }
                            }}
                          >
                            <MdDelete />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        isOpen={open}
        onClose={closeModal}
        title={tx(editing ? 'Edit class session' : 'Create class session')}
        footer={
          <>
            <button type="button" className="btn btn-outline" onClick={closeModal}>
              {tx('Cancel')}
            </button>
            <button type="button" className="btn btn-primary" onClick={submit} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? tx('Loading...') : editing ? tx('Save changes') : tx('Create session')}
            </button>
          </>
        }
      >
        <form onSubmit={submit}>
          <div className="form-group">
            <label className="form-label">{tx('Batch course *')}</label>
            <select
              className="form-input"
              value={form.batch_course_id}
              onChange={(e) => onBatchCourseChange(e.target.value)}
              required
            >
              <option value="">{tx('Select course and batch')}</option>
              {batchCourses.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.courses?.code} — {item.courses?.name} ({item.batches?.name}
                  {item.semesters?.name ? `, ${item.semesters.name}` : ''})
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">{tx('Lecturer *')}</label>
            <select
              className="form-input"
              value={form.lecturer_id}
              onChange={(e) => setForm({ ...form, lecturer_id: e.target.value })}
              required
            >
              <option value="">{tx('Select lecturer')}</option>
              {lecturers.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.first_name} {item.last_name}
                  {item.staff_id ? ` (${item.staff_id})` : ''}
                </option>
              ))}
            </select>
            <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
              {tx('Selecting a batch course auto-fills the assigned lecturer when available.')}
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div className="form-group">
              <label className="form-label">{tx('Start')} *</label>
              <input
                className="form-input"
                type="datetime-local"
                value={form.scheduled_start}
                onChange={(e) => setForm({ ...form, scheduled_start: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">{tx('End')} *</label>
              <input
                className="form-input"
                type="datetime-local"
                value={form.scheduled_end}
                onChange={(e) => setForm({ ...form, scheduled_end: e.target.value })}
                required
              />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">{tx('Room')}</label>
            <input
              className="form-input"
              value={form.room}
              onChange={(e) => setForm({ ...form, room: e.target.value })}
              placeholder={tx('e.g. Hall A, Lab 2')}
            />
          </div>
          <div className="form-group">
            <label className="form-label">{tx('Topic')}</label>
            <input
              className="form-input"
              value={form.topic}
              onChange={(e) => setForm({ ...form, topic: e.target.value })}
              placeholder={tx('Lecture topic')}
            />
          </div>
          <div className="form-group">
            <label className="form-label">{tx('Notes')}</label>
            <textarea
              className="form-input"
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder={tx('Optional notes for staff')}
            />
          </div>
          {!editing && (
            <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <input
                id="admin-session-online"
                type="checkbox"
                style={{ width: 18, height: 18, cursor: 'pointer', accentColor: '#2d8cff' }}
                checked={form.is_online}
                onChange={(e) => setForm({ ...form, is_online: e.target.checked })}
              />
              <label htmlFor="admin-session-online" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, margin: 0 }}>
                <MdVideocam size={16} style={{ color: '#2d8cff' }} />
                <span style={{ fontWeight: 500 }}>{tx('Create Zoom meeting for this session')}</span>
              </label>
            </div>
          )}
        </form>
      </Modal>
    </AppLayout>
  );
}
