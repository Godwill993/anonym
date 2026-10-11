import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MdHowToReg, MdAccessTime, MdSearch } from 'react-icons/md';
import AppLayout from '../../components/layout/AppLayout';
import { supabase } from '../../lib/supabase';

export default function AdminAttendancePage() {
  const [activeTab, setActiveTab] = useState('lecturers'); // 'lecturers' | 'sessions'
  const [search, setSearch] = useState('');

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
        .limit(50);
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
        .limit(50);
      if (error) throw error;
      return data || [];
    },
  });

  const filteredShifts = shifts.filter((s) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const name = `${s.lecturers?.first_name || ''} ${s.lecturers?.last_name || ''}`.toLowerCase();
    const id = (s.lecturers?.staff_id || '').toLowerCase();
    const dept = (s.lecturers?.departments?.abbreviation || '').toLowerCase();
    return name.includes(q) || id.includes(q) || dept.includes(q);
  });

  const filteredSessions = sessions.filter((s) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const courseCode = (s.batch_courses?.courses?.code || '').toLowerCase();
    const courseName = (s.batch_courses?.courses?.name || '').toLowerCase();
    const batchName = (s.batch_courses?.batches?.name || '').toLowerCase();
    const lec = `${s.lecturers?.first_name || ''} ${s.lecturers?.last_name || ''}`.toLowerCase();
    return courseCode.includes(q) || courseName.includes(q) || batchName.includes(q) || lec.includes(q);
  });

  return (
    <AppLayout pageTitle="Attendance & Presence">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Attendance & Shift Records</h1>
          <p className="page-subtitle">Track faculty front desk clock-ins and student lecture hall attendance</p>
        </div>
        <div className="page-header-actions">
          <div style={{ display: 'inline-flex', background: 'var(--color-bg)', padding: '4px', borderRadius: 'var(--radius-sm)' }}>
            <button
              className={`btn btn-sm ${activeTab === 'lecturers' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setActiveTab('lecturers')}
            >
              <MdAccessTime /> Lecturer Shifts
            </button>
            <button
              className={`btn btn-sm ${activeTab === 'sessions' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setActiveTab('sessions')}
            >
              <MdHowToReg /> Class Sessions
            </button>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '1.25rem' }}>
        <div className="card-body" style={{ padding: '0.75rem 1rem' }}>
          <div style={{ position: 'relative', maxWidth: '380px' }}>
            <MdSearch
              style={{
                position: 'absolute',
                left: '0.75rem',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--color-text-muted)',
                fontSize: '1.1rem',
              }}
            />
            <input
              type="text"
              className="form-input"
              style={{ paddingLeft: '2.25rem' }}
              placeholder={activeTab === 'lecturers' ? "Search shifts by lecturer, ID, department..." : "Search sessions by course, lecturer, batch..."}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="card">
        {activeTab === 'lecturers' ? (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Lecturer</th>
                  <th>Department</th>
                  <th>Clock In</th>
                  <th>Clock Out</th>
                  <th>Duration (Hours)</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {shiftsLoading ? (
                  <tr><td colSpan="6" style={{ textAlign: 'center', padding: '3rem' }}>Loading shifts...</td></tr>
                ) : filteredShifts.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '3rem' }}>
                      <div className="empty-state">
                        <MdAccessTime className="empty-state-icon" />
                        <div className="empty-state-title">No Shift Records Found</div>
                        <div className="empty-state-text">Front desk shift registrations will appear here.</div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredShifts.map((shift) => {
                    let duration = 'Active';
                    if (shift.clock_out) {
                      const diff = (new Date(shift.clock_out) - new Date(shift.clock_in)) / (1000 * 60 * 60);
                      duration = `${diff.toFixed(2)} hrs`;
                    }
                    return (
                      <tr key={shift.id}>
                        <td>
                          <strong>{shift.lecturers?.first_name} {shift.lecturers?.last_name}</strong>
                          <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                            ID: {shift.lecturers?.staff_id}
                          </div>
                        </td>
                        <td>{shift.lecturers?.departments?.abbreviation || '—'}</td>
                        <td>{new Date(shift.clock_in).toLocaleString()}</td>
                        <td>{shift.clock_out ? new Date(shift.clock_out).toLocaleString() : '—'}</td>
                        <td><strong>{duration}</strong></td>
                        <td>
                          <span className={`badge ${shift.status === 'open' ? 'badge-green' : 'badge-blue'}`}>
                            {shift.status.toUpperCase()}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Course</th>
                  <th>Batch / Cohort</th>
                  <th>Lecturer</th>
                  <th>Room</th>
                  <th>Scheduled Time</th>
                  <th>Topic</th>
                </tr>
              </thead>
              <tbody>
                {sessionsLoading ? (
                  <tr><td colSpan="6" style={{ textAlign: 'center', padding: '3rem' }}>Loading sessions...</td></tr>
                ) : filteredSessions.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '3rem' }}>
                      <div className="empty-state">
                        <MdHowToReg className="empty-state-icon" />
                        <div className="empty-state-title">No Class Sessions Logged</div>
                        <div className="empty-state-text">Sessions created by lecturers for attendance will show here.</div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredSessions.map((s) => (
                    <tr key={s.id}>
                      <td>
                        <code>{s.batch_courses?.courses?.code}</code>{' '}
                        <strong>{s.batch_courses?.courses?.name}</strong>
                      </td>
                      <td>{s.batch_courses?.batches?.name}</td>
                      <td>{s.lecturers?.first_name} {s.lecturers?.last_name}</td>
                      <td>{s.room || 'General Hall'}</td>
                      <td>{new Date(s.scheduled_start).toLocaleString()}</td>
                      <td>{s.topic || '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
