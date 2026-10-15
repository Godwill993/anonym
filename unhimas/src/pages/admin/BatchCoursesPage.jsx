import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MdAdd, MdClass, MdDelete, MdSearch } from 'react-icons/md';
import AppLayout from '../../components/layout/AppLayout';
import Modal from '../../components/common/Modal';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import { toast } from '../../components/common/Toast';
import {
  getBatchCourses,
  assignBatchCourse,
  deleteBatchCourse,
  getBatches,
  getCourses,
  getSemesters,
} from '../../services/academicService';
import { getLecturers } from '../../services/peopleService';

export default function BatchCoursesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [batchFilter, setBatchFilter] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [allocationToDelete, setAllocationToDelete] = useState(null);

  const [formData, setFormData] = useState({
    batch_id: '',
    course_id: '',
    semester_id: '',
    lecturer_id: '',
    is_compulsory: true,
  });

  const { data: batchCourses = [], isLoading } = useQuery({
    queryKey: ['admin-batch-courses'],
    queryFn: () => getBatchCourses(),
  });

  const { data: batches = [] } = useQuery({
    queryKey: ['admin-batches'],
    queryFn: () => getBatches(),
  });

  const { data: courses = [] } = useQuery({
    queryKey: ['admin-courses'],
    queryFn: () => getCourses(),
  });

  const { data: semesters = [] } = useQuery({
    queryKey: ['admin-semesters'],
    queryFn: () => getSemesters(),
  });

  const { data: lecturers = [] } = useQuery({
    queryKey: ['admin-lecturers'],
    queryFn: () => getLecturers(),
  });

  const assignMutation = useMutation({
    mutationFn: assignBatchCourse,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-batch-courses'] });
      toast.success('Course assigned to batch successfully');
      setIsModalOpen(false);
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to allocate course');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteBatchCourse,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-batch-courses'] });
      toast.success('Course unassigned from batch');
      setAllocationToDelete(null);
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to remove allocation');
    },
  });

  const handleOpenAdd = () => {
    setFormData({
      batch_id: batches[0]?.id || '',
      course_id: courses[0]?.id || '',
      semester_id: semesters.find((s) => s.is_current)?.id || semesters[0]?.id || '',
      lecturer_id: '',
      is_compulsory: true,
    });
    setIsModalOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.batch_id || !formData.course_id || !formData.semester_id) {
      toast.error('Batch, Course, and Semester are required');
      return;
    }
    assignMutation.mutate(formData);
  };

  const filteredAllocations = batchCourses.filter((bc) => {
    const s = search.toLowerCase();
    const matchSearch =
      bc.courses?.code?.toLowerCase().includes(s) ||
      bc.courses?.name?.toLowerCase().includes(s) ||
      bc.batches?.name?.toLowerCase().includes(s) ||
      bc.batches?.code?.toLowerCase().includes(s) ||
      (bc.lecturers && `${bc.lecturers.first_name} ${bc.lecturers.last_name}`.toLowerCase().includes(s));

    const matchBatch = batchFilter ? bc.batch_id === batchFilter : true;
    return matchSearch && matchBatch;
  });

  return (
    <AppLayout pageTitle="Batch Course Allocations">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Course Allocations</h1>
          <p className="page-subtitle">Assign curriculum courses to cohorts, semesters, and teaching faculty</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-primary" onClick={handleOpenAdd}>
            <MdAdd /> Allocate Course to Batch
          </button>
        </div>
      </div>

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
              placeholder="Search by course code, batch, or lecturer..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div style={{ minWidth: '180px' }}>
            <select
              className="form-input"
              value={batchFilter}
              onChange={(e) => setBatchFilter(e.target.value)}
            >
              <option value="">All Cohorts / Batches</option>
              {batches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.code})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Course</th>
                <th>Cohort / Batch</th>
                <th>Semester</th>
                <th>Assigned Lecturer</th>
                <th>Type</th>
                <th style={{ textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '3rem' }}>
                    Loading allocations...
                  </td>
                </tr>
              ) : filteredAllocations.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '3rem' }}>
                    <div className="empty-state">
                      <MdClass className="empty-state-icon" />
                      <div className="empty-state-title">No Course Allocations Found</div>
                      <div className="empty-state-text">
                        Assign courses to student batches and designate teaching lecturers.
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredAllocations.map((bc) => (
                  <tr key={bc.id}>
                    <td>
                      <div>
                        <code style={{ fontSize: '0.85rem', background: 'var(--color-bg)', padding: '2px 6px', borderRadius: '4px', fontWeight: 700, color: 'var(--color-primary)' }}>
                          {bc.courses?.code}
                        </code>{' '}
                        <strong>{bc.courses?.name}</strong>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                        {bc.courses?.credit_units} credits
                      </div>
                    </td>
                    <td>
                      <div>{bc.batches?.name}</div>
                      <code style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                        {bc.batches?.code}
                      </code>
                    </td>
                    <td>
                      <div>{bc.semesters?.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                        {bc.semesters?.academic_years?.name}
                      </div>
                    </td>
                    <td>
                      {bc.lecturers ? (
                        <div>
                          <strong>{bc.lecturers.first_name} {bc.lecturers.last_name}</strong>
                          <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                            ID: {bc.lecturers.staff_id}
                          </div>
                        </div>
                      ) : (
                        <span className="badge badge-amber">Unassigned</span>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${bc.is_compulsory ? 'badge-blue' : 'badge-gray'}`}>
                        {bc.is_compulsory ? 'Compulsory' : 'Elective'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        className="btn-icon"
                        title="Unassign course"
                        onClick={() => setAllocationToDelete(bc)}
                        disabled={deleteMutation.isPending}
                        aria-label={`Unassign course ${bc.courses?.code} from batch`}
                      >
                        <MdDelete style={{ color: 'var(--color-secondary)' }} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Allocate Course to Batch"
        footer={
          <>
            <button type="button" className="btn btn-outline" onClick={() => setIsModalOpen(false)}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSubmit}
              disabled={assignMutation.isPending}
            >
              Allocate Course
            </button>
          </>
        }
      >
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Select Cohort / Batch *</label>
            <select
              className="form-input"
              value={formData.batch_id}
              onChange={(e) => setFormData({ ...formData, batch_id: e.target.value })}
              required
            >
              <option value="">Choose batch...</option>
              {batches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.code})
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Select Course *</label>
            <select
              className="form-input"
              value={formData.course_id}
              onChange={(e) => setFormData({ ...formData, course_id: e.target.value })}
              required
            >
              <option value="">Choose course...</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.name} ({c.credit_units} cr)
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Semester *</label>
            <select
              className="form-input"
              value={formData.semester_id}
              onChange={(e) => setFormData({ ...formData, semester_id: e.target.value })}
              required
            >
              <option value="">Choose semester...</option>
              {semesters.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.academic_years?.name}) {s.is_current ? '• Active' : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Teaching Lecturer</label>
            <select
              className="form-input"
              value={formData.lecturer_id}
              onChange={(e) => setFormData({ ...formData, lecturer_id: e.target.value })}
            >
              <option value="">Assign later (Optional)</option>
              {lecturers.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.first_name} {l.last_name} ({l.staff_id})
                </option>
              ))}
            </select>
          </div>

          <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
            <input
              type="checkbox"
              id="is_compulsory"
              checked={formData.is_compulsory}
              onChange={(e) => setFormData({ ...formData, is_compulsory: e.target.checked })}
              style={{ width: '18px', height: '18px' }}
            />
            <label htmlFor="is_compulsory" style={{ fontSize: '0.875rem', cursor: 'pointer' }}>
              Compulsory course for this cohort
            </label>
          </div>
        </form>
      </Modal>

      {/* Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(allocationToDelete)}
        onClose={() => setAllocationToDelete(null)}
        onConfirm={() => allocationToDelete && deleteMutation.mutate(allocationToDelete.id)}
        title="Unassign Course from Batch"
        message={`Are you sure you want to remove "${allocationToDelete?.courses?.code} - ${allocationToDelete?.courses?.name}" from batch "${allocationToDelete?.batches?.name}"?`}
        confirmLabel="Unassign Course"
        isDestructive={true}
        isLoading={deleteMutation.isPending}
      />
    </AppLayout>
  );
}
