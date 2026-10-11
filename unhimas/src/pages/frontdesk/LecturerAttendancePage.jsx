import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  MdQrCodeScanner,
  MdLogin,
  MdLogout,
} from 'react-icons/md';
import AppLayout from '../../components/layout/AppLayout';
import { toast } from '../../components/common/Toast';
import { useAuth } from '../../context/AuthContext';
import {
  getLecturersWithShiftStatus,
  clockInLecturer,
  clockOutLecturer,
} from '../../services/frontDeskService';

export default function LecturerAttendancePage() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [inputCode, setInputCode] = useState('');
  const [quickResult, setQuickResult] = useState(null);
  const inputRef = useRef(null);

  const { data: lecturers = [], isLoading } = useQuery({
    queryKey: ['frontdesk-lecturers-status', ''],
    queryFn: () => getLecturersWithShiftStatus(),
  });

  const clockInMutation = useMutation({
    mutationFn: (lecturerId) =>
      clockInLecturer({
        lecturerId,
        staffProfileId: profile?.id || null,
      }),
    onSuccess: (_, lecturerId) => {
      queryClient.invalidateQueries({ queryKey: ['frontdesk-stats'] });
      queryClient.invalidateQueries({ queryKey: ['frontdesk-lecturers-status'] });
      const lec = lecturers.find((l) => l.id === lecturerId);
      setQuickResult({
        type: 'in',
        name: `${lec?.first_name} ${lec?.last_name}`,
        staffId: lec?.staff_id,
        time: new Date().toLocaleTimeString(),
      });
      toast.success(`${lec?.first_name} ${lec?.last_name} clocked in!`);
    },
    onError: (err) => {
      toast.error(err.message || 'Clock-in failed');
    },
  });

  const clockOutMutation = useMutation({
    mutationFn: ({ shiftId, lecturer }) =>
      clockOutLecturer({
        shiftId,
        staffProfileId: profile?.id || null,
      }).then(() => lecturer),
    onSuccess: (lec) => {
      queryClient.invalidateQueries({ queryKey: ['frontdesk-stats'] });
      queryClient.invalidateQueries({ queryKey: ['frontdesk-lecturers-status'] });
      setQuickResult({
        type: 'out',
        name: `${lec?.first_name} ${lec?.last_name}`,
        staffId: lec?.staff_id,
        time: new Date().toLocaleTimeString(),
      });
      toast.success(`${lec?.first_name} ${lec?.last_name} clocked out!`);
    },
    onError: (err) => {
      toast.error(err.message || 'Clock-out failed');
    },
  });

  const handleQuickSubmit = (e) => {
    e.preventDefault();
    if (!inputCode.trim()) return;
    const term = inputCode.trim().toLowerCase();

    // Match by Staff ID or exact name
    const match = lecturers.find(
      (l) =>
        l.staff_id?.toLowerCase() === term ||
        `${l.first_name} ${l.last_name}`.toLowerCase() === term
    );

    if (!match) {
      toast.error(`No lecturer found with Staff ID: "${inputCode}"`);
      return;
    }

    if (match.isClockedIn) {
      clockOutMutation.mutate({ shiftId: match.activeShift.id, lecturer: match });
    } else {
      clockInMutation.mutate(match.id);
    }
    setInputCode('');
  };

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  return (
    <AppLayout pageTitle="Quick Clock-In Terminal">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Quick Clock-In / Out Terminal</h1>
          <p className="page-subtitle">Scan lecturer badge or enter Staff ID for instant attendance recording</p>
        </div>
      </div>

      <div style={{ maxWidth: '680px', margin: '0 auto' }}>
        {/* Terminal Card */}
        <div className="card" style={{ marginBottom: '1.5rem', boxShadow: '0 8px 30px rgba(17,47,66,0.08)' }}>
          <div className="card-header" style={{ background: 'var(--color-primary)', color: '#fff' }}>
            <div className="card-title" style={{ color: '#fff', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <MdQrCodeScanner style={{ fontSize: '1.4rem' }} /> Front Desk Terminal Scanner
            </div>
          </div>
          <div className="card-body" style={{ padding: '2rem 1.5rem', textAlign: 'center' }}>
            <p style={{ color: 'var(--color-text-muted)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
              Enter Staff ID (e.g. <code>LEC-1001</code>) and press <kbd>Enter</kbd> to toggle Clock In / Out
            </p>

            <form onSubmit={handleQuickSubmit} style={{ display: 'flex', gap: '0.5rem', maxWidth: '440px', margin: '0 auto' }}>
              <input
                ref={inputRef}
                type="text"
                className="form-input"
                style={{ fontSize: '1.1rem', padding: '0.75rem 1rem', textAlign: 'center', letterSpacing: '0.05em', fontWeight: 700 }}
                placeholder="Staff ID (e.g. LEC-1001)"
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value.toUpperCase())}
              />
              <button
                type="submit"
                className="btn btn-primary"
                disabled={clockInMutation.isPending || clockOutMutation.isPending}
              >
                Submit
              </button>
            </form>

            {quickResult && (
              <div
                style={{
                  marginTop: '1.5rem',
                  padding: '1rem',
                  borderRadius: 'var(--radius-md)',
                  background: quickResult.type === 'in' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(183, 0, 50, 0.08)',
                  border: `1px solid ${quickResult.type === 'in' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(183, 0, 50, 0.2)'}`,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                }}
              >
                {quickResult.type === 'in' ? (
                  <MdLogin style={{ fontSize: '1.5rem', color: '#059669' }} />
                ) : (
                  <MdLogout style={{ fontSize: '1.5rem', color: '#9a002a' }} />
                )}
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                    {quickResult.name} ({quickResult.staffId})
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                    Action: {quickResult.type === 'in' ? 'CLOCKED IN' : 'CLOCKED OUT'} at {quickResult.time}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Quick Roster List */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">All Faculty Staff Quick Actions</div>
          </div>
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Staff ID</th>
                  <th>Lecturer</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan="4" style={{ textAlign: 'center', padding: '2rem' }}>Loading staff...</td></tr>
                ) : lecturers.length === 0 ? (
                  <tr><td colSpan="4" style={{ textAlign: 'center', padding: '2rem' }}>No lecturers registered.</td></tr>
                ) : (
                  lecturers.map((lec) => (
                    <tr key={lec.id}>
                      <td><code>{lec.staff_id}</code></td>
                      <td><strong>{lec.first_name} {lec.last_name}</strong></td>
                      <td>
                        {lec.isClockedIn ? (
                          <span className="badge badge-green">On Campus</span>
                        ) : (
                          <span className="badge badge-gray">Off Campus</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {lec.isClockedIn ? (
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => clockOutMutation.mutate({ shiftId: lec.activeShift.id, lecturer: lec })}
                          >
                            <MdLogout /> Clock Out
                          </button>
                        ) : (
                          <button
                            className="btn btn-primary btn-sm"
                            style={{ background: '#059669' }}
                            onClick={() => clockInMutation.mutate(lec.id)}
                          >
                            <MdLogin /> Clock In
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
