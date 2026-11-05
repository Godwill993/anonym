import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  MdAdd,
  MdAssignmentReturn,
  MdCheckCircle,
  MdDelete,
  MdEdit,
  MdSearch,
  MdSchedule,
  MdVideocam,
  MdVideocamOff,
} from 'react-icons/md';
import AppLayout from '../../components/layout/AppLayout';
import Modal from '../../components/common/Modal';
import RowActionsMenu from '../../components/common/RowActionsMenu';
import { toast } from '../../components/common/Toast';
import { useTranslation } from '../../i18n';
import {
  getBatchCourses,
  getClassSessions,
  createClassSessionAdmin,
  generateSessionsFromTimetable,
  updateClassSessionAdmin,
  deleteClassSessionAdmin,
  reviewClassSession,
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

export default function ClassSessionsPage() {
  const { translateText: tx } = useTranslation();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [approvalFilter, setApprovalFilter] = useState('pending');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [returnTarget, setReturnTarget] = useState(null);
  const [returnComment, setReturnComment] = useState('');
  const [zoomLoading, setZoomLoading] = useState(null);
  const [genOpen, setGenOpen] = useState(false);
  const [genForm, setGenForm] = useState({ from: '', to: '', batchCourseId: '' });
  const [formData, setFormData] = useState({
    batch_course_id: '',
    lecturer_id: '',
    scheduled_start: '',
    scheduled_end: '',
    room: '',
    topic: '',
    notes: '',
  });

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ['admin-class-sessions', approvalFilter],
    queryFn: () => getClassSessions({ limit: 300, approvalStatus: approvalFilter || null }),
  });

  const { data: batchCourses = [] } = useQuery({
    queryKey: ['admin-batch-courses'],
    queryFn: () => getBatchCourses(),
  });

  const { data: lecturers = [] } = useQuery({
    queryKey: ['admin-lecturers'],
    queryFn: () => getLecturers(),
  });

  const createMutation = useMutation({
    mutationFn: createClassSessionAdmin,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-class-sessions'] });
      toast.success(tx('Class session created'));
      setIsModalOpen(false);
      setEditing(null);
    },
    onError: (err) => toast.error(err.message || tx('Failed to create session')),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => updateClassSessionAdmin(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-class-sessions'] });
      toast.success(tx('Class session updated'));
      setIsModalOpen(false);
      setEditing(null);
    },
    onError: (err) => toast.error(err.message || tx('Failed to update session')),
  });

  const reviewMutation = useMutation({
    mutationFn: ({ id, status, comment }) => reviewClassSession(id, { status, comment }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin-class-sessions'] });
      toast.success(
        variables.status === 'approved'
          ? tx('Class session approved')
          : tx('Class session returned to lecturer'),
      );
      setReturnTarget(null);
      setReturnComment('');
    },
    onError: (err) => toast.error(err.message || tx('Could not review class session')),
  });

  const deleteMutation = useMutation({
    mutationFn: (session) => deleteClassSessionAdmin(session.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-class-sessions'] });
      toast.success(tx('Class session deleted'));
    },
    onError: (err) => toast.error(err.message || tx('Failed to delete session')),
  });

  const genMutation = useMutation({
    mutationFn: generateSessionsFromTimetable,
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['admin-class-sessions'] });
      toast.success(tx(`Generated ${count} session(s) from timetable`));
      setGenOpen(false);
    },
    onError: (err) => toast.error(err.message || tx('Failed to generate sessions')),
  });

  const openCreate = () => {
    setEditing(null);
    setFormData({
      batch_course_id: batchCourses[0]?.id || '',
      lecturer_id: '',
      scheduled_start: '',
      scheduled_end: '',
      room: '',
      topic: '',
      notes: '',
    });
    setIsModalOpen(true);
  };

  const openEdit = (session) => {
    setEditing(session);
    setFormData({
      batch_course_id: session.batch_course_id || session.batch_courses?.id || '',
      lecturer_id: session.lecturer_id || '',
      scheduled_start: toLocalInput(session.scheduled_start),
      scheduled_end: toLocalInput(session.scheduled_end),
      room: session.room || '',
      topic: session.topic || '',
      notes: session.notes || '',
    });
    setIsModalOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.batch_course_id || !formData.scheduled_start || !formData.scheduled_end) {
      toast.error(tx('Batch course, start, and end are required'));
      return;
    }
    if (editing) {
      updateMutation.mutate({ id: editing.id, payload: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleReturnSession = () => {
    if (!returnTarget || !returnComment.trim()) {
      toast.error(tx('A reason is required when returning a class session'));
      return;
    }
    reviewMutation.mutate({
      id: returnTarget.id,
      status: 'returned',
      comment: returnComment.trim(),
    });
  };

  const handleAddZoom = async (session) => {
    if (!session?.id) return;
    try {
      setZoomLoading(session.id);
      const start = new Date(session.scheduled_start);
      const end = new Date(session.scheduled_end);
      const durationMinutes = Math.max(
        15,
        Math.round((end.getTime() - start.getTime()) / 60000) || 60,
      );
      const courseName = session.batch_courses?.courses?.name;
      await createZoomMeeting({
        sessionId: session.id,
        topic: session.topic || courseName || 'Online Class',
        scheduledStart: session.scheduled_start,
        durationMinutes,
      });
      queryClient.invalidateQueries({ queryKey: ['admin-class-sessions'] });
      toast.success(tx('Zoom meeting created'));
    } catch (err) {
      toast.error(err.message || tx('Failed to create Zoom meeting'));
    } finally {
      setZoomLoading(null);
    }
  };

  const handleRemoveZoom = async (session) => {
    if (!session?.zoom_meeting_id) {
      toast.error(tx('No Zoom meeting linked to this session'));
      return;
    }
    try {
      setZoomLoading(session.id);
      await deleteZoomMeeting({
        zoomMeetingId: session.zoom_meeting_id,
        sessionId: session.id,
      });
      queryClient.invalidateQueries({ queryKey: ['admin-class-sessions'] });
      toast.success(tx('Zoom meeting removed'));
    } catch (err) {
      toast.error(err.message || tx('Failed to remove Zoom meeting'));
    } finally {
      setZoomLoading(null);
    }
  };

  const filtered = useMemo(() => {
    const s = search.toLowerCase();
    if (!s) return sessions;
    return sessions.filter((session) => {
      const course = session.batch_courses?.courses;
      const batch = session.batch_courses?.batches;
      const lec = session.lecturers || session.batch_courses?.lecturers;
      return (
        course?.code?.toLowerCase().includes(s) ||
        course?.name?.toLowerCase().includes(s) ||
        batch?.name?.toLowerCase().includes(s) ||
        session.room?.toLowerCase().includes(s) ||
        session.topic?.toLowerCase().includes(s) ||
        (lec && `${lec.first_name} ${lec.last_name}`.toLowerCase().includes(s))
      );
    });
  }, [sessions, search]);

  return (
    <AppLayout pageTitle={tx('Class Sessions')}>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">{tx('Class Sessions')}</h1>
          <p className="page-subtitle">{tx('Review lecturer session requests and manage scheduled teaching sessions')}</p>
        </div>
        <div className="page-header-actions">
          <button type="button" className="btn btn-outline btn-sm" onClick={() => setGenOpen(true)}>
            <MdSchedule /> {tx('From timetable')}
          </button>
          <button type="button" className="btn btn-primary btn-sm" onClick={openCreate}>
            <MdAdd /> {tx('Add session')}
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div style={{ position: 'relative', minWidth: '240px', flex: '1 1 200px' }}>
            <MdSearch style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
            <input
              type="text"
              className="form-input"
              style={{ paddingLeft: '2.25rem' }}
              placeholder={tx('Search by course, batch, room, topic...')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            className="form-input"
            style={{ maxWidth: 220 }}
            value={approvalFilter}
            onChange={(event) => setApprovalFilter(event.target.value)}
            aria-label={tx('Filter by session approval')}
          >
            <option value="pending">{tx('Pending approval')}</option>
            <option value="approved">{tx('Approved sessions')}</option>
            <option value="returned">{tx('Returned sessions')}</option>
            <option value="">{tx('All sessions')}</option>
          </select>
        </div>

        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>{tx('Course / Batch')}</th>
                <th>{tx('Lecturer')}</th>
                <th>{tx('When')}</th>
                <th>{tx('Room')}</th>
                <th>{tx('Topic')}</th>
                <th>{tx('Approval')}</th>
                <th>{tx('Online')}</th>
                <th style={{ textAlign: 'right' }}>{tx('Actions')}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan="8" style={{ textAlign: 'center', padding: '3rem' }}>{tx('Loading sessions...')}</td></tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '3rem' }}>
                    <div className="empty-state">
                      <MdSchedule className="empty-state-icon" />
                      <div className="empty-state-title">{tx('No class sessions')}</div>
                      <div className="empty-state-text">{tx('Create a session or generate from the timetable.')}</div>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((session) => {
                  const course = session.batch_courses?.courses;
                  const batch = session.batch_courses?.batches;
                  const lec = session.lecturers || session.batch_courses?.lecturers;
                  const isPast = session.scheduled_end && new Date(session.scheduled_end) < new Date();
                  return (
                    <tr key={session.id}>
                      <td>
                        <div>
                          <code style={{ fontWeight: 700 }}>{course?.code}</code>{' '}
                          <strong>{course?.name}</strong>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{batch?.name}</div>
                      </td>
                      <td>{lec ? `${lec.first_name} ${lec.last_name}` : '—'}</td>
                      <td>
                        <div>{session.scheduled_start ? new Date(session.scheduled_start).toLocaleString() : '—'}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                          → {session.scheduled_end ? new Date(session.scheduled_end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                          {isPast ? ` · ${tx('past')}` : ` · ${tx('upcoming')}`}
                        </div>
                      </td>
                      <td>{session.room || '—'}</td>
                      <td>{session.topic || '—'}</td>
                      <td>
                        <span className={`badge ${
                          session.approval_status === 'approved'
                            ? 'badge-green'
                            : session.approval_status === 'returned'
                              ? 'badge-red'
                              : 'badge-amber'
                        }`}>
                          {tx(session.approval_status || 'approved')}
                        </span>
                        {session.approval_comment && (
                          <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
                            {session.approval_comment}
                          </div>
                        )}
                      </td>
                      <td>
                        {session.zoom_join_url ? (
                          <span style={{ fontSize: '0.65rem', background: '#2d8cff', color: '#fff', borderRadius: 4, padding: '2px 6px', fontWeight: 700, width: 'fit-content', display: 'inline-block' }}>ONLINE</span>
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>—</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {session.approval_status === 'pending' ? (
                          <div style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              disabled={reviewMutation.isPending}
                              onClick={() => reviewMutation.mutate({ id: session.id, status: 'approved' })}
                            >
                              <MdCheckCircle /> {tx('Approve')}
                            </button>
                            <button
                              type="button"
                              className="btn btn-outline btn-sm"
                              disabled={reviewMutation.isPending}
                              onClick={() => {
                                setReturnTarget(session);
                                setReturnComment('');
                              }}
                            >
                              <MdAssignmentReturn /> {tx('Return')}
                            </button>
                          </div>
                        ) : (
                          <RowActionsMenu
                          ariaLabel={tx('Session actions')}
                          items={[
                            {
                              id: 'start-zoom',
                              label: tx('Start Zoom'),
                              icon: <MdVideocam />,
                              hidden: !session.zoom_join_url,
                              onClick: () => {
                                const url = session.zoom_start_url || session.zoom_join_url;
                                if (url) window.open(url, '_blank', 'noopener,noreferrer');
                              },
                            },
                            {
                              id: 'add-zoom',
                              label: zoomLoading === session.id ? '…' : tx('Add Zoom'),
                              icon: <MdVideocam />,
                              hidden: Boolean(session.zoom_join_url),
                              disabled: zoomLoading === session.id,
                              onClick: () => handleAddZoom(session),
                            },
                            {
                              id: 'remove-zoom',
                              label: tx('Remove Zoom'),
                              icon: <MdVideocamOff />,
                              hidden: !session.zoom_join_url,
                              disabled: zoomLoading === session.id,
                              onClick: () => handleRemoveZoom(session),
                            },
                            {
                              id: 'edit',
                              label: tx('Edit'),
                              icon: <MdEdit />,
                              onClick: () => openEdit(session),
                            },
                            {
                              id: 'delete',
                              label: tx('Delete'),
                              icon: <MdDelete />,
                              danger: true,
                              onClick: () => {
                                if (window.confirm(tx('Delete this class session? Attendance records for it will also be removed.'))) {
                                  deleteMutation.mutate(session);
                                }
                              },
                            },
                          ]}
                          />
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {returnTarget && (
        <Modal
          isOpen
          onClose={() => {
            setReturnTarget(null);
            setReturnComment('');
          }}
          title={tx('Return session request')}
        >
          <p>
            {tx('Explain what the lecturer should change before resubmitting this session.')}
          </p>
          <div className="form-group">
            <label className="form-label">{tx('Reason')} *</label>
            <textarea
              className="form-input"
              rows={4}
              value={returnComment}
              onChange={(event) => setReturnComment(event.target.value)}
              required
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button type="button" className="btn btn-outline" onClick={() => setReturnTarget(null)}>
              {tx('Cancel')}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!returnComment.trim() || reviewMutation.isPending}
              onClick={handleReturnSession}
            >
              <MdAssignmentReturn /> {tx('Return to lecturer')}
            </button>
          </div>
        </Modal>
      )}

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editing ? tx('Edit class session') : tx('Add class session')}>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">{tx('Batch course')} *</label>
            <select className="form-input" value={formData.batch_course_id} onChange={(e) => setFormData({ ...formData, batch_course_id: e.target.value })} required>
              <option value="">{tx('Choose...')}</option>
              {batchCourses.map((bc) => (
                <option key={bc.id} value={bc.id}>{bc.courses?.code} — {bc.batches?.name} ({bc.semesters?.name})</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">{tx('Lecturer')}</label>
            <select className="form-input" value={formData.lecturer_id} onChange={(e) => setFormData({ ...formData, lecturer_id: e.target.value })}>
              <option value="">{tx('Optional')}</option>
              {lecturers.map((l) => (
                <option key={l.id} value={l.id}>{l.first_name} {l.last_name}</option>
              ))}
            </select>
          </div>
          <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div className="form-group">
              <label className="form-label">{tx('Start')} *</label>
              <input type="datetime-local" className="form-input" value={formData.scheduled_start} onChange={(e) => setFormData({ ...formData, scheduled_start: e.target.value })} required />
            </div>
            <div className="form-group">
              <label className="form-label">{tx('End')} *</label>
              <input type="datetime-local" className="form-input" value={formData.scheduled_end} onChange={(e) => setFormData({ ...formData, scheduled_end: e.target.value })} required />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">{tx('Room')}</label>
            <input className="form-input" value={formData.room} onChange={(e) => setFormData({ ...formData, room: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">{tx('Topic')}</label>
            <input className="form-input" value={formData.topic} onChange={(e) => setFormData({ ...formData, topic: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">{tx('Notes')}</label>
            <textarea className="form-input" rows={2} value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
            <button type="button" className="btn btn-outline" onClick={() => setIsModalOpen(false)}>{tx('Cancel')}</button>
            <button type="submit" className="btn btn-primary" disabled={createMutation.isPending || updateMutation.isPending}>
              {editing ? tx('Save Changes') : tx('Add session')}
            </button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={genOpen} onClose={() => setGenOpen(false)} title={tx('Generate from timetable')}>
        <form onSubmit={(e) => { e.preventDefault(); genMutation.mutate({ from: genForm.from, to: genForm.to, batchCourseId: genForm.batchCourseId || null }); }}>
          <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div className="form-group">
              <label className="form-label">{tx('From')} *</label>
              <input type="date" className="form-input" value={genForm.from} onChange={(e) => setGenForm({ ...genForm, from: e.target.value })} required />
            </div>
            <div className="form-group">
              <label className="form-label">{tx('To')} *</label>
              <input type="date" className="form-input" value={genForm.to} onChange={(e) => setGenForm({ ...genForm, to: e.target.value })} required />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">{tx('Batch course (optional)')}</label>
            <select className="form-input" value={genForm.batchCourseId} onChange={(e) => setGenForm({ ...genForm, batchCourseId: e.target.value })}>
              <option value="">{tx('All')}</option>
              {batchCourses.map((bc) => (
                <option key={bc.id} value={bc.id}>{bc.courses?.code} — {bc.batches?.name}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
            <button type="button" className="btn btn-outline" onClick={() => setGenOpen(false)}>{tx('Cancel')}</button>
            <button type="submit" className="btn btn-primary" disabled={genMutation.isPending}>{tx('Generate')}</button>
          </div>
        </form>
      </Modal>
    </AppLayout>
  );
}
