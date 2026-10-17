import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MdHowToReg, MdAccessTime } from 'react-icons/md';
import AppLayout from '../../components/layout/AppLayout';
import DataTable from '../../components/common/DataTable';
import { supabase } from '../../lib/supabase';
import { useTranslation } from '../../i18n';

export default function AdminAttendancePage() {
  const { translateText } = useTranslation();
  const [activeTab, setActiveTab] = useState('lecturers'); // 'lecturers' | 'sessions'

  // Lecturer shifts query
  const { data: shifts = [], isLoading: shiftsLoading } = useQuery({
    queryKey: ['admin-attendance-shifts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lecturer_shifts')
        .select(`
          *,
          lecturers (
            staff_id,
            first_name,
            last_name,
            departments (
              abbreviation
            )
          )
        `)
        .order('clock_in', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data || [];
    },
  });

  // Class sessions attendance query
  const { data: sessions = [], isLoading: sessionsLoading } = useQuery({
    queryKey: ['admin-class-sessions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('class_sessions')
        .select(`
          *,
          batch_courses (
            courses (
              code,
              name
            ),
            batches (
              name,
              code
            )
          ),
          lecturers (
            first_name,
            last_name
          )
        `)
        .order('scheduled_start', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data || [];
    },
  });

  const shiftColumns = useMemo(
    () => [
      {
        header: 'Lecturer',
        accessor: 'lecturer_name',
        sortValue: (s) => `${s.lecturers?.first_name} ${s.lecturers?.last_name}`,
        render: (s) => (
          <div>
            <strong>{s.lecturers?.first_name} {s.lecturers?.last_name}</strong>
            <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
              ID: {s.lecturers?.staff_id}
            </div>
          </div>
        ),
      },
      {
        header: 'Department',
        accessor: 'dept',
        sortValue: (s) => s.lecturers?.departments?.abbreviation || '',
        render: (s) => <span>{s.lecturers?.departments?.abbreviation || '—'}</span>,
      },
      {
        header: 'Clock In',
        accessor: 'clock_in',
        sortValue: (s) => new Date(s.clock_in).getTime(),
        render: (s) => <span>{new Date(s.clock_in).toLocaleString()}</span>,
      },
      {
        header: 'Clock Out',
        accessor: 'clock_out',
        sortValue: (s) => (s.clock_out ? new Date(s.clock_out).getTime() : 0),
        render: (s) => <span>{s.clock_out ? new Date(s.clock_out).toLocaleString() : '—'}</span>,
      },
      {
        header: 'Duration (Hours)',
        accessor: 'duration',
        sortValue: (s) => {
          if (!s.clock_out) return 9999;
          return (new Date(s.clock_out) - new Date(s.clock_in)) / (1000 * 60 * 60);
        },
        render: (s) => {
          if (!s.clock_out) return <span className="badge badge-amber">Active Shift</span>;
          const diff = (new Date(s.clock_out) - new Date(s.clock_in)) / (1000 * 60 * 60);
          return <strong>{diff.toFixed(2)} hrs</strong>;
        },
      },
      {
        header: 'Status',
        accessor: 'status',
        render: (s) => (
          <span className={`badge ${s.status === 'open' ? 'badge-green' : 'badge-blue'}`}>
            {s.status?.toUpperCase()}
          </span>
        ),
      },
    ],
    []
  );

  const sessionColumns = useMemo(
    () => [
      {
        header: 'Course',
        accessor: 'course_code',
        sortValue: (s) => s.batch_courses?.courses?.code || '',
        render: (s) => (
          <div>
            <code style={{ fontSize: '0.85rem', background: 'var(--color-bg)', padding: '2px 6px', borderRadius: '4px', fontWeight: 700, color: 'var(--color-primary)' }}>
              {s.batch_courses?.courses?.code}
            </code>{' '}
            <strong>{s.batch_courses?.courses?.name}</strong>
          </div>
        ),
      },
      {
        header: 'Cohort / Batch',
        accessor: 'batch_name',
        sortValue: (s) => s.batch_courses?.batches?.name || '',
        render: (s) => (
          <div>
            <div>{s.batch_courses?.batches?.name}</div>
            <code style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
              {s.batch_courses?.batches?.code}
            </code>
          </div>
        ),
      },
      {
        header: 'Lecturer',
        accessor: 'lecturer',
        sortValue: (s) => `${s.lecturers?.first_name} ${s.lecturers?.last_name}`,
        render: (s) => <span>{s.lecturers?.first_name} {s.lecturers?.last_name}</span>,
      },
      {
        header: 'Room / Venue',
        accessor: 'room',
        render: (s) => <span>{s.room || 'General Hall'}</span>,
      },
      {
        header: 'Scheduled Time',
        accessor: 'scheduled_start',
        sortValue: (s) => new Date(s.scheduled_start).getTime(),
        render: (s) => <span>{new Date(s.scheduled_start).toLocaleString()}</span>,
      },
      {
        header: 'Topic / Module',
        accessor: 'topic',
        render: (s) => <span>{s.topic || '—'}</span>,
      },
    ],
    []
  );

  return (
    <AppLayout pageTitle="Attendance & Presence">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">{translateText('Attendance & Shift Records')}</h1>
          <p className="page-subtitle">
            {translateText('Track faculty front desk clock-ins and student lecture hall attendance')}
          </p>
        </div>
        <div className="page-header-actions">
          <div style={{ display: 'inline-flex', background: 'var(--color-bg)', padding: '4px', borderRadius: 'var(--radius-sm)' }}>
            <button
              type="button"
              className={`btn btn-sm ${activeTab === 'lecturers' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setActiveTab('lecturers')}
            >
              <MdAccessTime /> {translateText('Lecturer Shifts')}
            </button>
            <button
              type="button"
              className={`btn btn-sm ${activeTab === 'sessions' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setActiveTab('sessions')}
            >
              <MdHowToReg /> {translateText('Class Sessions')}
            </button>
          </div>
        </div>
      </div>

      {activeTab === 'lecturers' ? (
        <DataTable
          columns={shiftColumns}
          data={shifts}
          isLoading={shiftsLoading}
          searchPlaceholder="Search shifts by lecturer, ID, department..."
          emptyTitle="No Shift Records Found"
          emptySubtitle="Front desk shift registrations will appear here."
          pageSize={15}
          exportable={true}
          exportFileName="unhimas_lecturer_shifts"
        />
      ) : (
        <DataTable
          columns={sessionColumns}
          data={sessions}
          isLoading={sessionsLoading}
          searchPlaceholder="Search sessions by course, lecturer, batch, room..."
          emptyTitle="No Class Sessions Logged"
          emptySubtitle="Sessions created by lecturers for attendance will show here."
          pageSize={15}
          exportable={true}
          exportFileName="unhimas_class_sessions"
        />
      )}
    </AppLayout>
  );
}
