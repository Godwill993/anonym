import { useQuery } from '@tanstack/react-query';
import { MdAccountCircle, MdBook, MdEmail, MdPersonPin, MdPhone, MdSchool } from 'react-icons/md';
import AppLayout from '../../components/layout/AppLayout';
import { useAuth } from '../../context/AuthContext';
import { getMyStudentProfile } from '../../services/studentService';

export default function StudentProfilePage() {
  const { session, profile } = useAuth();
  const { data: studentProfile, isLoading, error } = useQuery({
    queryKey: ['my-student-profile'],
    queryFn: getMyStudentProfile,
    enabled: !!session,
  });

  return (
    <AppLayout pageTitle="Profile">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">My Profile</h1>
          <p className="page-subtitle">Your personal and academic information</p>
        </div>
      </div>

      {isLoading ? (
        <div className="card" style={{ padding: '2rem' }}>
          <div className="skeleton skeleton-title" style={{ width: '45%', marginBottom: 8 }} />
          <div className="skeleton skeleton-text" style={{ width: '65%', height: 20 }} />
        </div>
      ) : error ? (
        <div className="empty-state" role="alert">
          <div className="empty-state-icon"><MdAccountCircle /></div>
          <div className="empty-state-title">Profile unavailable</div>
          <p className="empty-state-text">Your student profile could not be loaded.</p>
        </div>
      ) : (
        <div style={{ maxWidth: 760 }}>
          <section className="card">
            <div style={{ background: 'var(--color-primary)', padding: '1.75rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
              <div style={{ width: 76, height: 76, borderRadius: '50%', background: 'rgba(255,255,255,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem' }}>
                <MdAccountCircle />
              </div>
              <div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800 }}>{studentProfile?.first_name} {studentProfile?.middle_name ? `${studentProfile.middle_name} ` : ''}{studentProfile?.last_name}</div>
                <div style={{ color: 'rgba(255,255,255,0.72)', marginTop: 3 }}>{studentProfile?.matricule}</div>
                <span className="badge" style={{ background: 'rgba(255,255,255,0.18)', color: '#fff', marginTop: 8 }}>Student</span>
              </div>
            </div>

            <div className="card-body">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '1.25rem' }}>
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
                        ? 'Completed (fail / exit)'
                        : 'Completed (pass)';
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
                  {studentProfile?.is_active ? <span className="badge badge-green">Active</span> : <span className="badge badge-red">Inactive</span>}
                </div>
              </div>
            </div>
          </section>
        </div>
      )}
    </AppLayout>
  );
}

function ProfileField({ icon, label, value }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>
        {icon}<span>{label}</span>
      </div>
      <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>{value || '—'}</div>
    </div>
  );
}
