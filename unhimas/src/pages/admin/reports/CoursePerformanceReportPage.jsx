import { useQuery } from '@tanstack/react-query';
import { MdAnalytics, MdWarning, MdFileDownload } from 'react-icons/md';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import AppLayout from '../../../components/layout/AppLayout';
import { getCoursePerformanceReport } from '../../../services/adminReportsService';
import { exportToCsv } from '../../../utils/exportUtils';

export default function CoursePerformanceReportPage() {
  const { data: report = [], isLoading, error } = useQuery({ queryKey: ['admin-course-performance-report'], queryFn: getCoursePerformanceReport });
  const chartData = report.slice(0, 12).map((item) => ({ name: item.course_code, average: Number(item.average_score || 0), passes: Number(item.passes || 0), failures: Number(item.failures || 0) }));
  const totalStudents = report.reduce((sum, item) => sum + Number(item.students || 0), 0);
  const averageScore = report.length ? report.reduce((sum, item) => sum + Number(item.average_score || 0), 0) / report.length : 0;

  const handleExport = () => {
    const headers = [
      { label: 'Course Code', key: 'course_code' },
      { label: 'Course Name', key: 'course_name' },
      { label: 'Total Students', key: 'students' },
      { label: 'Average Score', key: 'average_score' },
      { label: 'Passes', key: 'passes' },
      { label: 'Failures', key: 'failures' },
    ];
    exportToCsv('unhimas_course_performance_report', headers, report);
  };

  return (
    <AppLayout pageTitle="Academic Performance Report">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Academic Performance Report</h1>
          <p className="page-subtitle">Published results summarized by course</p>
        </div>
        <div className="page-header-actions">
          <button
            className="btn btn-outline btn-sm"
            onClick={handleExport}
            disabled={report.length === 0}
          >
            <MdFileDownload /> Export CSV
          </button>
        </div>
      </div>
      <div className="stats-grid"><div className="stat-card"><div className="stat-card-icon blue"><MdAnalytics /></div><div className="stat-card-body"><div className="stat-card-value">{totalStudents}</div><div className="stat-card-label">Published Results</div></div></div><div className="stat-card"><div className="stat-card-icon green"><MdAnalytics /></div><div className="stat-card-body"><div className="stat-card-value">{averageScore.toFixed(1)}</div><div className="stat-card-label">Average Score</div></div></div></div>
      <div className="card"><div className="card-header"><h2>Course Performance</h2></div>{isLoading ? <div className="empty-state">Loading report...</div> : error ? <div className="empty-state"><MdWarning className="empty-state-icon" /><div className="empty-state-title">Report unavailable</div><div className="empty-state-text">The academic performance report could not be loaded.</div></div> : report.length === 0 ? <div className="empty-state"><MdAnalytics className="empty-state-icon" /><div className="empty-state-title">No performance data</div><div className="empty-state-text">Published results will appear here.</div></div> : <div className="table-wrapper"><table className="data-table"><thead><tr><th>Course</th><th>Students</th><th>Average Score</th><th>Passes</th><th>Failures</th></tr></thead><tbody>{report.map((item) => <tr key={item.course_id}><td><code>{item.course_code}</code><br /><strong>{item.course_name}</strong></td><td>{item.students}</td><td><strong>{Number(item.average_score || 0).toFixed(1)}</strong></td><td><span className="badge badge-green">{item.passes}</span></td><td><span className="badge badge-red">{item.failures}</span></td></tr>)}</tbody></table></div>}</div>
      {chartData.length > 0 && <div className="card"><div className="card-header"><h2>Average Score by Course</h2></div><div style={{ height: 320 }}><ResponsiveContainer width="100%" height="100%"><BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" /><YAxis domain={[0, 100]} /><Tooltip formatter={(value) => [`${value}`, 'Average score']} /><Bar dataKey="average" fill="#6366F1" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div></div>}
    </AppLayout>
  );
}
