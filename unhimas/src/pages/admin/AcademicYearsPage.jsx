import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MdAdd, MdDateRange, MdStar, MdStarBorder } from 'react-icons/md';
import AppLayout from '../../components/layout/AppLayout';
import Modal from '../../components/common/Modal';
import { toast } from '../../components/common/Toast';
import {
  getAcademicYears,
  createAcademicYear,
  setCurrentAcademicYear,
} from '../../services/academicService';

export default function AcademicYearsPage() {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '2025/2026',
    start_date: '',
    end_date: '',
    is_current: false,
  });

  const { data: years = [], isLoading } = useQuery({
    queryKey: ['admin-academic-years'],
    queryFn: getAcademicYears,
  });

  const createMutation = useMutation({
    mutationFn: createAcademicYear,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-academic-years'] });
      queryClient.invalidateQueries({ queryKey: ['admin-semesters'] });
      toast.success('Academic Year created successfully');
      setIsModalOpen(false);
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to create academic year');
    },
  });

  const setAsCurrentMutation = useMutation({
    mutationFn: setCurrentAcademicYear,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-academic-years'] });
      queryClient.invalidateQueries({ queryKey: ['admin-semesters'] });
      toast.success('Current academic year updated');
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to set current year');
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name || !formData.start_date || !formData.end_date) {
      toast.error('All fields are required');
      return;
    }
    if (new Date(formData.end_date) <= new Date(formData.start_date)) {
      toast.error('End date must be after start date');
      return;
    }
    createMutation.mutate(formData);
  };

  return (
    <AppLayout pageTitle="Academic Years">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Academic Years</h1>
          <p className="page-subtitle">Each new academic year includes two semesters and a resit period</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
            <MdAdd /> New Academic Year
          </button>
        </div>
      </div>

      <div className="card">
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Academic Year Session</th>
                <th>Start Date</th>
                <th>End Date</th>
                <th>Semesters Configured</th>
                <th>Current Active Session</th>
                <th style={{ textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '3rem' }}>
                    Loading academic years...
                  </td>
                </tr>
              ) : years.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '3rem' }}>
                    <div className="empty-state">
                      <MdDateRange className="empty-state-icon" />
                      <div className="empty-state-title">No Academic Years Configured</div>
                      <div className="empty-state-text">
                        Create an academic year (e.g. 2025/2026) to manage semesters and batches.
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                years.map((year) => (
                  <tr key={year.id}>
                    <td>
                      <strong style={{ fontSize: '0.9375rem' }}>{year.name}</strong>
                    </td>
                    <td>{new Date(year.start_date).toLocaleDateString()}</td>
                    <td>{new Date(year.end_date).toLocaleDateString()}</td>
                    <td>
                      <span className="badge badge-blue">
                        {year.semesters?.length || 0} semester{year.semesters?.length !== 1 ? 's' : ''}
                      </span>
                    </td>
                    <td>
                      {year.is_current ? (
                        <span className="badge badge-green" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <MdStar /> Current Session
                        </span>
                      ) : (
                        <span className="badge badge-gray">Archived / Inactive</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {!year.is_current && (
                        <button
                          className="btn btn-outline btn-sm"
                          onClick={() => setAsCurrentMutation.mutate(year.id)}
                          disabled={setAsCurrentMutation.isPending}
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
        title="Create Academic Year Session"
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
              Create Academic Year
            </button>
          </>
        }
      >
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Academic Year Name *</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. 2025/2026"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Start Date *</label>
              <input
                type="date"
                className="form-input"
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">End Date *</label>
              <input
                type="date"
                className="form-input"
                value={formData.end_date}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
            <input
              type="checkbox"
              id="is_current"
              checked={formData.is_current}
              onChange={(e) => setFormData({ ...formData, is_current: e.target.checked })}
              style={{ width: '18px', height: '18px' }}
            />
            <label htmlFor="is_current" style={{ fontSize: '0.875rem', cursor: 'pointer' }}>
              Set as current active academic session immediately
            </label>
          </div>
        </form>
      </Modal>
    </AppLayout>
  );
}
