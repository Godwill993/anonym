import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MdAssignment, MdSearch, MdWarning, MdFileDownload } from 'react-icons/md';
import AppLayout from '../../../components/layout/AppLayout';
import { getResultsReport } from '../../../services/adminReportsService';
import { exportToCsv } from '../../../utils/exportUtils';

export default function ResultsReportPage() {
  const [search, setSearch] = useState('');
  const { data: report = [], isLoading, error } = useQuery({ queryKey: ['admin-results-report'], queryFn: getResultsReport });
  const filtered = report.filter((item) => `${item.matricule} ${item.student_name} ${item.course_code} ${item.academic_year}`.toLowerCase().includes(search.toLowerCase()));

  const handleExport = () => {
    const headers = [
      { label: 'First Name', key: 'first_name' },
      { label: 'Last Name', key: 'last_name' },
      { label: 'Matricule', key: 'matricule' },
      { label: 'Academic Year', key: 'academic_year' },
      { label: 'Semester', key: 'semester' },
      { label: 'Course Code', key: 'course_code' },
      { label: 'Course Name', key: 'course_name' },
      { label: 'Total Score', key: 'total_score' },
      { label: 'Grade', key: 'grade' },
      { label: 'Grade Point', key: 'grade_point' },
    ];
    exportToCsv('unhimas_published_results_report', headers, filtered);
  };

  return (
    <AppLayout pageTitle="Results Report">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Results Report</h1>
          <p className="page-subtitle">Published student results and academic-year summaries</p>
        </div>
        <div className="page-header-actions">
          <button
            className="btn btn-outline btn-sm"
            onClick={handleExport}
            disabled={filtered.length === 0}
          >
            <MdFileDownload /> Export CSV
          </button>
        </div>
      </div>
      <div className="card"><div className="card-header"><div style={{ position: 'relative', width: 'min(100%, 360px)' }}><MdSearch style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} /><input className="form-input" style={{ paddingLeft: '2.25rem' }} placeholder="Search matricule, student, course or year" value={search} onChange={(event) => setSearch(event.target.value)} /></div></div>{isLoading ? <div className="empty-state">Loading report...</div> : error ? <div className="empty-state"><MdWarning className="empty-state-icon" /><div className="empty-state-title">Report unavailable</div><div className="empty-state-text">The results report could not be loaded.</div></div> : filtered.length === 0 ? <div className="empty-state"><MdAssignment className="empty-state-icon" /><div className="empty-state-title">No published results</div><div className="empty-state-text">Published results will appear here.</div></div> : <div className="table-wrapper"><table className="data-table"><thead><tr><th>Student</th><th>Matricule</th><th>Academic Year</th><th>Semester</th><th>Course</th><th>Total</th><th>Grade</th><th>GPA Point</th></tr></thead><tbody>{filtered.map((item, index) => <tr key={`${item.student_id}-${item.course_id}-${item.semester_id}-${index}`}><td><strong>{item.first_name} {item.last_name}</strong></td><td><code>{item.matricule}</code></td><td>{item.academic_year}</td><td>{item.semester}</td><td><code>{item.course_code}</code> {item.course_name}</td><td><strong>{item.total_score}</strong></td><td><span className={`badge ${item.grade === 'A' || item.grade === 'B' ? 'badge-green' : item.grade === 'C' || item.grade === 'D' ? 'badge-blue' : 'badge-red'}`}>{item.grade}</span></td><td><strong>{item.grade_point}</strong></td></tr>)}</tbody></table></div>}</div>
    </AppLayout>
  );
}
