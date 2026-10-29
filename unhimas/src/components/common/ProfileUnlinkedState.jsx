import { MdWarning, MdRefresh, MdSupportAgent } from 'react-icons/md';
import { useTranslation } from '../../i18n';

/**
 * Shown when the signed-in user has no linked student/lecturer row (PGRST116)
 * or when the profile query fails for another reason.
 */
export default function ProfileUnlinkedState({
  role = 'student', // 'student' | 'lecturer'
  errorCode,
  onRetry,
}) {
  const { translateText } = useTranslation();
  const isUnlinked = errorCode === 'PGRST116';

  const title = isUnlinked
    ? translateText('Profile Not Linked')
    : translateText('Profile Unavailable');

  const body = isUnlinked
    ? role === 'lecturer'
      ? translateText(
          'Your account is not yet linked to a lecturer profile. Please contact the administrator.',
        )
      : translateText(
          'Your account is not yet linked to a student profile. Please contact the administrator.',
        )
    : role === 'lecturer'
      ? translateText('Your lecturer profile could not be loaded. Check your connection and try again.')
      : translateText('Your student profile could not be loaded. Check your connection and try again.');

  return (
    <div className="empty-state" role="alert" style={{ maxWidth: 480, margin: '2rem auto' }}>
      <div className="empty-state-icon">
        <MdWarning />
      </div>
      <div className="empty-state-title">{title}</div>
      <p className="empty-state-text">{body}</p>

      {isUnlinked && (
        <div
          style={{
            marginTop: '0.75rem',
            padding: '0.85rem 1rem',
            background: 'var(--color-bg)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md, 12px)',
            textAlign: 'left',
            fontSize: '0.8125rem',
            color: 'var(--color-text-muted)',
            lineHeight: 1.5,
            width: '100%',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, color: 'var(--color-text)', marginBottom: 6 }}>
            <MdSupportAgent size={18} />
            {translateText('How to fix this')}
          </div>
          <ol style={{ margin: 0, paddingLeft: '1.15rem' }}>
            <li>{translateText('Contact a school administrator (not IT support only).')}</li>
            <li>
              {role === 'lecturer'
                ? translateText('Ask them to open Lecturers and link your login to a staff record.')
                : translateText('Ask them to open Students and link your login to a matricule record.')}
            </li>
            <li>{translateText('After linking, sign out and sign in again.')}</li>
          </ol>
        </div>
      )}

      {!isUnlinked && onRetry && (
        <button type="button" className="btn btn-outline btn-sm" style={{ marginTop: '0.75rem' }} onClick={onRetry}>
          <MdRefresh /> {translateText('Try again')}
        </button>
      )}
    </div>
  );
}
