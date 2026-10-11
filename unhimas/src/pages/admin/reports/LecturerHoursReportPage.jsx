import { useQuery } from '@tanstack/react-query';
import { MdAccessTime, MdWarning, MdFileDownload } from 'react-icons/md';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import AppLayout from '../../../components/layout/AppLayout';
import { getLecturerHoursReport } from '../../../services/adminReportsService';
import { exportToCsv } from '../../../utils/exportUtils';

function formatMonth(value) {
  return new Date(value).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
}

export default function LecturerHoursReportPage() {
  const { data: report = [], isLoading, error } = useQuery({
    queryKey: ['admin-lecturer-hours-report'],
    queryFn: getLecturerHoursReport,
  });

  const chartData = report.slice(0, 12).map((item) => ({
    name: formatMonth(item.month),
    hours: Number(item.hours_taught || 0),
  }));

  const totalHours = report.reduce((sum, item) => sum + Number(item.hours_taught || 0), 0);
  const activeLecturers = new Set(report.map((item) => item.lecturer_id)).size;

  const handleExport = () => {
    const headers = [
      { label: 'Staff ID', key: 'staff_id' },
      { label: 'First Name', key: 'first_name' },
      { label: 'Last Name', key: 'last_name' },
      { label: 'Month', key: 'formatted_month' },
      { label: 'Hours Taught', key: 'hours_taught' },
    ];
    const rows = report.map((r) => ({
      staff_id: r.staff_id,
      first_name: r.first_name,
      last_name: r.last_name,
      formatted_month: formatMonth(r.month),
      hours_taught: Number(r.hours_taught).toFixed(2),
    }));
    exportToCsv('unhimas_lecturer_hours_report', headers, rows);
  };

  return (
    <AppLayout pageTitle="Lecturer Hours Report">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Lecturer Hours Report</h1>
          <p className="page-subtitle">Approved teaching hours recorded through lecturer shifts</p>
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

      <div className="stats-grid">
        <div className="stat-card"><div className="stat-card-icon blue"><MdAccessTime /></div><div className="stat-card-body"><div className="stat-card-value">{totalHours.toFixed(1)}</div><div className="stat-card-label">Total Hours</div></div></div>
        <div className="stat-card"><div className="stat-card-icon red"><MdAccessTime /></div><div className="stat-card-body"><div className="stat-card-value">{activeLecturers}</div><div className="stat-card-label">Active Lecturers</div></div></div>
      </div>

      <div className="card">
        <div className="card-header"><h2>Hours by Lecturer</h2></div>
        {isLoading ? <div className="empty-state">Loading report...</div> : error ? (
          <div className="empty-state"><MdWarning className="empty-state-icon" /><div className="empty-state-title">Report unavailable</div><div className="empty-state-text">The lecturer hours report could not be loaded.</div></div>
        ) : report.length === 0 ? (
          <div className="empty-state"><MdAccessTime className="empty-state-icon" /><div className="empty-state-title">No hours recorded</div><div className="empty-state-text">Lecturer shift hours will appear here once they are recorded.</div></div>
        ) : (
          <div className="table-wrapper"><table className="data-table"><thead><tr><th>Lecturer</th><th>Month</th><th>Hours Taught</th></tr></thead><tbody>{report.map((item) => <tr key={`${item.lecturer_id}-${item.month}`}><td><strong>{item.first_name} {item.last_name}</strong><br /><code>{item.staff_id}</code></td><td>{formatMonth(item.month)}</td><td><strong>{Number(item.hours_taught).toFixed(2)}</strong></td></tr>)}</tbody></table></div>
        )}
      </div>

      {chartData.length > 0 && <div className="card"><div className="card-header"><h2>Recent Teaching Hours</h2></div><div style={{ height: 320 }}><ResponsiveContainer width="100%" height="100%"><BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" /><YAxis unit="h" /><Tooltip /><Bar dataKey="hours" fill="#B70032" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div></div>}
    </AppLayout>
  );
}
