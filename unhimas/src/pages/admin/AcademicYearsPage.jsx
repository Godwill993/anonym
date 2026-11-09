import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  MdAdd,
  MdArrowForward,
  MdCalendarMonth,
  MdDateRange,
  MdEdit,
  MdPlayArrow,
  MdStar,
} from 'react-icons/md';
import AppLayout from '../../components/layout/AppLayout';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import Modal from '../../components/common/Modal';
import { toast } from '../../components/common/Toast';
import {
  advanceCurrentSemester,
  createAcademicYear,
  getAcademicYears,
  setCurrentAcademicYear,
  updateSemesterDates,
} from '../../services/academicService';

const EMPTY_FORM = {
  name: '',
  start_date: '',
  end_date: '',
  is_current: false,
};

function formatDate(value) {
  if (!value) return '—';
  return new Date(`${value}T12:00:00`).toLocaleDateString();
}

function getSortedSemesters(year) {
  return [...(year.semesters || [])].sort((a, b) => Number(a.number) - Number(b.number));
}

function getNextSemester(year) {
  const semesters = getSortedSemesters(year);
  const currentSemester = semesters.find((semester) => semester.is_current);
  const nextNumber = currentSemester ? Number(currentSemester.number) + 1 : 1;
  return semesters.find((semester) => Number(semester.number) === nextNumber) || null;
}

function SemesterStatus({ semester, onEditDates }) {
  const name = semester.semester_type === 'resit'
    ? 'Resit Period'
    : semester.name || `Semester ${semester.number}`;

  return (
    <li className={`academic-semester${semester.is_current ? ' is-current' : ''}`}>
      <div className="academic-semester-heading">
        <span className="academic-semester-name">{name}</span>
        {semester.is_current && (
          <span className="badge badge-green">
            <MdStar aria-hidden="true" /> Current
          </span>
        )}
      </div>
      <span className={`academic-semester-registration${semester.registration_open ? ' is-open' : ''}`}>
        {semester.registration_open ? 'Registration open' : 'Registration closed'}
      </span>
      {(semester.start_date || semester.end_date) && (
        <span className="academic-semester-dates">
          {formatDate(semester.start_date)} – {formatDate(semester.end_date)}
        </span>
      )}
      <button
        type="button"
        className="btn btn-outline btn-sm academic-semester-edit"
        onClick={() => onEditDates(semester)}
      >
        <MdEdit aria-hidden="true" /> Edit dates
      </button>
    </li>
  );
}

export default function AcademicYearsPage() {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [pendingTransition, setPendingTransition] = useState(null);
  const [editingSemester, setEditingSemester] = useState(null);
  const [semesterDates, setSemesterDates] = useState({ start_date: '', end_date: '' });
  const [formData, setFormData] = useState(EMPTY_FORM);

  const { data: years = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin-academic-years'],
    queryFn: getAcademicYears,
  });

  const refreshAcademicStructure = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['admin-academic-years'] }),
      queryClient.invalidateQueries({ queryKey: ['admin-semesters'] }),
      queryClient.invalidateQueries({ queryKey: ['admin-batch-courses'] }),
      queryClient.invalidateQueries({ queryKey: ['batch-semester-readiness'] }),
    ]);
  };

  const createMutation = useMutation({
    mutationFn: createAcademicYear,
    onSuccess: async () => {
      await refreshAcademicStructure();
      toast.success('Academic year and its semesters created successfully');
      setIsModalOpen(false);
      setFormData(EMPTY_FORM);
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to create academic year');
    },
  });

  const setAsCurrentMutation = useMutation({
    mutationFn: setCurrentAcademicYear,
    onSuccess: async () => {
      await refreshAcademicStructure();
      setPendingTransition(null);
      toast.success('Academic year activated at its first semester');
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to activate academic year');
    },
  });

  const advanceMutation = useMutation({
    mutationFn: advanceCurrentSemester,
    onSuccess: async (semester) => {
      await refreshAcademicStructure();
      setPendingTransition(null);
      toast.success(`Moved to ${semester?.name || 'the next semester'}`);
    },
    onError: (err) => {
      toast.error(err.message || 'Could not move to the next semester');
    },
  });

  const updateDatesMutation = useMutation({
    mutationFn: updateSemesterDates,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-academic-years'] });
      await queryClient.invalidateQueries({ queryKey: ['admin-semesters'] });
      toast.success('Semester dates updated');
      setEditingSemester(null);
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to update semester dates');
    },
  });

  const handleSubmit = (event) => {
    event.preventDefault();
    const name = formData.name.trim();

    if (!name || !formData.start_date || !formData.end_date) {
      toast.error('All fields are required');
      return;
    }
    if (formData.end_date <= formData.start_date) {
      toast.error('End date must be after start date');
      return;
    }

    createMutation.mutate({ ...formData, name });
  };

  const openCreateModal = () => {
    setFormData(EMPTY_FORM);
    setIsModalOpen(true);
  };

  const confirmTransition = () => {
    if (pendingTransition?.type === 'activate') {
      setAsCurrentMutation.mutate(pendingTransition.year.id);
    } else if (pendingTransition?.type === 'advance') {
      advanceMutation.mutate();
    }
  };

  const transitionPending = setAsCurrentMutation.isPending || advanceMutation.isPending;

  const openEditDates = (semester) => {
    setEditingSemester(semester);
    setSemesterDates({
      start_date: semester.start_date || '',
      end_date: semester.end_date || '',
    });
  };

  const saveSemesterDates = (event) => {
    event.preventDefault();
    if (Boolean(semesterDates.start_date) !== Boolean(semesterDates.end_date)) {
      toast.error('Enter both dates or leave both blank');
      return;
    }
    if (semesterDates.start_date && semesterDates.end_date <= semesterDates.start_date) {
      toast.error('End date must be after start date');
      return;
    }
    updateDatesMutation.mutate({
      id: editingSemester.id,
      start_date: semesterDates.start_date,
      end_date: semesterDates.end_date,
    });
  };

  return (
    <AppLayout pageTitle="Academic Years">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Academic Years</h1>
          <p className="page-subtitle">
            Create academic years, review their semesters, and advance the active semester from here.
          </p>
        </div>
        <div className="page-header-actions">
          <button type="button" className="btn btn-primary" onClick={openCreateModal}>
            <MdAdd aria-hidden="true" /> New Academic Year
          </button>
        </div>
      </div>

      <div className="academic-years-list">
        {isLoading ? (
          <div className="card empty-state" role="status">Loading academic years…</div>
        ) : isError ? (
          <div className="card empty-state" role="alert">
            <div className="empty-state-title">Could not load academic years</div>
            <p className="empty-state-text">{error?.message || 'An unexpected error occurred.'}</p>
            <button type="button" className="btn btn-outline" onClick={() => refetch()}>
              Try again
            </button>
          </div>
        ) : years.length === 0 ? (
          <div className="card empty-state">
            <MdDateRange className="empty-state-icon" aria-hidden="true" />
            <div className="empty-state-title">No academic years yet</div>
            <p className="empty-state-text">
              Create an academic year to automatically add its first semester, second semester, and resit period.
            </p>
            <button type="button" className="btn btn-primary" onClick={openCreateModal}>
              <MdAdd aria-hidden="true" /> Create academic year
            </button>
          </div>
        ) : (
          years.map((year) => {
            const semesters = getSortedSemesters(year);
            const nextSemester = year.is_current ? getNextSemester(year) : null;
            const hasCurrentSemester = semesters.some((semester) => semester.is_current);

            return (
              <section className="card academic-year-card" key={year.id}>
                <div className="academic-year-header">
                  <div className="academic-year-heading">
                    <div className="academic-year-title-row">
                      <MdCalendarMonth aria-hidden="true" />
                      <h2>{year.name}</h2>
                      {year.is_current ? (
                        <span className="badge badge-green">
                          <MdStar aria-hidden="true" /> Active academic year
                        </span>
                      ) : (
                        <span className="badge badge-gray">Inactive</span>
                      )}
                    </div>
                    <p className="academic-year-dates">
                      {formatDate(year.start_date)} – {formatDate(year.end_date)}
                      <span>{semesters.length} academic periods</span>
                    </p>
                  </div>

                  <div className="academic-year-actions">
                    {year.is_current && nextSemester ? (
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => setPendingTransition({
                          type: 'advance',
                          nextSemester,
                        })}
                        disabled={advanceMutation.isPending || setAsCurrentMutation.isPending}
                      >
                        {hasCurrentSemester
                          ? <MdArrowForward aria-hidden="true" />
                          : <MdPlayArrow aria-hidden="true" />}
                        {hasCurrentSemester
                          ? `Move to ${nextSemester.semester_type === 'resit' ? 'Resit Period' : nextSemester.name}`
                          : 'Start First Semester'}
                      </button>
                    ) : !year.is_current ? (
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() => setPendingTransition({ type: 'activate', year })}
                        disabled={setAsCurrentMutation.isPending || advanceMutation.isPending}
                      >
                        <MdPlayArrow aria-hidden="true" /> Activate year
                      </button>
                    ) : null}
                  </div>
                </div>

                <div className="academic-year-periods">
                  <h3>Semesters and resit period</h3>
                  {semesters.length > 0 ? (
                    <ol className="academic-semester-list">
                      {semesters.map((semester) => (
                        <SemesterStatus
                          key={semester.id}
                          semester={semester}
                          onEditDates={openEditDates}
                        />
                      ))}
                    </ol>
                  ) : (
                    <p className="academic-year-no-periods">
                      No semesters are configured for this year.
                    </p>
                  )}
                  {year.is_current && !nextSemester && hasCurrentSemester && (
                    <p className="academic-year-hint">
                      This is the last period in the year. Activate another academic year when ready to begin it.
                    </p>
                  )}
                </div>
              </section>
            );
          })
        )}
      </div>

      <ConfirmDialog
        isOpen={Boolean(pendingTransition)}
        onClose={() => setPendingTransition(null)}
        onConfirm={confirmTransition}
        title={pendingTransition?.type === 'activate' ? 'Activate academic year?' : 'Advance academic period?'}
        message={pendingTransition?.type === 'activate'
          ? `Activate ${pendingTransition.year.name}? This closes the current semester and opens registration for its First Semester.`
          : `Move to ${pendingTransition?.nextSemester?.name || 'the next semester'}? This closes the current registration period and opens the next one.`}
        confirmLabel="Continue"
        isLoading={transitionPending}
      />

      <Modal
        isOpen={Boolean(editingSemester)}
        onClose={() => setEditingSemester(null)}
        title={`Edit ${editingSemester?.semester_type === 'resit'
          ? 'Resit Period'
          : editingSemester?.name || 'Semester'} dates`}
        footer={
          <>
            <button type="button" className="btn btn-outline" onClick={() => setEditingSemester(null)}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={saveSemesterDates}
              disabled={updateDatesMutation.isPending}
            >
              {updateDatesMutation.isPending ? 'Saving…' : 'Save dates'}
            </button>
          </>
        }
      >
        <form onSubmit={saveSemesterDates}>
          <p className="academic-year-form-hint">
            Set both dates, or leave both blank if the period dates are not scheduled yet.
          </p>
          <div className="academic-year-date-fields">
            <div className="form-group">
              <label className="form-label" htmlFor="semester-start-date">Start Date</label>
              <input
                id="semester-start-date"
                type="date"
                className="form-input"
                value={semesterDates.start_date}
                onChange={(event) => setSemesterDates({ ...semesterDates, start_date: event.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="semester-end-date">End Date</label>
              <input
                id="semester-end-date"
                type="date"
                className="form-input"
                value={semesterDates.end_date}
                min={semesterDates.start_date || undefined}
                onChange={(event) => setSemesterDates({ ...semesterDates, end_date: event.target.value })}
              />
            </div>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Create Academic Year"
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
              {createMutation.isPending ? 'Creating…' : 'Create Academic Year'}
            </button>
          </>
        }
      >
        <form onSubmit={handleSubmit}>
          <p className="academic-year-form-hint">
            First Semester, Second Semester, and Resit Period will be created automatically.
          </p>
          <div className="form-group">
            <label className="form-label" htmlFor="academic-year-name">Academic Year Name *</label>
            <input
              id="academic-year-name"
              type="text"
              className="form-input"
              placeholder="e.g. 2026/2027"
              value={formData.name}
              onChange={(event) => setFormData({ ...formData, name: event.target.value })}
              required
            />
          </div>

          <div className="academic-year-date-fields">
            <div className="form-group">
              <label className="form-label" htmlFor="academic-year-start">Start Date *</label>
              <input
                id="academic-year-start"
                type="date"
                className="form-input"
                value={formData.start_date}
                onChange={(event) => setFormData({ ...formData, start_date: event.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="academic-year-end">End Date *</label>
              <input
                id="academic-year-end"
                type="date"
                className="form-input"
                value={formData.end_date}
                onChange={(event) => setFormData({ ...formData, end_date: event.target.value })}
                min={formData.start_date || undefined}
                required
              />
            </div>
          </div>

          <label className="academic-year-current-option" htmlFor="academic-year-current">
            <input
              type="checkbox"
              id="academic-year-current"
              checked={formData.is_current}
              onChange={(event) => setFormData({ ...formData, is_current: event.target.checked })}
            />
            Set as the active year and open First Semester registration immediately
          </label>
        </form>
      </Modal>
    </AppLayout>
  );
}
