import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MdAdd, MdSchedule, MdStar, MdStarBorder } from 'react-icons/md';
import AppLayout from '../../components/layout/AppLayout';
import Modal from '../../components/common/Modal';
import { toast } from '../../components/common/Toast';
import {
  getSemesters,
  createSemester,
  setCurrentSemester,
  advanceCurrentSemester,
  getAcademicYears,
} from '../../services/academicService';

export default function SemestersPage() {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    academic_year_id: '',
    name: 'First Semester',
    number: 1,
    start_date: '',
    end_date: '',
    is_current: false,
  });

  const { data: semesters = [], isLoading } = useQuery({
    queryKey: ['admin-semesters'],
    queryFn: () => getSemesters(),
  });

  const { data: academicYears = [] } = useQuery({
    queryKey: ['admin-academic-years'],
    queryFn: getAcademicYears,
  });

  const createMutation = useMutation({
    mutationFn: createSemester,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-semesters'] });
      toast.success('Semester created successfully');
      setIsModalOpen(false);
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to create semester');
    },
  });

  const setCurrentMutation = useMutation({
    mutationFn: setCurrentSemester,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-semesters'] });
      toast.success('Current semester updated');
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to set current semester');
    },
  });

  const advanceMutation = useMutation({
    mutationFn: advanceCurrentSemester,
    onSuccess: (semester) => {
      queryClient.invalidateQueries({ queryKey: ['admin-semesters'] });
      queryClient.invalidateQueries({ queryKey: ['admin-batch-courses'] });
      queryClient.invalidateQueries({ queryKey: ['batch-semester-readiness'] });
      toast.success(`Moved to ${semester?.name || 'the next semester'}`);
    },
    onError: (err) => {
      toast.error(err.message || 'Could not move to the next semester');
    },
  });

  const currentSemester = semesters.find((semester) => semester.is_current);
  const activeYear = academicYears.find((year) => year.is_current);
  const nextSemester = currentSemester
    ? semesters.find((semester) =>
        semester.academic_year_id === currentSemester.academic_year_id &&
        Number(semester.number) === Number(currentSemester.number) + 1,
      )
    : semesters.find((semester) =>
        semester.academic_year_id === activeYear?.id && Number(semester.number) === 1,
      );

  const handleOpenAdd = () => {
    const currentYear = academicYears.find((y) => y.is_current) || academicYears[0];
    setFormData({
      academic_year_id: currentYear?.id || '',
      name: 'First Semester',
      number: 1,
      start_date: '',
      end_date: '',
      is_current: false,
    });
    setIsModalOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.academic_year_id || !formData.name || !formData.number) {
      toast.error('All fields are required');
      return;
    }
    createMutation.mutate(formData);
  };

  return (
    <AppLayout pageTitle="Semesters">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Academic Semesters</h1>
          <p className="page-subtitle">Manage the two teaching semesters and resit period for each academic year</p>
        </div>
        <div className="page-header-actions">
          {nextSemester && (
            <button
              className="btn btn-outline"
              onClick={() => advanceMutation.mutate()}
              disabled={advanceMutation.isPending}
              title={`Open registration for ${nextSemester.name}${
                currentSemester ? ` and close ${currentSemester.name}` : ''
              }`}
            >
              Move to {nextSemester.name}
            </button>
          )}
          <button className="btn btn-primary" onClick={handleOpenAdd}>
            <MdAdd /> New Semester
          </button>
        </div>
      </div>

      <div className="card">
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Semester Name</th>
                <th>Academic Year</th>
                <th>Semester Number</th>
                <th>Start Date</th>
                <th>End Date</th>
                <th>Current Active</th>
                <th style={{ textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '3rem' }}>
                    Loading semesters...
                  </td>
                </tr>
              ) : semesters.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '3rem' }}>
                    <div className="empty-state">
                      <MdSchedule className="empty-state-icon" />
                      <div className="empty-state-title">No Semesters Configured</div>
                      <div className="empty-state-text">
                        Create Semester 1 and Semester 2 for your active academic year.
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                semesters.map((sem) => (
                  <tr key={sem.id}>
                    <td>
                      <strong style={{ fontSize: '0.9375rem' }}>{sem.name}</strong>
                    </td>
                    <td>{sem.academic_years?.name}</td>
                    <td>
                      <span className={`badge ${sem.semester_type === 'resit' ? 'badge-amber' : 'badge-blue'}`}>
                        {sem.semester_type === 'resit' ? 'Resit Period' : `Semester ${sem.number}`}
                      </span>
                    </td>
                    <td>{sem.start_date ? new Date(sem.start_date).toLocaleDateString() : '—'}</td>
                    <td>{sem.end_date ? new Date(sem.end_date).toLocaleDateString() : '—'}</td>
                    <td>
                      {sem.is_current ? (
                        <span className="badge badge-green" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <MdStar /> Current Active Semester
                        </span>
                      ) : (
                        <span className="badge badge-gray">Inactive</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {!sem.is_current && (
                        <button
                          className="btn btn-outline btn-sm"
                          onClick={() => setCurrentMutation.mutate(sem.id)}
                          disabled={setCurrentMutation.isPending}
                        >
                          <MdStarBorder /> Set as Current
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

      {/* Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Add Academic Semester"
        footer={
          <>
            <button type="button" className="btn btn-outline" onClick={() => setIsModalOpen(false)}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSubmit}
              disabled={createMutation.isPending}
            >
              Create Semester
            </button>
          </>
        }
      >
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Academic Year *</label>
            <select
              className="form-input"
              value={formData.academic_year_id}
              onChange={(e) => setFormData({ ...formData, academic_year_id: e.target.value })}
              required
            >
              <option value="">Select academic year...</option>
              {academicYears.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.name} {y.is_current ? '(Current Active Year)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Semester Name *</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. First Semester"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Number (1 or 2) *</label>
              <select
                className="form-input"
                value={formData.number}
                onChange={(e) => setFormData({ ...formData, number: Number(e.target.value) })}
                required
              >
                <option value="1">1</option>
                <option value="2">2</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Start Date</label>
              <input
                type="date"
                className="form-input"
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">End Date</label>
              <input
                type="date"
                className="form-input"
                value={formData.end_date}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
              />
            </div>
          </div>

          <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
            <input
              type="checkbox"
              id="is_current_sem"
              checked={formData.is_current}
              onChange={(e) => setFormData({ ...formData, is_current: e.target.checked })}
              style={{ width: '18px', height: '18px' }}
            />
            <label htmlFor="is_current_sem" style={{ fontSize: '0.875rem', cursor: 'pointer' }}>
              Set as current active semester
            </label>
          </div>
        </form>
      </Modal>
    </AppLayout>
  );
}
