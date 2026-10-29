import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MdHowToReg, MdAccessTime, MdCheckCircle, MdAssignmentReturn } from 'react-icons/md';
import AppLayout from '../../components/layout/AppLayout';
import DataTable from '../../components/common/DataTable';
import Modal from '../../components/common/Modal';
import { toast } from '../../components/common/Toast';
import { supabase } from '../../lib/supabase';
import { useTranslation } from '../../i18n';
import { useAuth } from '../../context/AuthContext';

async function reviewSessionAttendance(sessionId, { status, admin_comment, reviewed_by }) {
  const { data, error } = await supabase
    .from('class_sessions')
    .update({
      attendance_status: status,
      attendance_reviewed_at: new Date().toISOString(),
      attendance_reviewed_by: reviewed_by || null,
      attendance_admin_comment: admin_comment || null,
    })
    .eq('id', sessionId)
    .eq('attendance_status', 'submitted')
    .select()
    .single();
  if (error) throw error;
  return data;
}

export default function AdminAttendancePage() {
  const { translateText } = useTranslation();
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('sessions');
  const [sessionStatusFilter, setSessionStatusFilter] = useState('submitted');
  const [returnModal, setReturnModal] = useState(false);
  const [returnTarget, setReturnTarget] = useState(null);
  const [returnComment, setReturnComment] = useState('');
  const [detailSession, setDetailSession] = useState(null);

  const { data: shifts = [] } = useQuery({
    queryKey: ['admin-attendance-shifts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lecturer_shifts')
        .select('*, lecturers (staff_id, first_name, last_name, departments (abbreviation))')
        .order('clock_in', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: sessions = [] } = useQuery({
    queryKey: ['admin-class-sessions-attendance', sessionStatusFilter],
    queryFn: async () => {
      let q = supabase
        .from('class_sessions')
        .select('*, batch_courses (courses (code, name), batches (name, code)), lecturers (first_name, last_name)')
        .order('scheduled_start', { ascending: false })
        .limit(150);
      if (sessionStatusFilter) q = q.eq('attendance_status', sessionStatusFilter);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  const { data: detailRecords = [], isLoading: detailLoading } = useQuery({
    queryKey: ['admin-session-attendance-detail', detailSession?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('attendance')
        .select('*, students:student_id (matricule, first_name, last_name)')
        .eq('session_id', detailSession.id);
      if (error) throw error;
      return data || [];
    },
    enabled: Boolean(detailSession?.id),
  });

  const reviewMutation = useMutation({
    mutationFn: ({ id, status, admin_comment }) =>
      reviewSessionAttendance(id, { status, admin_comment, reviewed_by: profile?.id }),
    onSuccess: (_d, v) => {
      queryClient.invalidateQueries({ queryKey: ['admin-class-sessions-attendance'] });
      queryClient.invalidateQueries({ queryKey: ['admin-session-attendance-detail'] });
      toast.success(v.status === 'approved' ? translateText('Attendance approved') : translateText('Attendance returned to lecturer'));
      setReturnModal(false);
      setReturnTarget(null);
      setReturnComment('');
      setDetailSession(null);
    },
    onError: (err) => toast.error(err.message || 'Review failed'),
  });

  const statusBadge = (status) => {
    const map = {
      draft: ['badge-gray', 'Draft'],
      submitted: ['badge-amber', 'Awaiting Approval'],
      returned: ['badge-red', 'Returned'],
      approved: ['badge-green', 'Approved'],
    };
    const [cls, label] = map[status] || ['badge-gray', status || '—'];
    return <span className={`badge ${cls}`}>{translateText(label)}</span>;
  };

  const shiftColumns = useMemo(() => [
    { header: 'Lecturer', accessor: 'lecturer_name', sortValue: (s) => `${s.lecturers?.first_name} ${s.lecturers?.last_name}`,
      render: (s) => (<div><strong>{s.lecturers?.first_name} {s.lecturers?.last_name}</strong><div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>ID: {s.lecturers?.staff_id}</div></div>) },
    { header: 'Department', accessor: 'dept', render: (s) => <span>{s.lecturers?.departments?.abbreviation || '—'}</span> },
    { header: 'Clock In', accessor: 'clock_in', sortValue: (s) => new Date(s.clock_in).getTime(), render: (s) => <span>{new Date(s.clock_in).toLocaleString()}</span> },
    { header: 'Clock Out', accessor: 'clock_out', render: (s) => <span>{s.clock_out ? new Date(s.clock_out).toLocaleString() : '—'}</span> },
    { header: 'Status', accessor: 'status', render: (s) => <span className={`badge ${s.status === 'open' ? 'badge-green' : 'badge-blue'}`}>{s.status?.toUpperCase()}</span> },
  ], []);

  const sessionColumns = useMemo(() => [
    { header: 'Course', accessor: 'course_code', sortValue: (s) => s.batch_courses?.courses?.code || '',
      render: (s) => (<div><code style={{ fontWeight: 700, color: 'var(--color-primary)' }}>{s.batch_courses?.courses?.code}</code> <strong>{s.batch_courses?.courses?.name}</strong></div>) },
    { header: 'Batch', accessor: 'batch_name', render: (s) => <span>{s.batch_courses?.batches?.name}</span> },
    { header: 'Lecturer', accessor: 'lecturer', render: (s) => <span>{s.lecturers?.first_name} {s.lecturers?.last_name}</span> },
    { header: 'Scheduled', accessor: 'scheduled_start', sortValue: (s) => new Date(s.scheduled_start).getTime(), render: (s) => <span>{new Date(s.scheduled_start).toLocaleString()}</span> },
    { header: 'Attendance', accessor: 'attendance_status', render: (s) => statusBadge(s.attendance_status || 'draft') },
    { header: 'Actions', accessor: 'actions', render: (s) => (
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button type="button" className="btn btn-outline btn-sm" onClick={() => setDetailSession(s)}>View</button>
        {s.attendance_status === 'submitted' && (
          <>
            <button type="button" className="btn btn-primary btn-sm" style={{ background: '#059669' }} onClick={() => reviewMutation.mutate({ id: s.id, status: 'approved' })} disabled={reviewMutation.isPending}><MdCheckCircle /> Approve</button>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => { setReturnTarget(s); setReturnComment(''); setReturnModal(true); }}><MdAssignmentReturn /> Return</button>
          </>
        )}
      </div>
    ) },
  ], [reviewMutation.isPending, translateText]);

  return (
    <AppLayout pageTitle="Attendance & Presence">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">{translateText('Attendance & Shift Records')}</h1>
          <p className="page-subtitle">{translateText('Approve lecturer-submitted class attendance and track faculty clock-ins')}</p>
        </div>
        <div className="page-header-actions">
          <div style={{ display: 'inline-flex', background: 'var(--color-bg)', padding: '4px', borderRadius: 'var(--radius-sm)' }}>
            <button type="button" className={`btn btn-sm ${activeTab === 'sessions' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setActiveTab('sessions')}><MdHowToReg /> {translateText('Class Sessions')}</button>
            <button type="button" className={`btn btn-sm ${activeTab === 'lecturers' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setActiveTab('lecturers')}><MdAccessTime /> {translateText('Lecturer Shifts')}</button>
          </div>
        </div>
      </div>

      {activeTab === 'sessions' && (
        <div className="card" style={{ marginBottom: '1rem', padding: '0.75rem 1rem' }}>
          <label className="form-label" style={{ marginRight: 8 }}>{translateText('Filter by attendance status')}</label>
          <select className="form-input" style={{ maxWidth: 280 }} value={sessionStatusFilter} onChange={(e) => setSessionStatusFilter(e.target.value)}>
            <option value="submitted">{translateText('Awaiting Approval (Submitted)')}</option>
            <option value="approved">{translateText('Approved')}</option>
            <option value="returned">{translateText('Returned')}</option>
            <option value="draft">{translateText('Draft (not submitted)')}</option>
            <option value="">{translateText('All')}</option>
          </select>
        </div>
      )}

      {activeTab === 'lecturers' ? (
        <DataTable columns={shiftColumns} data={shifts} searchPlaceholder="Search shifts..." emptyTitle="No Shift Records" emptySubtitle="Front desk shifts appear here." pageSize={15} exportable exportFileName="unhimas_lecturer_shifts" />
      ) : (
        <DataTable columns={sessionColumns} data={sessions} searchPlaceholder="Search sessions..." emptyTitle="No Class Sessions" emptySubtitle="Submitted attendance appears here for approval." pageSize={15} exportable exportFileName="unhimas_class_sessions" />
      )}

      <Modal isOpen={Boolean(detailSession)} onClose={() => setDetailSession(null)} title={detailSession ? `Attendance — ${detailSession.batch_courses?.courses?.code || 'Session'}` : 'Attendance'}
        footer={detailSession?.attendance_status === 'submitted' ? (
          <>
            <button type="button" className="btn btn-outline" onClick={() => setDetailSession(null)}>Close</button>
            <button type="button" className="btn btn-outline" onClick={() => { setReturnTarget(detailSession); setReturnComment(''); setReturnModal(true); }}><MdAssignmentReturn /> Return</button>
            <button type="button" className="btn btn-primary" style={{ background: '#059669' }} disabled={reviewMutation.isPending} onClick={() => reviewMutation.mutate({ id: detailSession.id, status: 'approved' })}><MdCheckCircle /> Approve</button>
          </>
        ) : (
          <button type="button" className="btn btn-outline" onClick={() => setDetailSession(null)}>Close</button>
        )}
      >
        {detailLoading ? <p>Loading…</p> : detailRecords.length === 0 ? <p>No attendance rows marked yet.</p> : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead><tr><th>Matricule</th><th>Name</th><th>Status</th></tr></thead>
              <tbody>
                {detailRecords.map((r) => (
                  <tr key={r.id}><td>{r.students?.matricule}</td><td>{r.students?.first_name} {r.students?.last_name}</td><td><span className="badge badge-blue">{r.status}</span></td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>

      <Modal isOpen={returnModal} onClose={() => { setReturnModal(false); setReturnTarget(null); setReturnComment(''); }} title={translateText('Return attendance to lecturer')}
        footer={
          <>
            <button type="button" className="btn btn-outline" onClick={() => setReturnModal(false)}>Cancel</button>
            <button type="button" className="btn btn-primary" disabled={!returnComment.trim() || reviewMutation.isPending} onClick={() => reviewMutation.mutate({ id: returnTarget.id, status: 'returned', admin_comment: returnComment.trim() })}>Return with comment</button>
          </>
        }
      >
        <p style={{ marginBottom: '0.75rem', fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>Explain what the lecturer must fix. They will see this comment and can resubmit.</p>
        <textarea className="form-input" rows={4} value={returnComment} onChange={(e) => setReturnComment(e.target.value)} placeholder="Required feedback for the lecturer…" />
      </Modal>
    </AppLayout>
  );
}
