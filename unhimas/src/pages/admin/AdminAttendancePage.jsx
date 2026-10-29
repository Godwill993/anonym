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
  if (error) {
    const msg = error.message || '';
    if (/attendance_status/i.test(msg) || error.code === '42703') {
      throw new Error(
        'Database is missing attendance approval columns. Run APPLY_ATTENDANCE_WORKFLOW.sql in Supabase SQL editor.',
      );
    }
    throw error;
  }
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

  const {
    data: sessions = [],
    isError: sessionsError,
    error: sessionsErrorObj,
    refetch: refetchSessions,
  } = useQuery({
    queryKey: ['admin-class-sessions-attendance', sessionStatusFilter],
    queryFn: async () => {
      let q = supabase
        .from('class_sessions')
        .select('*, batch_courses (courses (code, name), batches (name, code)), lecturers (first_name, last_name)')
        .order('scheduled_start', { ascending: false })
        .limit(150);
      if (sessionStatusFilter) q = q.eq('attendance_status', sessionStatusFilter);
      const { data, error } = await q;
      if (error) {
        const msg = error.message || '';
        if (/attendance_status/i.test(msg) || error.code === '42703') {
          throw new Error(
            'Database is missing attendance approval columns. In Supabase SQL editor, run APPLY_ATTENDANCE_WORKFLOW.sql (or migrations 20261029000000 + 20261029000001).',
          );
        }
        throw error;
      }
      return data || [];
    },
    retry: 1,
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
      toast.success(
        v.status === 'approved'
          ? translateText('Attendance approved')
          : translateText('Attendance returned to lecturer'),
      );
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

  const sessionColumns = useMemo(
    () => [
      {
        header: translateText('Course'),
        accessorFn: (r) =>
          `${r.batch_courses?.courses?.code || '—'} — ${r.batch_courses?.courses?.name || ''}`,
      },
      {
        header: translateText('Batch'),
        accessorFn: (r) => r.batch_courses?.batches?.name || '—',
      },
      {
        header: translateText('Lecturer'),
        accessorFn: (r) =>
          r.lecturers ? `${r.lecturers.first_name || ''} ${r.lecturers.last_name || ''}`.trim() : '—',
      },
      {
        header: translateText('When'),
        accessorFn: (r) =>
          r.scheduled_start
            ? new Date(r.scheduled_start).toLocaleString('en-GB', {
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
              })
            : '—',
      },
      {
        header: translateText('Status'),
        cell: ({ row }) => statusBadge(row.original.attendance_status),
      },
      {
        header: translateText('Actions'),
        cell: ({ row }) => {
          const s = row.original;
          const canReview = s.attendance_status === 'submitted';
          return (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDetailSession(s)}>
                {translateText('View')}
              </button>
              {canReview && (
                <>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    disabled={reviewMutation.isPending}
                    onClick={() => reviewMutation.mutate({ id: s.id, status: 'approved' })}
                  >
                    <MdCheckCircle /> {translateText('Approve')}
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => {
                      setReturnTarget(s);
                      setReturnComment('');
                      setReturnModal(true);
                    }}
                  >
                    <MdAssignmentReturn /> {translateText('Return')}
                  </button>
                </>
              )}
            </div>
          );
        },
      },
    ],
    [translateText, reviewMutation.isPending],
  );

  return (
    <AppLayout pageTitle="Attendance & Presence">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">{translateText('Attendance & Shift Records')}</h1>
          <p className="page-subtitle">
            {translateText('Approve lecturer-submitted class attendance and track faculty clock-ins')}
          </p>
        </div>
        <div className="page-header-actions">
          <div
            style={{
              display: 'inline-flex',
              background: 'var(--color-bg)',
              padding: '4px',
              borderRadius: 'var(--radius-sm)',
            }}
          >
            <button
              type="button"
              className={`btn btn-sm ${activeTab === 'sessions' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setActiveTab('sessions')}
            >
              <MdHowToReg /> {translateText('Class Sessions')}
            </button>
            <button
              type="button"
              className={`btn btn-sm ${activeTab === 'shifts' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setActiveTab('shifts')}
            >
              <MdAccessTime /> {translateText('Clock-ins')}
            </button>
          </div>
        </div>
      </div>

      {sessionsError && (
        <div className="alert-banner alert-banner-danger" role="alert" style={{ marginBottom: '1.25rem' }}>
          <div style={{ flex: 1 }}>
            <strong>{translateText('Attendance approval is not available yet')}</strong>
            <div style={{ marginTop: 4, fontSize: '0.875rem' }}>
              {sessionsErrorObj?.message ||
                translateText('Apply the attendance workflow migrations in Supabase.')}
            </div>
          </div>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => refetchSessions()}>
            {translateText('Retry')}
          </button>
        </div>
      )}

      {activeTab === 'sessions' && (
        <div className="card">
          <div className="card-header" style={{ flexWrap: 'wrap', gap: 8 }}>
            <span className="card-title">{translateText('Class attendance for review')}</span>
            <select
              className="form-select"
              style={{ maxWidth: 200 }}
              value={sessionStatusFilter}
              onChange={(e) => setSessionStatusFilter(e.target.value)}
            >
              <option value="submitted">{translateText('Awaiting Approval')}</option>
              <option value="returned">{translateText('Returned')}</option>
              <option value="approved">{translateText('Approved')}</option>
              <option value="">{translateText('All')}</option>
            </select>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {!sessionsError && (
              <DataTable columns={sessionColumns} data={sessions} emptyMessage={translateText('No sessions in this filter')} />
            )}
          </div>
        </div>
      )}

      {activeTab === 'shifts' && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">{translateText('Faculty campus clock-ins')}</span>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            <DataTable
              columns={[
                {
                  header: translateText('Lecturer'),
                  accessorFn: (r) =>
                    r.lecturers
                      ? `${r.lecturers.first_name || ''} ${r.lecturers.last_name || ''}`.trim()
                      : '—',
                },
                {
                  header: translateText('Staff ID'),
                  accessorFn: (r) => r.lecturers?.staff_id || '—',
                },
                {
                  header: translateText('Clock In'),
                  accessorFn: (r) =>
                    r.clock_in ? new Date(r.clock_in).toLocaleString('en-GB') : '—',
                },
                {
                  header: translateText('Clock Out'),
                  accessorFn: (r) =>
                    r.clock_out ? new Date(r.clock_out).toLocaleString('en-GB') : '—',
                },
                {
                  header: translateText('Status'),
                  accessorFn: (r) => r.status || '—',
                },
              ]}
              data={shifts}
              emptyMessage={translateText('No clock-in records')}
            />
          </div>
        </div>
      )}

      <Modal
        open={returnModal}
        onClose={() => {
          setReturnModal(false);
          setReturnTarget(null);
        }}
        title={translateText('Return attendance to lecturer')}
      >
        <p className="page-subtitle" style={{ marginBottom: '0.75rem' }}>
          {translateText('Add a short comment so the lecturer knows what to fix.')}
        </p>
        <textarea
          className="form-textarea"
          rows={4}
          value={returnComment}
          onChange={(e) => setReturnComment(e.target.value)}
          placeholder={translateText('Administrator review comment')}
        />
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: '1rem' }}>
          <button type="button" className="btn btn-ghost" onClick={() => setReturnModal(false)}>
            {translateText('Cancel')}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={reviewMutation.isPending || !returnTarget}
            onClick={() =>
              reviewMutation.mutate({
                id: returnTarget.id,
                status: 'returned',
                admin_comment: returnComment.trim() || null,
              })
            }
          >
            {translateText('Return')}
          </button>
        </div>
      </Modal>

      <Modal
        open={Boolean(detailSession)}
        onClose={() => setDetailSession(null)}
        title={translateText('Session attendance detail')}
      >
        {detailSession && (
          <>
            <p className="page-subtitle" style={{ marginBottom: '0.75rem' }}>
              {detailSession.batch_courses?.courses?.code} —{' '}
              {detailSession.batch_courses?.courses?.name}
              {' · '}
              {statusBadge(detailSession.attendance_status)}
            </p>
            {detailLoading ? (
              <p>{translateText('Loading...')}</p>
            ) : detailRecords.length === 0 ? (
              <p className="empty-state-text">{translateText('No attendance rows for this session')}</p>
            ) : (
              <div style={{ maxHeight: 360, overflow: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>{translateText('Matricule')}</th>
                      <th>{translateText('Student')}</th>
                      <th>{translateText('Status')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailRecords.map((r) => (
                      <tr key={r.id}>
                        <td>{r.students?.matricule}</td>
                        <td>
                          {r.students?.first_name} {r.students?.last_name}
                        </td>
                        <td>{translateText(r.status)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {detailSession.attendance_status === 'submitted' && (
              <div style={{ display: 'flex', gap: 8, marginTop: '1rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={reviewMutation.isPending}
                  onClick={() =>
                    reviewMutation.mutate({ id: detailSession.id, status: 'approved' })
                  }
                >
                  {translateText('Approve')}
                </button>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => {
                    setReturnTarget(detailSession);
                    setReturnComment('');
                    setReturnModal(true);
                  }}
                >
                  {translateText('Return')}
                </button>
              </div>
            )}
          </>
        )}
      </Modal>
    </AppLayout>
  );
}
