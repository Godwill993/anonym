import { useQuery } from '@tanstack/react-query';
import { MdAccountCircle, MdBook, MdEmail, MdPersonPin, MdPhone, MdSchool } from 'react-icons/md';
import AppLayout from '../../components/layout/AppLayout';
import { useAuth } from '../../context/AuthContext';
import { getMyStudentProfile } from '../../services/studentService';

function ProfileField({ icon, label, value }) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
      <div style={{ color: 'var(--color-primary)', marginTop: 2 }}>{icon}</div>
      <div>
        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          {label}
        </div>
        <div style={{ marginTop: 2, fontSize: '0.95rem' }}>{value || '—'}</div>
      </div>
    </div>
  );
}

export default function StudentProfilePage() {
  const { profile } = useAuth();
  const { data: studentProfile, isLoading } = useQuery({
    queryKey: ['my-student-profile'],
    queryFn: getMyStudentProfile,
  });

  return (
    <AppLayout>
      <div className="page-header">
        <div>
          <h1 className="page-title">My profile</h1>
          <p className="page-subtitle">Personal and academic details</p>
        </div>
      </div>

      {isLoading ? (
        <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>Loading…</div>
      ) : (
        <section className="card">
          <div style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: '1.25rem' }}>
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: '50%',
                  background: 'var(--color-primary)',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: '1.25rem',
                }}
              >
                {(studentProfile?.first_name || profile?.full_name || 'S')[0]}
              </div>
              <div>
                <div style={{ fontSize: '1.15rem', fontWeight: 800 }}>
                  {studentProfile
                    ? `${studentProfile.first_name || ''} ${studentProfile.middle_name || ''} ${studentProfile.last_name || ''}`.replace(/\s+/g, ' ').trim()
                    : profile?.full_name || 'Student'}
                </div>
                <div style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
                  <code>{studentProfile?.matricule || profile?.login_id || '—'}</code>
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1.25rem' }}>
              <ProfileField icon={<MdSchool />} label="Department" value={studentProfile?.batches?.departments?.name} />
              <ProfileField icon={<MdBook />} label="Batch" value={studentProfile?.batches?.name} />
              <ProfileField
                icon={<MdBook />}
                label="Programme"
                value={(() => {
                  const prog = studentProfile?.programmes || studentProfile?.batches?.programmes;
                  if (!prog) return null;
                  const y = studentProfile?.batches?.year_of_study;
                  return `${prog.code} — ${prog.name}${y != null ? ` (Year ${y}${prog.duration_years != null ? ` of ${prog.duration_years}` : ''})` : ''}`;
                })()}
              />
              <ProfileField icon={<MdPersonPin />} label="School year" value={studentProfile?.batches?.academic_years?.name} />
              <ProfileField
                icon={<MdPersonPin />}
                label="Programme status"
                value={(() => {
                  const s = studentProfile?.programme_status || 'active';
                  if (s === 'completed') {
                    return studentProfile?.programme_completion_result === 'fail_or_exit'
                      ? 'Completed — fail / exit'
                      : 'Completed — pass';
                  }
                  if (s === 'withdrawn') return 'Withdrawn';
                  return 'In programme';
                })()}
              />
              <ProfileField icon={<MdEmail />} label="Email" value={studentProfile?.email || 'Not provided'} />
              <ProfileField icon={<MdPhone />} label="Phone" value={studentProfile?.phone || 'Not provided'} />
              <ProfileField icon={<MdAccountCircle />} label="Login ID" value={profile?.login_id || 'Not available'} />
            </div>

            <div style={{ marginTop: '1.5rem', paddingTop: '1.25rem', borderTop: '1px solid var(--color-border)' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Account Status</div>
              <div style={{ marginTop: 8 }}>
                {studentProfile?.is_active !== false ? <span className="badge badge-green">Active</span> : <span className="badge badge-red">Inactive</span>}
              </div>
            </div>
          </div>
        </section>
      )}
    </AppLayout>
  );
}
