import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { MdLock, MdTrendingUp, MdWarning, MdAccountBalanceWallet } from 'react-icons/md';
import AppLayout from '../../components/layout/AppLayout';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from '../../i18n';
import { supabase } from '../../lib/supabase';
import { getMyStudentProfile, getMyResults } from '../../services/studentService';
import { checkFeeClearance } from '../../services/feeClearance';
import { formatXAF } from '../../services/feesService';

function GradeCell({ grade, gp }) {
  const colors = {
    A: 'badge-green', B: 'badge-blue', C: 'badge-amber', D: 'badge-amber', F: 'badge-red',
  };
  return (
    <span className={`badge ${colors[grade] || 'badge-gray'}`}>
      {grade} ({gp})
    </span>
  );
}

export default function StudentResultsPage() {
  const { session } = useAuth();
  const { translateText } = useTranslation();
  const [semFilter, setSemFilter] = useState('all');

  const { data: studentProfile, isLoading: stuLoading } = useQuery({
    queryKey: ['my-student-profile'],
    queryFn: getMyStudentProfile,
    enabled: !!session,
  });

  const studentId = studentProfile?.id;

  const { data: clearance, isLoading: clearanceLoading } = useQuery({
    queryKey: ['fee-clearance', studentId],
    queryFn: () => checkFeeClearance(studentId),
    enabled: !!studentId,
  });

  const { data: results = [], isLoading: resLoading } = useQuery({
    queryKey: ['my-results', studentId],
    queryFn: () => getMyResults(studentId),
    enabled: !!studentId && clearance?.cleared !== false,
  });

  const { data: semesterGpaList = [] } = useQuery({
    queryKey: ['student-semester-gpa', studentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('student_semester_gpa')
        .select('*')
        .eq('student_id', studentId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!studentId && clearance?.cleared !== false,
  });

  const { data: overallGpaData } = useQuery({
    queryKey: ['student-overall-gpa', studentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('student_overall_gpa')
        .select('*')
        .eq('student_id', studentId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!studentId && clearance?.cleared !== false,
  });

  const semesterGpaMap = {};
  (semesterGpaList || []).forEach((g) => {
    semesterGpaMap[g.semester_id] = g.semester_gpa;
  });

  const bySemester = {};
  results.forEach((r) => {
    const semKey = r.mark_submissions?.batch_courses?.semesters?.id;
    const semName = r.mark_submissions?.batch_courses?.semesters?.name
      + ' — '
      + r.mark_submissions?.batch_courses?.semesters?.academic_years?.name;
    const semNum = r.mark_submissions?.batch_courses?.semesters?.number;
    if (!bySemester[semKey]) {
      bySemester[semKey] = { semKey, semName, semNum, marks: [] };
    }
    bySemester[semKey].marks.push(r);
  });

  const semesters = Object.values(bySemester).sort((a, b) => b.semNum - a.semNum);
  const filtered = semFilter === 'all' ? semesters : semesters.filter((s) => s.semKey === semFilter);

  const computeGPA = (marks, semId) => {
    if (semId && semesterGpaMap[semId] !== undefined) {
      return Number(semesterGpaMap[semId]).toFixed(2);
    }
    if (!marks.length) return null;
    let totalPoints = 0;
    let totalCredits = 0;
    marks.forEach((m) => {
      const credits = Number(m.mark_submissions?.batch_courses?.courses?.credit_units || 3);
      totalPoints += Number(m.grade_point || 0) * credits;
      totalCredits += credits;
    });
    return totalCredits > 0 ? (totalPoints / totalCredits).toFixed(2) : '0.00';
  };

  const isLoading = stuLoading || clearanceLoading || (clearance?.cleared !== false && resLoading);

  if (!clearanceLoading && clearance && !clearance.cleared && clearance.required) {
    return (
      <AppLayout pageTitle="My Results">
        <div className="page-header">
          <div className="page-header-left">
            <h1 className="page-title">{translateText('My Results')}</h1>
            <p className="page-subtitle">{translateText('Fee clearance required')}</p>
          </div>
        </div>
        <div className="empty-state" style={{ paddingTop: '3rem' }}>
          <div className="empty-state-icon">
            <MdAccountBalanceWallet size={48} />
          </div>
          <div className="empty-state-title">{translateText('Outstanding fees')}</div>
          <p className="empty-state-text">
            {translateText('Settle your balance to view official results.')}{' '}
            {clearance.outstanding != null && (
              <strong>{formatXAF(clearance.outstanding)}</strong>
            )}
          </p>
          <Link to="/student/fees" className="btn btn-primary">
            {translateText('Go to Fees & Payments')}
          </Link>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout pageTitle="My Results">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">{translateText('My Results')}</h1>
          <p className="page-subtitle">{translateText('Published academic results only')}</p>
        </div>
        {overallGpaData?.overall_gpa !== undefined && overallGpaData?.overall_gpa !== null && (
          <div className="page-header-actions">
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.6rem',
                padding: '0.5rem 1rem',
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              <MdTrendingUp style={{ color: 'var(--color-secondary)', fontSize: '1.25rem' }} />
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                  Cumulative GPA
                </div>
                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--color-primary)' }}>
                  {Number(overallGpaData.overall_gpa).toFixed(2)}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        <button
          type="button"
          className={`btn btn-sm ${semFilter === 'all' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setSemFilter('all')}
        >
          {translateText('All Semesters')}
        </button>
        {semesters.map((s) => (
          <button
            key={s.semKey}
            type="button"
            className={`btn btn-sm ${semFilter === s.semKey ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setSemFilter(s.semKey)}
          >
            {s.semName}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="card" style={{ padding: '1.5rem' }}>
          {[1, 2, 3].map((i) => (
            <div key={i} style={{ marginBottom: 12 }}>
              <div className="skeleton skeleton-text" style={{ width: '60%', marginBottom: 6 }} />
              <div className="skeleton skeleton-text" style={{ width: '40%' }} />
            </div>
          ))}
        </div>
      ) : results.length === 0 ? (
        <div className="empty-state" style={{ paddingTop: '3rem' }}>
          <div className="empty-state-icon" style={{ color: 'var(--color-text-muted)', opacity: 0.5 }}>
            <MdLock size={48} />
          </div>
          <div className="empty-state-title">{translateText('No published results')}</div>
          <p className="empty-state-text">
            {translateText('Your results will appear here once the administrator publishes them.')}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {filtered.map((sem) => {
            const gpa = computeGPA(sem.marks, sem.semKey);
            const failed = sem.marks.filter((m) => m.grade === 'F').length;
            return (
              <div key={sem.semKey} className="card">
                <div
                  className="card-header"
                  style={{
                    background: 'var(--color-primary)',
                    color: '#fff',
                    borderRadius: '0',
                  }}
                >
                  <span style={{ fontWeight: 700, fontSize: '0.9375rem', color: '#fff' }}>{sem.semName}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    {failed > 0 && (
                      <span className="badge" style={{ background: 'rgba(183,0,50,0.35)', color: '#fff' }}>
                        <MdWarning /> {failed} Failed
                      </span>
                    )}
                    {gpa && (
                      <span className="badge" style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', fontWeight: 800 }}>
                        GPA: {gpa}
                      </span>
                    )}
                  </div>
                </div>
                <div className="table-wrapper">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Course</th>
                        <th>Credit Units</th>
                        <th>Attendance</th>
                        <th>Coursework</th>
                        <th>Exam</th>
                        <th>Total</th>
                        <th>Grade</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sem.marks.map((m) => {
                        const course = m.mark_submissions?.batch_courses?.courses;
                        return (
                          <tr key={m.id} style={{ background: m.grade === 'F' ? 'rgba(183,0,50,0.03)' : undefined }}>
                            <td>
                              <div style={{ fontWeight: 600 }}>{course?.name}</div>
                              <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>{course?.code}</div>
                            </td>
                            <td>{course?.credit_units}</td>
                            <td>{m.attendance_score}</td>
                            <td>{m.coursework_score}</td>
                            <td>{m.exam_score}</td>
                            <td>
                              <strong style={{ color: m.grade === 'F' ? 'var(--color-secondary)' : 'var(--color-text)' }}>
                                {m.total_score}
                              </strong>
                            </td>
                            <td>
                              <GradeCell grade={m.grade} gp={m.grade_point} />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={6} style={{ fontWeight: 700, textAlign: 'right', paddingRight: '1rem', color: 'var(--color-text-muted)', fontSize: '0.8125rem' }}>
                          Semester GPA:
                        </td>
                        <td>
                          <span style={{ fontWeight: 800, fontSize: '1.125rem', color: 'var(--color-primary)' }}>
                            {gpa || '—'}
                          </span>
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </AppLayout>
  );
}
