import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  MdBook,
  MdGroups,
  MdSchedule,
  MdGrade,
  MdArrowForward,
  MdClass,
} from 'react-icons/md';
import AppLayout from '../../components/layout/AppLayout';
import { useAuth } from '../../context/AuthContext';
import { getMyLecturerProfile, getMyCourses } from '../../services/lecturerService';

export default function LecturerCoursesPage() {
  const { session } = useAuth();
  const [semFilter, setSemFilter] = useState('all');

  const { data: lecturerProfile } = useQuery({
    queryKey: ['my-lecturer-profile'],
    queryFn: getMyLecturerProfile,
    enabled: !!session,
  });

  const lecturerId = lecturerProfile?.id;

  const { data: courses = [], isLoading } = useQuery({
    queryKey: ['my-courses', lecturerId],
    queryFn: () => getMyCourses(lecturerId),
    enabled: !!lecturerId,
  });

  const semesters = [...new Set(courses.map((c) => c.semesters?.id).filter(Boolean))].map((sid) => {
    const course = courses.find((c) => c.semesters?.id === sid);
    return course?.semesters;
  });

  const filtered = semFilter === 'all'
    ? courses
    : courses.filter((c) => c.semesters?.id === semFilter);

  return (
    <AppLayout pageTitle="My Courses">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">My Courses</h1>
          <p className="page-subtitle">All courses assigned to you</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        <button
          className={`btn btn-sm ${semFilter === 'all' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setSemFilter('all')}
        >
          All Semesters
        </button>
        {semesters.map((sem) => (
          <button
            key={sem.id}
            className={`btn btn-sm ${semFilter === sem.id ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setSemFilter(sem.id)}
          >
            {sem.name} ({sem.academic_years?.name})
            {sem.is_current && <span className="badge badge-green" style={{ marginLeft: 6 }}>Current</span>}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="card" style={{ padding: '1.25rem' }}>
              <div className="skeleton skeleton-title" style={{ width: '70%', marginBottom: 8 }} />
              <div className="skeleton skeleton-text" style={{ width: '50%', marginBottom: 6 }} />
              <div className="skeleton skeleton-text" style={{ width: '80%' }} />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><MdBook /></div>
          <div className="empty-state-title">No courses assigned</div>
          <p className="empty-state-text">You have no courses assigned for the selected semester.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
          {filtered.map((bc) => (
            <div key={bc.id} className="card" style={{ transition: 'box-shadow 0.15s' }}
              onMouseEnter={(e) => { e.currentTarget.style.boxShadow = 'var(--shadow-md)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.boxShadow = ''; }}
            >
              <div className="card-header">
                <div>
                  <span className="badge badge-blue" style={{ marginBottom: 4 }}>
                    {bc.courses?.code}
                  </span>
                  <div className="card-title" style={{ marginTop: 2 }}>{bc.courses?.name}</div>
                </div>
                {bc.semesters?.is_current && (
                  <span className="badge badge-green">Current</span>
                )}
              </div>
              <div className="card-body">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                    <MdGroups size={16} />
                    <span>{bc.batches?.name} ({bc.batches?.code})</span>
                  </div>
                  {(bc.batches?.programmes || bc.batches?.year_of_study != null) && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                      <MdBook size={16} />
                      <span>
                        {bc.batches?.programmes ? (
                          <>
                            <code>{bc.batches.programmes.code}</code>
                            {bc.batches.year_of_study != null && (
                              <> · Year {bc.batches.year_of_study}
                                {bc.batches.programmes.duration_years != null && <> of {bc.batches.programmes.duration_years}</>}
                              </>
                            )}
                          </>
                        ) : (
                          <>Year {bc.batches.year_of_study}</>
                        )}
                      </span>
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                    <MdClass size={16} />
                    <span>{bc.batches?.departments?.name}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                    <MdSchedule size={16} />
                    <span>{bc.semesters?.name} — {bc.semesters?.academic_years?.name}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                    <MdBook size={16} />
                    <span>{bc.courses?.credit_units} credit unit(s) · {bc.is_compulsory ? 'Compulsory' : 'Optional'}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                  <Link
                    to={`/lecturer/sessions?bc=${bc.id}`}
                    className="btn btn-outline btn-sm"
                    style={{ flex: 1, justifyContent: 'center' }}
                  >
                    <MdSchedule /> Sessions
                  </Link>
                  <Link
                    to={`/lecturer/marks?bc=${bc.id}`}
                    className="btn btn-primary btn-sm"
                    style={{ flex: 1, justifyContent: 'center' }}
                  >
                    <MdGrade /> Marks <MdArrowForward />
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </AppLayout>
  );
}
