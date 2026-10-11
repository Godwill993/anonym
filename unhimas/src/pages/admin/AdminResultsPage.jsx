import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MdSearch, MdSchool } from 'react-icons/md';
import AppLayout from '../../components/layout/AppLayout';
import { getPublishedResults } from '../../services/results';

export default function AdminResultsPage() {
  const [search, setSearch] = useState('');

  // Fetch published results from the SQL view 'results'.
  const { data: results = [], isLoading } = useQuery({
    queryKey: ['admin-results-view'],
    queryFn: getPublishedResults,
  });

  const filtered = results.filter((r) => {
    const s = search.toLowerCase();
    const mat = r.matricule?.toLowerCase() || '';
    const name = r.student_name?.toLowerCase() || '';
    const code = r.course_code?.toLowerCase() || '';
    return mat.includes(s) || name.includes(s) || code.includes(s);
  });

  return (
    <AppLayout pageTitle="Official Results">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Published Results Registry</h1>
          <p className="page-subtitle">Verified academic results, letter grades, and grade points populated from the official results view</p>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
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
              placeholder="Search by matricule, student name, or course code..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Matricule</th>
                <th>Student</th>
                <th>Course</th>
                <th>CA Score (/30)</th>
                <th>Exam Score (/70)</th>
                <th>Total (/100)</th>
                <th>Grade</th>
                <th>Grade Point</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan="8" style={{ textAlign: 'center', padding: '3rem' }}>Loading published results...</td></tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '3rem' }}>
                    <div className="empty-state">
                      <MdSchool className="empty-state-icon" />
                      <div className="empty-state-title">No Published Results Yet</div>
                      <div className="empty-state-text">
                        Results become visible in this registry once approved marksheets are published by administrators.
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((r, idx) => (
                  <tr key={idx}>
                    <td><code>{r.matricule}</code></td>
                    <td><strong>{r.student_name}</strong></td>
                    <td>
                      <code>{r.course_code}</code> {r.course_name}
                    </td>
                    <td>{(Number(r.attendance_score || 0) + Number(r.coursework_score || 0)).toFixed(1)}</td>
                    <td>{r.exam_score}</td>
                    <td><strong>{r.total_score}</strong></td>
                    <td>
                      <span className={`badge ${r.grade === 'A' || r.grade === 'B' ? 'badge-green' : r.grade === 'C' || r.grade === 'D' ? 'badge-blue' : 'badge-red'}`}>
                        {r.grade}
                      </span>
                    </td>
                    <td><strong>{r.grade_point}</strong></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppLayout>
  );
}
