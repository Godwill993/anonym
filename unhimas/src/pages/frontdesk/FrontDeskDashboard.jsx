import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  MdLogin,
  MdLogout,
  MdAccessTime,
  MdPersonPin,
  MdCheckCircle,
  MdSearch,
  MdRefresh,
} from 'react-icons/md';
import AppLayout from '../../components/layout/AppLayout';
import { toast } from '../../components/common/Toast';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from '../../i18n';
import {
  getFrontDeskStats,
  getLecturersWithShiftStatus,
  clockInLecturer,
  clockOutLecturer,
} from '../../services/frontDeskService';
import { getDepartments } from '../../services/academicService';

export default function FrontDeskDashboard() {
  const { language, translateText } = useTranslation();
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('');

  // 1. Stats query
  const { data: stats = {}, isLoading: statsLoading, refetch: refetchStats } = useQuery({
    queryKey: ['frontdesk-stats'],
    queryFn: getFrontDeskStats,
    refetchInterval: 30_000,
  });

  // 2. Lecturers status list query
  const { data: lecturers = [], isLoading: lecsLoading, refetch: refetchLecturers } = useQuery({
    queryKey: ['frontdesk-lecturers-status', search, deptFilter],
    queryFn: () => getLecturersWithShiftStatus({ search, departmentId: deptFilter }),
    refetchInterval: 20_000,
  });

  // 3. Departments
  const { data: departments = [] } = useQuery({
    queryKey: ['admin-departments'],
    queryFn: getDepartments,
  });

  // Clock In Mutation
  const clockInMutation = useMutation({
    mutationFn: (lecturerId) =>
      clockInLecturer({
        lecturerId,
        staffProfileId: profile?.id || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['frontdesk-stats'] });
      queryClient.invalidateQueries({ queryKey: ['frontdesk-lecturers-status'] });
      queryClient.invalidateQueries({ queryKey: ['frontdesk-history'] });
      toast.success(translateText('Lecturer clocked in successfully'));
    },
    onError: (err) => {
      toast.error(err.message || translateText('Clock-in failed'));
    },
  });

  // Clock Out Mutation
  const clockOutMutation = useMutation({
    mutationFn: (shiftId) =>
      clockOutLecturer({
        shiftId,
        staffProfileId: profile?.id || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['frontdesk-stats'] });
      queryClient.invalidateQueries({ queryKey: ['frontdesk-lecturers-status'] });
      queryClient.invalidateQueries({ queryKey: ['frontdesk-history'] });
      toast.success(translateText('Lecturer clocked out successfully'));
    },
    onError: (err) => {
      toast.error(err.message || translateText('Clock-out failed'));
    },
  });

  const handleRefresh = () => {
    refetchStats();
    refetchLecturers();
    toast.info(translateText('Attendance register refreshed'));
  };

  const formattedTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const formattedDate = new Date().toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const currentlyOnCampus = lecturers.filter((l) => l.isClockedIn);

  return (
    <AppLayout pageTitle="Front Desk Attendance">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">{translateText('Front Desk Lecturer Register')}</h1>
          <p className="page-subtitle">
            {formattedDate} • {translateText('Current Time:')} <strong>{formattedTime}</strong> • {translateText('Digital Clock-In Station')}
          </p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-outline btn-sm" onClick={handleRefresh}>
            <MdRefresh /> {translateText('Refresh')}
          </button>
        </div>
      </div>

      {/* Front Desk KPI Stats */}
      <div className="stats-grid">
        <div className="stat-card" style={{ borderLeft: '4px solid #10B981' }}>
          <div className="stat-card-icon green">
            <MdLogin />
          </div>
          <div className="stat-card-body">
            <div className="stat-card-value" style={{ color: '#059669', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>{statsLoading ? '...' : stats.currentlyClockedIn}</span>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#10B981', display: 'inline-block' }} />
            </div>
            <div className="stat-card-label">{translateText('Currently On Campus')}</div>
            <div className="stat-card-trend">{translateText('Active open shifts')}</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-icon blue">
            <MdCheckCircle />
          </div>
          <div className="stat-card-body">
            <div className="stat-card-value">{statsLoading ? '...' : stats.completedShiftsToday}</div>
            <div className="stat-card-label">{translateText('Completed Shifts Today')}</div>
            <div className="stat-card-trend">{translateText('Departed lecturers')}</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-icon amber">
            <MdAccessTime />
          </div>
          <div className="stat-card-body">
            <div className="stat-card-value">{statsLoading ? '...' : stats.totalHoursToday} hrs</div>
            <div className="stat-card-label">{translateText('Hours Logged Today')}</div>
            <div className="stat-card-trend">{translateText('Total teaching presence')}</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-icon blue">
            <MdPersonPin />
          </div>
          <div className="stat-card-body">
            <div className="stat-card-value">{statsLoading ? '...' : stats.totalActiveLecturers}</div>
            <div className="stat-card-label">{translateText('Registered Faculty Staff')}</div>
            <div className="stat-card-trend">{translateText('Available for duty')}</div>
          </div>
        </div>
      </div>

      {/* Main Register & Live Status */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.8fr) minmax(0, 1fr)', gap: '1.25rem' }}>
        {/* Left Column: Interactive Register Table */}
        <div className="card">
          <div className="card-header" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
            <div style={{ position: 'relative', minWidth: '240px', flex: '1 1 200px' }}>
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
                placeholder={translateText('Search lecturer by name or Staff ID...')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div style={{ minWidth: '180px' }}>
              <select
                className="form-input"
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
              >
                <option value="">{translateText('All Departments')}</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.abbreviation})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{translateText('Staff ID')}</th>
                  <th>{translateText('Faculty Lecturer')}</th>
                  <th>{translateText('Department')}</th>
                  <th>{translateText('Campus Status')}</th>
                  <th style={{ textAlign: 'right' }}>{translateText('Clock In / Out Action')}</th>
                </tr>
              </thead>
              <tbody>
                {lecsLoading ? (
                  <tr><td colSpan="5" style={{ textAlign: 'center', padding: '3rem' }}>Loading lecturer roster...</td></tr>
                ) : lecturers.length === 0 ? (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', padding: '3rem' }}>
                      <div className="empty-state">
                        <MdPersonPin className="empty-state-icon" />
                        <div className="empty-state-title">No Lecturers Found</div>
                        <div className="empty-state-text">Ensure lecturers are registered in the administrative portal.</div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  lecturers.map((lec) => {
                    const isClockedIn = lec.isClockedIn;
                    const shift = lec.activeShift;
                    return (
                      <tr key={lec.id}>
                        <td>
                          <code style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-primary)' }}>
                            {lec.staff_id}
                          </code>
                        </td>
                        <td>
                          <strong>{lec.first_name} {lec.middle_name ? `${lec.middle_name} ` : ''}{lec.last_name}</strong>
                          {lec.phone && (
                            <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                              {lec.phone}
                            </div>
                          )}
                        </td>
                        <td>{lec.departments?.name ? `${lec.departments.name} (${lec.departments.abbreviation})` : '—'}</td>
                        <td>
                          {isClockedIn ? (
                            <div>
                              <span className="badge badge-green" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#059669' }} />
                                Present (In at {new Date(shift.clock_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
                              </span>
                            </div>
                          ) : (
                            <span className="badge badge-gray">Off Campus</span>
                          )}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {isClockedIn ? (
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => clockOutMutation.mutate(shift.id)}
                              disabled={clockOutMutation.isPending}
                            >
                              <MdLogout /> Clock Out
                            </button>
                          ) : (
                            <button
                              className="btn btn-primary btn-sm"
                              style={{ background: '#059669' }}
                              onClick={() => clockInMutation.mutate(lec.id)}
                              disabled={clockInMutation.isPending}
                            >
                              <MdLogin /> Clock In
                            </button>
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

        {/* Right Column: Live On-Campus Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="card">
            <div className="card-header">
              <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10B981', display: 'inline-block' }} />
                Currently On Campus ({currentlyOnCampus.length})
              </div>
            </div>
            <div className="card-body" style={{ padding: '0.75rem 1rem' }}>
              {currentlyOnCampus.length === 0 ? (
                <div className="empty-state" style={{ padding: '2rem 1rem' }}>
                  <div className="empty-state-title">No Lecturers Checked In</div>
                  <div className="empty-state-text">
                    Use the green "Clock In" button when a lecturer arrives at the front desk.
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {currentlyOnCampus.map((lec) => {
                    const elapsedMin = Math.max(0, Math.floor((new Date() - new Date(lec.activeShift?.clock_in)) / (1000 * 60)));
                    const hrs = Math.floor(elapsedMin / 60);
                    const mins = elapsedMin % 60;
                    const durationText = hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;

                    return (
                      <div
                        key={lec.id}
                        style={{
                          padding: '0.75rem',
                          background: 'var(--color-bg)',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--color-border)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '0.5rem',
                        }}
                      >
                        <div>
                          <strong>{lec.first_name} {lec.last_name}</strong>
                          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                            {lec.staff_id} • In at {new Date(lec.activeShift?.clock_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ({durationText})
                          </div>
                        </div>
                        <button
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}
                          onClick={() => clockOutMutation.mutate(lec.activeShift.id)}
                          disabled={clockOutMutation.isPending}
                        >
                          <MdLogout /> Out
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Quick guidelines reminder */}
          <div className="card" style={{ background: 'rgba(17, 47, 66, 0.03)' }}>
            <div className="card-header">
              <div className="card-title" style={{ fontSize: '0.875rem' }}>Front Desk Operating Procedure</div>
            </div>
            <div className="card-body" style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', lineHeight: '1.5' }}>
              <p style={{ marginBottom: '0.5rem' }}>
                1. <strong>Arrival:</strong> Confirm lecturer identity / staff ID upon arrival and click <strong>Clock In</strong>.
              </p>
              <p style={{ marginBottom: '0.5rem' }}>
                2. <strong>Departure:</strong> When the lecturer finishes sessions and leaves campus, click <strong>Clock Out</strong>.
              </p>
              <p>
                3. The system automatically records the timestamp and staff identity for the official monthly teaching hours report.
              </p>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
