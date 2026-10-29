import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MdSettings, MdSave, MdGrade, MdCheckCircle } from 'react-icons/md';
import AppLayout from '../../components/layout/AppLayout';
import { toast } from '../../components/common/Toast';
import {
  getSystemSettings,
  updateSystemSettings,
  getGradingScale,
} from '../../services/operationsService';

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
      // Synchronize the editable form only after the server-backed settings load.
      // eslint-disable-next-line react-hooks/set-state-in-effect
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

  const defaultScale = gradingScale.length > 0 ? gradingScale : [
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
          <h1 className="page-title">System Settings & Academic Policy</h1>
          <p className="page-subtitle">Configure mark weighting, exam eligibility thresholds, and grading scale</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1fr)', gap: '1.5rem' }}>
        {/* Settings Form */}
        <div className="card">
          <div className="card-header">
            <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <MdSettings /> Institutional & Assessment Configuration
            </div>
          </div>
          <div className="card-body">
            {settingsLoading ? (
              <div>Loading system settings...</div>
            ) : (
              <form onSubmit={handleSubmit}>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">University Name</label>
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
                  <div className="form-hint">Used for lecturer clock-in shift timestamps and class attendance</div>
                </div>

                <div style={{ margin: '1.5rem 0 1rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--color-border)', fontWeight: 700, fontSize: '0.9rem' }}>
                  Bilingual Cameroon Assessment Breakdown (Max 100%)
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Attendance Score (%)</label>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      max="20"
                      className="form-input"
                      value={formData.attendance_max}
                      onChange={(e) => setFormData({ ...formData, school_name: e.target.value })}
                      required
                    />
                    <div className="form-hint">Default: 5%</div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Coursework CA (%)</label>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      max="50"
                      className="form-input"
                      value={formData.coursework_max}
                      onChange={(e) => setFormData({ ...formData, coursework_max: Number(e.target.value) })}
                      required
                    />
                    <div className="form-hint">Default: 25%</div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Final Exam (%)</label>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      max="100"
                      className="form-input"
                      value={formData.exam_max}
                      onChange={(e) => setFormData({ ...formData, exam_max: Number(e.target.value) })}
                      required
                    />
                    <div className="form-hint">Default: 70%</div>
                  </div>
                </div>

                <div className="form-group" style={{ marginTop: '0.5rem' }}>
                  <label className="form-label">Exam Eligibility Attendance Threshold (%)</label>
                  <input
                    type="number"
                    step="1"
                    min="50"
                    max="100"
                    className="form-input"
                    value={formData.attendance_threshold}
                    onChange={(e) => setFormData({ ...formData, attendance_threshold: Number(e.target.value) })}
                    required
                  />
                  <div className="form-hint">
                    Students with overall attendance below this threshold ({formData.attendance_threshold}%) receive alerts before exams.
                  </div>
                </div>

                <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={updateMutation.isPending}
                  >
                    <MdSave /> Save System Settings
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* Grading Scale Card */}
        <div className="card">
          <div className="card-header">
            <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <MdGrade /> Official GPA Grading Scale (4.00 Basis)
            </div>
          </div>
          <div className="card-body" style={{ padding: '0.5rem 0' }}>
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Score Range</th>
                    <th>Letter Grade</th>
                    <th>Grade Point</th>
                    <th>Classification</th>
                  </tr>
                </thead>
                <tbody>
                  {defaultScale.map((scale, idx) => (
                    <tr key={idx}>
                      <td>
                        <strong>{scale.min_score}% – {scale.max_score}%</strong>
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
                          style={{ fontSize: '0.85rem' }}
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
            <div style={{ padding: '1rem', fontSize: '0.78rem', color: 'var(--color-text-muted)', borderTop: '1px solid var(--color-border)' }}>
              <MdCheckCircle style={{ color: '#10B981', verticalAlign: 'middle', marginRight: '4px' }} />
              Grade points and letter grades are applied automatically by database stored procedures upon mark entry.
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
