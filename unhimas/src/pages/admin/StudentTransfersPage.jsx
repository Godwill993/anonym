import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MdAdd, MdSearch, MdSwapHoriz } from 'react-icons/md';
import AppLayout from '../../components/layout/AppLayout';
import Modal from '../../components/common/Modal';
import { toast } from '../../components/common/Toast';
import { getBatches } from '../../services/academicService';
import {
  getStudents,
  getStudentTransfers,
  transferStudent,
} from '../../services/peopleService';

export default function StudentTransfersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ student_id: '', to_batch_id: '', reason: '' });

  const { data: transfers = [], isLoading } = useQuery({
    queryKey: ['student-transfers'],
    queryFn: () => getStudentTransfers(),
  });

  const { data: students = [] } = useQuery({
    queryKey: ['admin-students'],
    queryFn: () => getStudents(),
  });

  const { data: batches = [] } = useQuery({
    queryKey: ['admin-batches'],
    queryFn: getBatches,
  });

  const activeStudents = useMemo(
    () => (students || []).filter((s) => s.is_active !== false),
    [students]
  );

  const selectedStudent = activeStudents.find((s) => s.id === form.student_id);

  const mutation = useMutation({
    mutationFn: async (payload) => {
      if (!payload.student_id || !payload.to_batch_id) {
        throw new Error('Student and destination batch are required.');
      }
      if (selectedStudent?.batch_id && selectedStudent.batch_id === payload.to_batch_id) {
        throw new Error('Student is already in that batch.');
      }
      return transferStudent({
        studentId: payload.student_id,
        toBatchId: payload.to_batch_id,
        reason: payload.reason?.trim() || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student-transfers'] });
      queryClient.invalidateQueries({ queryKey: ['admin-students'] });
      toast.success('Student transferred successfully');
      setOpen(false);
      setForm({ student_id: '', to_batch_id: '', reason: '' });
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to transfer student');
    },
  });

  const filtered = transfers.filter((item) => {
    const hay = `${item.students?.matricule || ''} ${item.students?.first_name || ''} ${item.students?.last_name || ''}`.toLowerCase();
    return hay.includes(search.toLowerCase());
  });

  const destinationBatches = useMemo(() => {
    if (!selectedStudent?.batch_id) return batches;
    return batches.filter((b) => b.id !== selectedStudent.batch_id);
  }, [batches, selectedStudent]);

  return (
    <AppLayout pageTitle="Student Transfers">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Student Transfers</h1>
          <p className="page-subtitle">
            Move a student to another batch. The official transfer is recorded and historical marks stay with the student.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            setForm({ student_id: '', to_batch_id: '', reason: '' });
            setOpen(true);
          }}
        >
          <MdAdd /> Transfer student
        </button>
      </div>

      <div className="card">
        <div className="card-header" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ position: 'relative', flex: '1 1 220px', minWidth: 200 }}>
            <MdSearch
              style={{
                position: 'absolute',
                left: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--color-text-muted)',
              }}
            />
            <input
              className="form-input"
              style={{ paddingLeft: 40 }}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search student by matricule or name…"
            />
          </div>
        </div>

        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>From</th>
                <th>To</th>
                <th>Reason</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '3rem' }}>
                    Loading…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '3rem' }}>
                    <div className="empty-state">
                      <MdSwapHoriz className="empty-state-icon" />
                      <div className="empty-state-title">No transfer records</div>
                      <div className="empty-state-text">
                        Use “Transfer student” to move someone to another cohort.
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.students?.matricule}</strong>{' '}
                      {item.students?.first_name} {item.students?.last_name}
                    </td>
                    <td>
                      {item.from_batch?.name || '—'}
                      {item.from_batch?.code ? (
                        <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                          {item.from_batch.code}
                        </div>
                      ) : null}
                    </td>
                    <td>
                      {item.to_batch?.name || '—'}
                      {item.to_batch?.code ? (
                        <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                          {item.to_batch.code}
                        </div>
                      ) : null}
                    </td>
                    <td>{item.reason || '—'}</td>
                    <td>
                      {item.transferred_at
                        ? new Date(item.transferred_at).toLocaleString()
                        : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        isOpen={open}
        onClose={() => setOpen(false)}
        title="Transfer student"
        footer={
          <>
            <button type="button" className="btn btn-outline" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => mutation.mutate(form)}
              disabled={
                mutation.isPending || !form.student_id || !form.to_batch_id
              }
            >
              {mutation.isPending ? 'Transferring…' : 'Confirm transfer'}
            </button>
          </>
        }
      >
        <div className="form-group">
          <label className="form-label">Student *</label>
          <select
            className="form-input"
            value={form.student_id}
            onChange={(event) =>
              setForm({
                student_id: event.target.value,
                to_batch_id: '',
                reason: form.reason,
              })
            }
            required
          >
            <option value="">Select student</option>
            {activeStudents.map((student) => (
              <option key={student.id} value={student.id}>
                {student.matricule} — {student.first_name} {student.last_name}
                {student.batches?.name ? ` (${student.batches.name})` : ''}
              </option>
            ))}
          </select>
          {selectedStudent?.batches && (
            <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
              Current batch: {selectedStudent.batches.name}
              {selectedStudent.batches.code ? ` (${selectedStudent.batches.code})` : ''}
            </p>
          )}
        </div>
        <div className="form-group">
          <label className="form-label">Destination batch *</label>
          <select
            className="form-input"
            value={form.to_batch_id}
            onChange={(event) => setForm({ ...form, to_batch_id: event.target.value })}
            required
            disabled={!form.student_id}
          >
            <option value="">Select destination batch</option>
            {destinationBatches.map((batch) => (
              <option key={batch.id} value={batch.id}>
                {batch.name} ({batch.code || '—'})
              </option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Reason (optional)</label>
          <textarea
            className="form-input"
            rows={3}
            value={form.reason}
            onChange={(event) => setForm({ ...form, reason: event.target.value })}
            placeholder="e.g. Change of programme, academic decision…"
          />
        </div>
      </Modal>
    </AppLayout>
  );
}
