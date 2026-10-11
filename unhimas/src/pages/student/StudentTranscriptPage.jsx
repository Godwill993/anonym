import { useQuery } from '@tanstack/react-query';
import { MdDownload, MdLock, MdSchool } from 'react-icons/md';
import AppLayout from '../../components/layout/AppLayout';
import { useAuth } from '../../context/AuthContext';
import { getMyStudentProfile, getMyResults } from '../../services/studentService';
import { buildTranscriptSummary } from '../../lib/transcript';

function formatNumber(value) {
  return value === null || value === undefined ? '—' : Number(value).toFixed(2);
}

export default function StudentTranscriptPage() {
  const { session } = useAuth();
  const { data: studentProfile, isLoading: profileLoading } = useQuery({
    queryKey: ['my-student-profile'],
    queryFn: getMyStudentProfile,
    enabled: !!session,
  });
  const studentId = studentProfile?.id;
  const { data: results = [], isLoading: resultsLoading } = useQuery({
    queryKey: ['my-results', studentId],
    queryFn: () => getMyResults(studentId),
    enabled: !!studentId,
  });

  const summary = buildTranscriptSummary(results);
  const isLoading = profileLoading || resultsLoading;
  const producedAt = new Date().toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  const printTranscript = () => window.print();

  return (
    <AppLayout pageTitle="Official Transcript">
      <style>{`
        .transcript-page { background: var(--color-bg); }
        .transcript-toolbar { display: flex; justify-content: space-between; align-items: center; gap: 1rem; margin-bottom: 1rem; flex-wrap: wrap; }
        .transcript-document { background: #fff; border: 1px solid var(--color-border); border-radius: var(--radius-lg); box-shadow: 0 8px 32px rgba(17,47,66,.08); overflow: hidden; }
        .transcript-header { padding: 2rem; background: linear-gradient(135deg, var(--color-primary), #174c64); color: #fff; display: flex; justify-content: space-between; gap: 1.5rem; align-items: center; }
        .transcript-brand { display: flex; align-items: center; gap: 1rem; }
        .transcript-logo { width: 68px; height: 68px; border-radius: 50%; background: #fff; padding: 4px; }
        .transcript-header h1 { font-size: 1.5rem; margin: .25rem 0; }
        .transcript-header p { color: rgba(255,255,255,.7); margin: 0; }
        .transcript-id { text-align: right; font-size: .8rem; color: rgba(255,255,255,.75); }
        .transcript-id strong { display: block; color: #fff; font-size: .95rem; margin-bottom: .25rem; }
        .transcript-summary { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 1px; background: var(--color-border); border-bottom: 1px solid var(--color-border); }
        .transcript-stat { background: #fff; padding: 1rem 1.25rem; }
        .transcript-stat span { display: block; color: var(--color-text-muted); font-size: .75rem; text-transform: uppercase; letter-spacing: .06em; }
        .transcript-stat strong { display: block; margin-top: .35rem; font-size: 1.25rem; color: var(--color-primary); }
        .transcript-body { padding: 1.5rem 2rem 2rem; }
        .transcript-section-title { margin: 1.25rem 0 .5rem; font-size: 1rem; color: var(--color-primary); }
        .transcript-table { width: 100%; border-collapse: collapse; font-size: .82rem; }
        .transcript-table th { text-align: left; color: var(--color-text-muted); font-size: .7rem; text-transform: uppercase; letter-spacing: .04em; border-bottom: 1px solid var(--color-border); padding: .65rem .5rem; }
        .transcript-table td { padding: .72rem .5rem; border-bottom: 1px solid #edf1f4; vertical-align: middle; }
        .transcript-table tbody tr:nth-child(even) { background: #fbfcfd; }
        .transcript-table tfoot td { border-top: 1px solid var(--color-primary); border-bottom: 0; font-weight: 800; }
        .transcript-footer { display: flex; justify-content: space-between; gap: 1rem; margin-top: 2rem; padding-top: 1rem; border-top: 1px solid var(--color-border); color: var(--color-text-muted); font-size: .75rem; }
        .transcript-note { margin: .75rem 0 0; color: var(--color-text-muted); font-size: .75rem; }
        @media print {
          @page { size: A4; margin: 8mm; }
          body { background: #fff !important; }
          .app-shell, .main-area, .page-content { display: block !important; width: 100% !important; margin: 0 !important; }
          .sidebar, .header, .back-to-top, .transcript-toolbar, .transcript-note { display: none !important; }
          .transcript-page { background: #fff !important; }
          .transcript-document { box-shadow: none; border: 0; border-radius: 0; }
          .transcript-header { padding: 1.25rem 1.5rem; }
          .transcript-body { padding: 1rem 1.5rem; }
          .transcript-table { font-size: 8.5pt; }
          .transcript-table td, .transcript-table th { padding: 5px 4px; }
        }
      `}</style>

      <div className="transcript-page">
        <div className="transcript-toolbar">
          <div>
            <h1 className="page-title">Official Transcript</h1>
            <p className="page-subtitle">Complete academic record based on published results</p>
          </div>
          <button className="btn btn-primary" onClick={printTranscript} disabled={isLoading || results.length === 0}>
            <MdDownload /> Print / Save PDF
          </button>
        </div>

        {isLoading ? (
          <div className="card" style={{ padding: '3rem', textAlign: 'center' }}>
            <div className="spinner" style={{ margin: '0 auto 1rem' }} />
            Loading your official academic record...
          </div>
        ) : results.length === 0 ? (
          <div className="empty-state" style={{ paddingTop: '4rem' }}>
            <div className="empty-state-icon"><MdLock size={48} /></div>
            <div className="empty-state-title">No official transcript available</div>
            <p className="empty-state-text">Your published academic results will appear here after the administrator approves and publishes them.</p>
          </div>
        ) : (
          <article className="transcript-document" id="transcript-document">
            <header className="transcript-header">
              <div className="transcript-brand">
                <MdSchool className="transcript-logo" />
                <div>
                  <h1>Academic Transcript</h1>
                  <p>University / School Academic Records</p>
                </div>
              </div>
              <div className="transcript-id">
                <strong>{studentProfile?.matricule}</strong>
                Produced {producedAt}
              </div>
            </header>

            <section className="transcript-summary">
              <div className="transcript-stat"><span>Student</span><strong>{studentProfile?.first_name} {studentProfile?.last_name}</strong></div>
              <div className="transcript-stat"><span>Department</span><strong>{studentProfile?.batches?.departments?.name || '—'}</strong></div>
              <div className="transcript-stat"><span>Overall GPA</span><strong>{formatNumber(summary.overallGpa)}</strong></div>
              <div className="transcript-stat"><span>Total Credits</span><strong>{summary.totalCredits}</strong></div>
            </section>

            <div className="transcript-body">
              {summary.semesters.map((semester) => (
                <section key={semester.id || semester.name}>
                  <h2 className="transcript-section-title">
                    {semester.name} · {semester.academicYear} · Semester GPA {formatNumber(semester.semesterGpa)}
                  </h2>
                  <table className="transcript-table">
                    <thead>
                      <tr>
                        <th>Course Code</th><th>Course Title</th><th>Credits</th><th>Total Score</th><th>Grade</th><th>Grade Point</th>
                      </tr>
                    </thead>
                    <tbody>
                      {semester.marks.map((result) => {
                        const course = result.mark_submissions.batch_courses.courses;
                        return (
                          <tr key={result.id}>
                            <td>{course.code}</td><td>{course.name}</td><td>{course.credit_units}</td>
                            <td>{result.total_score}</td><td>{result.grade}</td><td>{result.grade_point}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr><td colSpan={2}>Semester total</td><td>{semester.attemptedCredits}</td><td colSpan={2}>{formatNumber(semester.semesterGpa)}</td><td>{semester.failed} failed</td></tr>
                    </tfoot>
                  </table>
                </section>
              ))}

              <div className="transcript-footer">
                <span>Completed courses: {summary.completedCourses} · Failed courses: {summary.failedCourses}</span>
                <span>Official record generated from approved published results.</span>
              </div>
            </div>
          </article>
        )}
        <p className="transcript-note">Only results with an administrator-approved published status are included. Transcript data is not altered or inferred from draft marks.</p>
      </div>
    </AppLayout>
  );
}
