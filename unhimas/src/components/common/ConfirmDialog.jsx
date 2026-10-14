import { MdWarning, MdClose } from 'react-icons/md';
import { useTranslation } from '../../i18n';

export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirm Action',
  message = 'Are you sure you want to proceed with this action?',
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  isDestructive = false,
  isLoading = false,
}) {
  const { translateText } = useTranslation();
  if (!isOpen) return null;

  return (
    <div
      className="modal-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <div
        className="modal"
        style={{ maxWidth: '440px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: isDestructive ? 'rgba(183, 0, 50, 0.12)' : 'rgba(17, 47, 66, 0.08)',
                color: isDestructive ? 'var(--color-secondary)' : 'var(--color-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.1rem',
                flexShrink: 0,
              }}
            >
              <MdWarning />
            </div>
            <h2 id="confirm-dialog-title" className="modal-title" style={{ fontSize: '1.05rem' }}>
              {translateText(title)}
            </h2>
          </div>
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            aria-label={translateText('Close dialog')}
            disabled={isLoading}
          >
            <MdClose />
          </button>
        </div>

        <div className="modal-body">
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', lineHeight: 1.6 }}>
            {translateText(message)}
          </p>
          {isDestructive && (
            <div
              style={{
                marginTop: '0.75rem',
                padding: '0.6rem 0.75rem',
                background: 'rgba(183, 0, 50, 0.05)',
                borderLeft: '3px solid var(--color-secondary)',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.75rem',
                color: 'var(--color-secondary)',
                fontWeight: 600,
              }}
            >
              {translateText('This action may be permanent and cannot be undone.')}
            </div>
          )}
        </div>

        <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={onClose}
            disabled={isLoading}
          >
            {translateText(cancelLabel)}
          </button>
          <button
            type="button"
            className={`btn btn-sm ${isDestructive ? 'btn-secondary' : 'btn-primary'}`}
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading ? translateText('Processing…') : translateText(confirmLabel)}
          </button>
        </div>
      </div>
    </div>
  );
}
