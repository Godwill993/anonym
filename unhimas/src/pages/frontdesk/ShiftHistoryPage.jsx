import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MdHistory } from 'react-icons/md';
import AppLayout from '../../components/layout/AppLayout';
import { getShiftHistory } from '../../services/frontDeskService';
import { getDepartments } from '../../services/academicService';
import { getLecturers } from '../../services/peopleService';

export default function ShiftHistoryPage() {
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedLecturer, setSelectedLecturer] = useState('');
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');

  const { data: shifts = [], isLoading } = useQuery({
    queryKey: ['frontdesk-shift-history', selectedDate, selectedLecturer, selectedDept, selectedStatus],
    queryFn: () =>
      getShiftHistory({
        date: selectedDate || null,
        lecturerId: selectedLecturer || null,
        departmentId: selectedDept || null,
        status: selectedStatus || null,
      }),
  });

  const { data: departments = [] } = useQuery({
    queryKey: ['admin-departments'],
    queryFn: getDepartments,
  });

  const { data: lecturers = [] } = useQuery({
    queryKey: ['admin-lecturers'],
    queryFn: () => getLecturers(),
  });

  let totalFilteredHours = 0;
  shifts.forEach((s) => {
    if (s.clock_out) {
      const hrs = (new Date(s.clock_out) - new Date(s.clock_in)) / (1000 * 60 * 60);
      if (hrs > 0) totalFilteredHours += hrs;
    }
  });

  const handleResetFilters = () => {
    setSelectedDate('');
    setSelectedLecturer('');
    setSelectedDept('');
    setSelectedStatus('');
  };

  return (
    <AppLayout pageTitle="Shift History">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Lecturer Shift History & Logs</h1>
          <p className="page-subtitle">Historical digital registry of faculty campus presence and calculated teaching hours</p>
        </div>
        <div className="page-header-actions">
          <div style={{ fontSize: '0.875rem', fontWeight: 600, padding: '0.5rem 1rem', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)' }}>
            Total Filtered Hours: <span style={{ color: 'var(--color-primary)', fontWeight: 800 }}>{totalFilteredHours.toFixed(2)} hrs</span>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="card" style={{ marginBottom: '1.25rem' }}>
        <div className="card-body" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', alignItems: 'end' }}>
          <div>
            <label className="form-label">Filter by Date</label>
            <input
              type="date"
              className="form-input"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </div>

          <div>
            <label className="form-label">Filter by Lecturer</label>
            <select
              className="form-input"
              value={selectedLecturer}
              onChange={(e) => setSelectedLecturer(e.target.value)}
            >
              <option value="">All Lecturers</option>
              {lecturers.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.first_name} {l.last_name} ({l.staff_id})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="form-label">Department</label>
            <select
              className="form-input"
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
            >
              <option value="">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.abbreviation})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="form-label">Shift Status</label>
            <select
              className="form-input"
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
            >
              <option value="">All Statuses</option>
              <option value="open">Currently Open (On Campus)</option>
              <option value="closed">Closed (Clocked Out)</option>
              <option value="corrected">Corrected</option>
            </select>
          </div>

          <div>
            <button className="btn btn-outline btn-full" onClick={handleResetFilters}>
              Reset Filters
            </button>
          </div>
        </div>
      </div>

      {/* Shifts Table */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">Registered Shifts ({shifts.length})</div>
        </div>
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
                <th>Clock In Recorded By</th>
                <th>Clock Out Recorded By</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan="8" style={{ textAlign: 'center', padding: '3rem' }}>Loading shift history...</td></tr>
              ) : shifts.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '3rem' }}>
                    <div className="empty-state">
                      <MdHistory className="empty-state-icon" />
                      <div className="empty-state-title">No Shift Records Found</div>
                      <div className="empty-state-text">
                        Shift records matching the selected date and criteria will appear here.
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                shifts.map((shift) => {
                  let duration = 'Active Now';
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
                      <td>{shift.lecturers?.departments?.name ? `${shift.lecturers.departments.name} (${shift.lecturers.departments.abbreviation})` : '—'}</td>
                      <td>{new Date(shift.clock_in).toLocaleString()}</td>
                      <td>{shift.clock_out ? new Date(shift.clock_out).toLocaleString() : '—'}</td>
                      <td>
                        <strong style={{ color: shift.status === 'open' ? '#059669' : 'inherit' }}>
                          {duration}
                        </strong>
                      </td>
                      <td>
                        <span className={`badge ${shift.status === 'open' ? 'badge-green' : 'badge-blue'}`}>
                          {shift.status.toUpperCase()}
                        </span>
                      </td>
                      <td>{shift.clock_in_staff?.full_name || 'Front Desk'}</td>
                      <td>{shift.clock_out_staff?.full_name || (shift.clock_out ? 'Front Desk' : '—')}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppLayout>
  );
}
