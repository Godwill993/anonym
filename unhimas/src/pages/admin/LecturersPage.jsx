import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  MdAdd,
  MdPersonPin,
  MdSearch,
  MdClose,
  MdEdit,
  MdDelete,
  MdToggleOn,
  MdToggleOff,
  MdEmail,
  MdPhone,
  MdPersonAdd,
  MdCheckCircle,
  MdFileDownload,
  MdChevronLeft,
  MdChevronRight,
} from 'react-icons/md';
import { Link } from 'react-router-dom';
import AppLayout from '../../components/layout/AppLayout';
import Modal from '../../components/common/Modal';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import { toast } from '../../components/common/Toast';
import { useTranslation } from '../../i18n';
import { exportToCsv } from '../../utils/exportUtils';
import {
  getLecturers,
  createLecturer,
  updateLecturer,
  deleteSchoolAccount,
} from '../../services/peopleService';
import { getDepartments } from '../../services/academicService';

export default function LecturersPage() {
  const { language, translateText } = useTranslation();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLecturer, setEditingLecturer] = useState(null);
  const [lecturerToDelete, setLecturerToDelete] = useState(null);

  const [formData, setFormData] = useState({
    staff_id: '',
    first_name: '',
    middle_name: '',
    last_name: '',
    email: '',
    phone: '',
    department_id: '',
    specialization: '',
  });

  const { data: lecturers = [], isLoading } = useQuery({
    queryKey: ['admin-lecturers', deptFilter],
    queryFn: () => getLecturers({ departmentId: deptFilter || null }),
  });

  const { data: departments = [] } = useQuery({
    queryKey: ['admin-departments'],
    queryFn: getDepartments,
  });

  const createMutation = useMutation({
    mutationFn: createLecturer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-lecturers'] });
      queryClient.invalidateQueries({ queryKey: ['admin-overview-stats'] });
      toast.success('Lecturer record created. Use "Create Account" to provision their login.');
      handleCloseModal();
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to create lecturer');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }) => updateLecturer(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-lecturers'] });
      toast.success('Lecturer updated successfully');
      handleCloseModal();
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to update lecturer');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (lecturer) => deleteSchoolAccount({ recordType: 'lecturer', recordId: lecturer.id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-lecturers'] });
      queryClient.invalidateQueries({ queryKey: ['admin-overview-stats'] });
      queryClient.invalidateQueries({ queryKey: ['admin-batch-courses'] });
      toast.success('Lecturer deleted successfully');
      setLecturerToDelete(null);
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to delete lecturer');
    },
  });

  const handleOpenAdd = () => {
    setEditingLecturer(null);
    setFormData({
      staff_id: `LEC-${Math.floor(1000 + Math.random() * 9000)}`,
      first_name: '',
      middle_name: '',
      last_name: '',
      email: '',
      phone: '',
      department_id: departments[0]?.id || '',
      specialization: '',
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (lec) => {
    setEditingLecturer(lec);
    setFormData({
      staff_id: lec.staff_id,
      first_name: lec.first_name,
      middle_name: lec.middle_name || '',
      last_name: lec.last_name,
      email: lec.email || '',
      phone: lec.phone || '',
      department_id: lec.department_id || '',
      specialization: lec.specialization || '',
    });
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingLecturer(null);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.staff_id.trim() || !formData.first_name.trim() || !formData.last_name.trim()) {
      toast.error('Staff ID, First Name, and Last Name are required');
      return;
    }

    if (editingLecturer) {
      updateMutation.mutate({
        id: editingLecturer.id,
        updates: formData,
      });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleToggleStatus = (lec) => {
    updateMutation.mutate({
      id: lec.id,
      updates: { is_active: !lec.is_active },
    });
  };

  const filteredLecturers = useMemo(() => {
    const term = search.toLowerCase();
    return lecturers.filter((l) => {
      return (
        l.staff_id?.toLowerCase().includes(term) ||
        l.first_name?.toLowerCase().includes(term) ||
        l.last_name?.toLowerCase().includes(term) ||
        (l.specialization && l.specialization.toLowerCase().includes(term))
      );
    });
  }, [lecturers, search]);

  const totalPages = Math.ceil(filteredLecturers.length / pageSize) || 1;
  const paginatedLecturers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredLecturers.slice(start, start + pageSize);
  }, [filteredLecturers, currentPage, pageSize]);

  const handleExportCsv = () => {
    if (!filteredLecturers.length) return;
    const headers = [
      { label: 'Staff ID', key: 'staff_id' },
      { label: 'First Name', key: 'first_name' },
      { label: 'Middle Name', key: 'middle_name' },
      { label: 'Last Name', key: 'last_name' },
      { label: 'Department', key: 'department_name' },
      { label: 'Specialization', key: 'specialization' },
      { label: 'Email', key: 'email' },
      { label: 'Phone', key: 'phone' },
      { label: 'Status', key: 'status_label' },
    ];
    const exportRows = filteredLecturers.map((l) => ({
      ...l,
      department_name: l.departments?.name ? `${l.departments.name} (${l.departments.abbreviation})` : '',
      status_label: l.is_active ? 'Active' : 'On Leave',
    }));
    exportToCsv('unhimas_faculty_lecturers', headers, exportRows);
  };

  return (
    <AppLayout pageTitle="Faculty Lecturers">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">{translateText('Faculty Lecturers')}</h1>
          <p className="page-subtitle">{translateText('Academic teaching staff, departmental assignments, and credentials')}</p>
        </div>
        <div className="page-header-actions">
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={handleExportCsv}
            disabled={filteredLecturers.length === 0}
            title={translateText('Export faculty to CSV')}
          >
            <MdFileDownload /> {translateText('Export CSV')}
          </button>
          <Link to="/admin/create-account" className="btn btn-outline btn-sm">
            <MdPersonAdd /> {translateText('Create Account')}
          </Link>
          <button className="btn btn-primary btn-sm" onClick={handleOpenAdd}>
            <MdAdd /> {translateText('Add Faculty Lecturer')}
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
              style={{ paddingLeft: '2.25rem', paddingRight: search ? '2rem' : '0.875rem' }}
              placeholder={translateText('Search by staff ID, name, or specialization...')}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
            />
            {search && (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setCurrentPage(1);
                }}
                style={{
                  position: 'absolute',
                  right: '0.6rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-text-muted)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                }}
                aria-label={translateText('Clear search')}
              >
                <MdClose size={16} />
              </button>
            )}
          </div>

          <div style={{ minWidth: '180px' }}>
            <select
              className="form-input"
              value={deptFilter}
              onChange={(e) => {
                setDeptFilter(e.target.value);
                setCurrentPage(1);
              }}
              aria-label={translateText('Filter by department')}
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
                <th>{translateText('Lecturer Name')}</th>
                <th>{translateText('Primary Department')}</th>
                <th>{translateText('Specialization')}</th>
                <th>{translateText('Contact')}</th>
                <th>{translateText('Status')}</th>
                <th>{translateText('Account')}</th>
                <th style={{ textAlign: 'right' }}>{translateText('Actions')}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '3rem' }}>
                    {translateText('Loading faculty staff...')}
                  </td>
                </tr>
              ) : filteredLecturers.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '3rem' }}>
                    <div className="empty-state">
                      <MdPersonPin className="empty-state-icon" />
                      <div className="empty-state-title">
                        {translateText(search ? 'No Matching Lecturers' : 'No Lecturers Found')}
                      </div>
                      <div className="empty-state-text">
                        {translateText(
                          search
                            ? 'No faculty members match your filter criteria.'
                            : 'Add lecturers to assign course loads and track campus hours.'
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedLecturers.map((lec) => (
                  <tr key={lec.id}>
                    <td>
                      <code style={{ fontSize: '0.85rem', background: 'var(--color-bg)', padding: '2px 6px', borderRadius: '4px', fontWeight: 700, color: 'var(--color-secondary)' }}>
                        {lec.staff_id}
                      </code>
                    </td>
                    <td>
                      <strong>{lec.first_name} {lec.middle_name ? `${lec.middle_name} ` : ''}{lec.last_name}</strong>
                    </td>
                    <td>{lec.departments?.name ? `${lec.departments.name} (${lec.departments.abbreviation})` : '—'}</td>
                    <td>
                      {lec.specialization ? (
                        <span className="badge badge-purple">{lec.specialization}</span>
                      ) : (
                        <span style={{ color: 'var(--color-text-muted)' }}>—</span>
                      )}
                    </td>
                    <td>
                      {lec.email && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem' }}>
                          <MdEmail style={{ color: 'var(--color-text-muted)' }} /> {lec.email}
                        </div>
                      )}
                      {lec.phone && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                          <MdPhone /> {lec.phone}
                        </div>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${lec.is_active ? 'badge-green' : 'badge-gray'}`}>
                        {lec.is_active ? 'Active' : 'On Leave'}
                      </span>
                    </td>
                    <td>
                      {lec.profile_id ? (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem', color: '#059669' }}>
                          <MdCheckCircle /> Linked
                        </span>
                      ) : (
                        <Link
                          to="/admin/create-account"
                          className="btn-icon"
                          title="Create login account for this lecturer"
                          style={{ fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--color-secondary)' }}
                        >
                          <MdPersonAdd /> Create Account
                        </Link>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '0.25rem' }}>
                        <button
                          className="btn-icon"
                          title="Edit lecturer"
                          aria-label={`Edit lecturer ${lec.staff_id}`}
                          onClick={() => handleOpenEdit(lec)}
                        >
                          <MdEdit />
                        </button>
                        <button
                          className="btn-icon"
                          title={lec.is_active ? 'Deactivate' : 'Activate'}
                          onClick={() => handleToggleStatus(lec)}
                        >
                          {lec.is_active ? <MdToggleOn style={{ color: '#059669', fontSize: '1.25rem' }} /> : <MdToggleOff style={{ color: 'var(--color-text-muted)', fontSize: '1.25rem' }} />}
                        </button>
                        <button
                          className="btn-icon"
                          title="Delete lecturer and login account"
                          aria-label={`Delete lecturer ${lec.staff_id}`}
                          onClick={() => setLecturerToDelete(lec)}
                          disabled={deleteMutation.isPending}
                        >
                          <MdDelete style={{ color: 'var(--color-secondary)' }} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {filteredLecturers.length > 0 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.875rem 1.25rem',
              borderTop: '1px solid var(--color-border)',
              fontSize: '0.8125rem',
              color: 'var(--color-text-muted)',
              flexWrap: 'wrap',
              gap: '0.75rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              <div>
                {language === 'fr'
                  ? `Affichage de ${(currentPage - 1) * pageSize + 1} à ${Math.min(
                      currentPage * pageSize,
                      filteredLecturers.length
                    )} sur ${filteredLecturers.length} enseignants`
                  : `Showing ${(currentPage - 1) * pageSize + 1} to ${Math.min(
                      currentPage * pageSize,
                      filteredLecturers.length
                    )} of ${filteredLecturers.length} faculty members`}
              </div>

              {filteredLecturers.length > 10 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <span style={{ fontSize: '0.75rem' }}>{translateText('Per page:')}</span>
                  <select
                    className="form-input"
                    style={{ height: '30px', padding: '0.1rem 0.5rem', width: 'auto', fontSize: '0.75rem' }}
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    aria-label={translateText('Select rows per page')}
                  >
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>
              )}
            </div>

            {totalPages > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  aria-label={translateText('Previous page')}
                >
                  <MdChevronLeft /> {translateText('Prev')}
                </button>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: '0 0.5rem',
                    fontWeight: 600,
                    color: 'var(--color-text)',
                    fontSize: '0.8125rem',
                  }}
                >
                  {currentPage} / {totalPages}
                </span>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  aria-label={translateText('Next page')}
                >
                  {translateText('Next')} <MdChevronRight />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={editingLecturer ? 'Edit Faculty Lecturer' : 'Add Faculty Lecturer'}
        footer={
          <>
            <button type="button" className="btn btn-outline" onClick={handleCloseModal}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {editingLecturer ? 'Save Changes' : 'Create Lecturer'}
            </button>
          </>
        }
      >
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Staff ID *</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. LEC-1042"
              value={formData.staff_id}
              onChange={(e) => setFormData({ ...formData, staff_id: e.target.value.toUpperCase() })}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
            <div className="form-group">
              <label className="form-label">First Name *</label>
              <input
                type="text"
                className="form-input"
                value={formData.first_name}
                onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Middle Name</label>
              <input
                type="text"
                className="form-input"
                value={formData.middle_name}
                onChange={(e) => setFormData({ ...formData, middle_name: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Last Name *</label>
              <input
                type="text"
                className="form-input"
                value={formData.last_name}
                onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Primary Department</label>
            <select
              className="form-input"
              value={formData.department_id}
              onChange={(e) => setFormData({ ...formData, department_id: e.target.value })}
            >
              <option value="">None / Cross-Faculty</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.abbreviation})
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Specialization / Academic Area</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Software Architecture, Database Systems"
              value={formData.specialization}
              onChange={(e) => setFormData({ ...formData, specialization: e.target.value })}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input
                type="email"
                className="form-input"
                placeholder="lecturer@unhimas.edu"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Phone Number</label>
              <input
                type="tel"
                className="form-input"
                placeholder="+237 6..."
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
          </div>
        </form>
      </Modal>
      <ConfirmDialog
        isOpen={Boolean(lecturerToDelete)}
        onClose={() => {
          if (!deleteMutation.isPending) setLecturerToDelete(null);
        }}
        onConfirm={() => lecturerToDelete && deleteMutation.mutate(lecturerToDelete)}
        title="Delete lecturer and login?"
        message={lecturerToDelete
          ? `Permanently delete ${lecturerToDelete.first_name} ${lecturerToDelete.last_name} (${lecturerToDelete.staff_id}) and their linked login, if any? Deletion is blocked while the lecturer has class sessions, attendance shifts, mark submissions, or timetable slots. Course assignments will be unassigned.`
          : ''}
        confirmLabel="Delete Lecturer"
        isDestructive
        isLoading={deleteMutation.isPending}
      />
    </AppLayout>
  );
}
