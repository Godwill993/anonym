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
} from '../../services/campusOpsService';

export default function LecturerAttendancePage() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [inputCode, setInputCode] = useState('');
  const [quickResult, setQuickResult] = useState(null);
  const inputRef = useRef(null);

  const { data: lecturers = [], isLoading } = useQuery({
    queryKey: ['admin-lecturers-status', ''],
    queryFn: () => getLecturersWithShiftStatus(),
  });

  const clockInMutation = useMutation({
    mutationFn: (lecturerId) =>
      clockInLecturer({
        lecturerId,
        staffProfileId: profile?.id || null,
      }),
    onSuccess: (_, lecturerId) => {
      queryClient.invalidateQueries({ queryKey: ['admin-campus-stats'] });
      queryClient.invalidateQueries({ queryKey: ['admin-lecturers-status'] });
      queryClient.invalidateQueries({ queryKey: ['admin-live-shifts'] });
      const lec = lecturers.find((l) => l.id === lecturerId);
      setQuickResult({
        type: 'in',
        name: lec ? `${lec.first_name} ${lec.last_name}` : 'Lecturer',
      });
      toast.success('Clocked in');
      setInputCode('');
      inputRef.current?.focus();
    },
    onError: (err) => toast.error(err.message || 'Clock-in failed'),
  });

  const clockOutMutation = useMutation({
    mutationFn: (lecturerId) => clockOutLecturer(lecturerId),
    onSuccess: (_, lecturerId) => {
      queryClient.invalidateQueries({ queryKey: ['admin-campus-stats'] });
      queryClient.invalidateQueries({ queryKey: ['admin-lecturers-status'] });
      queryClient.invalidateQueries({ queryKey: ['admin-live-shifts'] });
      const lec = lecturers.find((l) => l.id === lecturerId);
      setQuickResult({
        type: 'out',
        name: lec ? `${lec.first_name} ${lec.last_name}` : 'Lecturer',
      });
      toast.success('Clocked out');
      setInputCode('');
      inputRef.current?.focus();
    },
    onError: (err) => toast.error(err.message || 'Clock-out failed'),
  });

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleQuickSubmit = (e) => {
    e.preventDefault();
    const code = inputCode.trim().toUpperCase();
    if (!code) return;
    const match = lecturers.find(
      (l) =>
        (l.staff_id || '').toUpperCase() === code ||
        (l.staff_id || '').toUpperCase().endsWith(code),
    );
    if (!match) {
      toast.error('No lecturer found for that staff ID');
      return;
    }
    if (match.current_shift) {
      clockOutMutation.mutate(match.id);
    } else {
      clockInMutation.mutate(match.id);
    }
  };

  const pending = clockInMutation.isPending || clockOutMutation.isPending;

  return (
    <AppLayout pageTitle="Lecturer Clock-in">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Lecturer Clock-in</h1>
          <p className="page-subtitle">Campus presence — scan or enter staff ID</p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '1.25rem', maxWidth: 520 }}>
        <div className="card-body">
          <form onSubmit={handleQuickSubmit} style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <MdQrCodeScanner
                style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }}
              />
              <input
                ref={inputRef}
                className="form-input"
                style={{ paddingLeft: 40 }}
                placeholder="Staff ID"
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value)}
                disabled={pending}
                autoComplete="off"
              />
            </div>
            <button type="submit" className="btn btn-primary" disabled={pending || !inputCode.trim()}>
              {pending ? '…' : 'Go'}
            </button>
          </form>
          {quickResult && (
            <div style={{ marginTop: 12, fontWeight: 600, color: quickResult.type === 'in' ? '#059669' : 'var(--color-text-muted)' }}>
              {quickResult.type === 'in' ? <MdLogin /> : <MdLogout />}{' '}
              {quickResult.name} — {quickResult.type === 'in' ? 'Clocked in' : 'Clocked out'}
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">Faculty status</span>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          {isLoading ? (
            <div style={{ padding: '1.5rem', textAlign: 'center' }}>Loading…</div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Staff ID</th>
                  <th>Name</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {lecturers.map((l) => (
                  <tr key={l.id}>
                    <td><code>{l.staff_id || '—'}</code></td>
                    <td>
                      <strong>
                        {l.first_name} {l.last_name}
                      </strong>
                    </td>
                    <td>
                      {l.current_shift ? (
                        <span className="badge badge-green">Clocked in</span>
                      ) : (
                        <span className="badge badge-gray">Out</span>
                      )}
                    </td>
                    <td>
                      {l.current_shift ? (
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          disabled={pending}
                          onClick={() => clockOutMutation.mutate(l.id)}
                        >
                          <MdLogout /> Out
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          disabled={pending}
                          onClick={() => clockInMutation.mutate(l.id)}
                        >
                          <MdLogin /> In
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
