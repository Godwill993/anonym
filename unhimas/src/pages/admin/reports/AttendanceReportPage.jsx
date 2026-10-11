import { useQuery } from '@tanstack/react-query';
import { MdHowToReg, MdWarning, MdFileDownload } from 'react-icons/md';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import AppLayout from '../../../components/layout/AppLayout';
import { getAttendanceReport } from '../../../services/adminReportsService';
import { exportToCsv } from '../../../utils/exportUtils';

export default function AttendanceReportPage() {
  const { data: report = [], isLoading, error } = useQuery({ queryKey: ['admin-attendance-report'], queryFn: getAttendanceReport });
  const chartData = report.slice(0, 12).map((item) => ({ name: item.course_code, percentage: Number(item.attendance_percentage || 0) }));
  const average = report.length ? report.reduce((sum, item) => sum + Number(item.attendance_percentage || 0), 0) / report.length : 0;

  const handleExport = () => {
    const headers = [
      { label: 'Course Code', key: 'course_code' },
      { label: 'Course Name', key: 'course_name' },
      { label: 'Total Sessions', key: 'total_sessions' },
      { label: 'Attended Sessions', key: 'attended_sessions' },
      { label: 'Attendance %', key: 'attendance_percentage' },
    ];
    exportToCsv('unhimas_course_attendance_report', headers, report);
  };

  return (
    <AppLayout pageTitle="Attendance Report">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Attendance Report</h1>
          <p className="page-subtitle">Student attendance by course based on recorded class sessions</p>
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
      <div className="stats-grid"><div className="stat-card"><div className="stat-card-icon blue"><MdHowToReg /></div><div className="stat-card-body"><div className="stat-card-value">{report.length}</div><div className="stat-card-label">Course Records</div></div></div><div className="stat-card"><div className="stat-card-icon green"><MdHowToReg /></div><div className="stat-card-body"><div className="stat-card-value">{average.toFixed(1)}%</div><div className="stat-card-label">Average Attendance</div></div></div></div>
      <div className="card"><div className="card-header"><h2>Course Attendance</h2></div>{isLoading ? <div className="empty-state">Loading report...</div> : error ? <div className="empty-state"><MdWarning className="empty-state-icon" /><div className="empty-state-title">Report unavailable</div><div className="empty-state-text">The attendance report could not be loaded.</div></div> : report.length === 0 ? <div className="empty-state"><MdHowToReg className="empty-state-icon" /><div className="empty-state-title">No attendance data</div><div className="empty-state-text">Attendance records will appear after class sessions are recorded.</div></div> : <div className="table-wrapper"><table className="data-table"><thead><tr><th>Course</th><th>Student Sessions</th><th>Attended</th><th>Attendance</th></tr></thead><tbody>{report.map((item) => <tr key={item.course_id}><td><code>{item.course_code}</code><br /><strong>{item.course_name}</strong></td><td>{item.total_sessions}</td><td>{Number(item.attended_sessions || 0)}</td><td><strong>{Number(item.attendance_percentage || 0).toFixed(1)}%</strong></td></tr>)}</tbody></table></div>}</div>
      {chartData.length > 0 && <div className="card"><div className="card-header"><h2>Attendance by Course</h2></div><div style={{ height: 320 }}><ResponsiveContainer width="100%" height="100%"><BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" /><YAxis domain={[0, 100]} unit="%" /><Tooltip formatter={(value) => [`${value}%`, 'Attendance']} /><Bar dataKey="percentage" fill="#10B981" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div></div>}
    </AppLayout>
  );
}
