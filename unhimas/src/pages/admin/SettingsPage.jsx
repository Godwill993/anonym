import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  MdSettings,
  MdSave,
  MdGrade,
  MdCheckCircle,
  MdGroups,
  MdDateRange,
  MdSchedule,
  MdSwapHoriz,
  MdEvent,
  MdAdminPanelSettings,
  MdHistory,
  MdBarChart,
  MdLogin,
  MdCampaign,
  MdFolder,
  MdPersonAdd,
  MdBook,
} from 'react-icons/md';
import AppLayout from '../../components/layout/AppLayout';
import { toast } from '../../components/common/Toast';
import {
  getSystemSettings,
  updateSystemSettings,
  getGradingScale,
} from '../../services/operationsService';

/** Secondary screens — not in the sidebar; keep this list tight and non-duplicative. */
const MORE_LINKS = [
  { to: '/admin/batches', label: 'Batches', icon: MdGroups },
  { to: '/admin/batch-courses', label: 'Batch courses', icon: MdBook },
  { to: '/admin/academic-years', label: 'Years', icon: MdDateRange },
  { to: '/admin/semesters', label: 'Semesters', icon: MdSchedule },
  { to: '/admin/class-sessions', label: 'Sessions', icon: MdSchedule },
  { to: '/admin/academic-events', label: 'Events', icon: MdEvent },
  { to: '/admin/student-transfers', label: 'Transfers', icon: MdSwapHoriz },
  { to: '/admin/create-account', label: 'Create account', icon: MdPersonAdd },
  { to: '/admin/staff', label: 'Admins', icon: MdAdminPanelSettings },
  { to: '/admin/results', label: 'Published results', icon: MdBarChart },
  { to: '/admin/attendance', label: 'Attendance desk', icon: MdLogin },
  { to: '/admin/announcements', label: 'News', icon: MdCampaign },
  { to: '/admin/resources', label: 'Files', icon: MdFolder },
  { to: '/admin/audit-log', label: 'Audit log', icon: MdHistory },
];

export default function SettingsPage() {
  const queryClient = useQueryClient();

  const { data: settings, isLoading: settingsLoading } = useQuery({
    queryKey: ['system-settings'],
    queryFn: getSystemSettings,
  });

  const { data: gradingScale = [] } = useQuery({
    queryKey: ['grading-scale'],
    queryFn: getGradingScale,
  });

  const [formData, setFormData] = useState({
    school_name: 'UNHIMAS',
    school_abbreviation: 'UNH',
    attendance_max: 5,
    coursework_max: 25,
    exam_max: 70,
    attendance_threshold: 75,
    timezone: 'Africa/Douala',
  });

  useEffect(() => {
    if (settings) {
      setFormData({
        school_name: settings.school_name || 'UNHIMAS',
        school_abbreviation: settings.school_abbreviation || 'UNH',
        attendance_max: Number(settings.attendance_max) || 5,
        coursework_max: Number(settings.coursework_max) || 25,
        exam_max: Number(settings.exam_max) || 70,
        attendance_threshold: Number(settings.attendance_threshold) || 75,
        timezone: settings.timezone || 'Africa/Douala',
      });
    }
  }, [settings]);

  const updateMutation = useMutation({
    mutationFn: (updates) => updateSystemSettings(settings?.id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-settings'] });
      toast.success('System settings saved successfully');
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to update settings');
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const total =
      Number(formData.attendance_max) +
      Number(formData.coursework_max) +
      Number(formData.exam_max);

    if (total !== 100) {
      toast.warning(`Total mark allocation must equal 100% (currently ${total}%)`);
    }

    updateMutation.mutate(formData);
  };

  const defaultScale =
    gradingScale.length > 0
      ? gradingScale
      : [
          { min_score: 80, max_score: 100, grade: 'A', grade_point: 4.0, remark: 'Excellent' },
          { min_score: 70, max_score: 79.99, grade: 'B', grade_point: 3.0, remark: 'Very Good' },
          { min_score: 60, max_score: 69.99, grade: 'C', grade_point: 2.0, remark: 'Good' },
          { min_score: 50, max_score: 59.99, grade: 'D', grade_point: 1.0, remark: 'Pass' },
          { min_score: 0, max_score: 49.99, grade: 'F', grade_point: 0.0, remark: 'Fail' },
        ];

  return (
    <AppLayout pageTitle="Settings">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Policy, grading, and all secondary tools</p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '1.25rem' }}>
        <div className="card-header">
          <div className="card-title">More tools</div>
        </div>
        <div className="card-body" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {MORE_LINKS.map(({ to, label, icon: Icon }) => (
            <Link key={to} to={to} className="btn btn-outline btn-sm" style={{ textDecoration: 'none' }}>
              <Icon size={16} /> {label}
            </Link>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1fr)', gap: '1.5rem' }}>
        <div className="card">
          <div className="card-header">
            <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <MdSettings /> Configuration
            </div>
          </div>
          <div className="card-body">
            {settingsLoading ? (
              <div>Loading…</div>
            ) : (
              <form onSubmit={handleSubmit}>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">University name</label>
                    <input
                      type="text"
                      className="form-input"
                      value={formData.school_name}
                      onChange={(e) => setFormData({ ...formData, school_name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Abbreviation</label>
                    <input
                      type="text"
                      className="form-input"
                      value={formData.school_abbreviation}
                      onChange={(e) => setFormData({ ...formData, school_abbreviation: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Timezone</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.timezone}
                    onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                    required
                  />
                </div>

                <div
                  style={{
                    margin: '1.25rem 0 0.75rem',
                    fontWeight: 700,
                    fontSize: '0.875rem',
                    borderBottom: '1px solid var(--color-border)',
                    paddingBottom: 6,
                  }}
                >
                  Marks breakdown (must total 100)
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Attendance %</label>
                    <input
                      type="number"
                      className="form-input"
                      min={0}
                      max={20}
                      value={formData.attendance_max}
                      onChange={(e) => setFormData({ ...formData, attendance_max: Number(e.target.value) })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Coursework %</label>
                    <input
                      type="number"
                      className="form-input"
                      min={0}
                      max={50}
                      value={formData.coursework_max}
                      onChange={(e) => setFormData({ ...formData, coursework_max: Number(e.target.value) })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Exam %</label>
                    <input
                      type="number"
                      className="form-input"
                      min={0}
                      max={100}
                      value={formData.exam_max}
                      onChange={(e) => setFormData({ ...formData, exam_max: Number(e.target.value) })}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Exam eligibility attendance %</label>
                  <input
                    type="number"
                    className="form-input"
                    min={50}
                    max={100}
                    value={formData.attendance_threshold}
                    onChange={(e) =>
                      setFormData({ ...formData, attendance_threshold: Number(e.target.value) })
                    }
                    required
                  />
                </div>

                <div style={{ marginTop: '1.25rem', display: 'flex', justifyContent: 'flex-end' }}>
                  <button type="submit" className="btn btn-primary" disabled={updateMutation.isPending}>
                    <MdSave /> Save
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <MdGrade /> GPA scale
            </div>
          </div>
          <div className="card-body" style={{ padding: '0.5rem 0' }}>
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Score</th>
                    <th>Grade</th>
                    <th>Point</th>
                    <th>Remark</th>
                  </tr>
                </thead>
                <tbody>
                  {defaultScale.map((scale, idx) => (
                    <tr key={idx}>
                      <td>
                        <strong>
                          {scale.min_score}% – {scale.max_score}%
                        </strong>
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            scale.grade === 'A' || scale.grade === 'B'
                              ? 'badge-green'
                              : scale.grade === 'C' || scale.grade === 'D'
                                ? 'badge-blue'
                                : 'badge-red'
                          }`}
                        >
                          {scale.grade}
                        </span>
                      </td>
                      <td>
                        <strong>{Number(scale.grade_point).toFixed(2)}</strong>
                      </td>
                      <td style={{ color: 'var(--color-text-muted)' }}>{scale.remark}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div
              style={{
                padding: '1rem',
                fontSize: '0.78rem',
                color: 'var(--color-text-muted)',
                borderTop: '1px solid var(--color-border)',
              }}
            >
              <MdCheckCircle style={{ color: '#10B981', verticalAlign: 'middle', marginRight: 4 }} />
              Applied automatically on mark entry.
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
