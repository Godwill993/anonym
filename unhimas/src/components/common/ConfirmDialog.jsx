import { useEffect } from 'react';
import { MdWarning, MdClose, MdCheckCircle, MdInfo, MdPublish } from 'react-icons/md';
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
  variant = 'default',
  icon = null,
  maxWidth = '460px',
  children = null,
  confirmBtnClass = null,
}) {
  const { translateText } = useTranslation();

  const effectiveVariant = isDestructive ? 'danger' : variant;

  const getVariantStyles = () => {
    switch (effectiveVariant) {
      case 'danger':
        return {
          iconBg: 'rgba(183, 0, 50, 0.12)',
          iconColor: 'var(--color-secondary, #b70032)',
          defaultIcon: <MdWarning />,
          btnClass: 'btn-secondary',
        };
      case 'success':
        return {
          iconBg: 'rgba(16, 185, 129, 0.12)',
          iconColor: '#059669',
          defaultIcon: <MdCheckCircle />,
          btnClass: 'btn-primary',
          btnStyle: { background: '#059669', borderColor: '#059669', color: '#fff' },
        };
      case 'purple':
        return {
          iconBg: 'rgba(124, 58, 237, 0.12)',
          iconColor: '#7c3aed',
          defaultIcon: <MdPublish />,
          btnClass: 'btn-primary',
          btnStyle: { background: '#7c3aed', borderColor: '#7c3aed', color: '#fff' },
        };
      case 'warning':
        return {
          iconBg: 'rgba(245, 158, 11, 0.15)',
          iconColor: '#d97706',
          defaultIcon: <MdWarning />,
          btnClass: 'btn-primary',
          btnStyle: { background: '#d97706', borderColor: '#d97706', color: '#fff' },
        };
      default:
        return {
          iconBg: 'rgba(17, 47, 66, 0.08)',
          iconColor: 'var(--color-primary, #112f42)',
          defaultIcon: <MdInfo />,
          btnClass: 'btn-primary',
        };
    }
  };

  const vStyles = getVariantStyles();

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen && !isLoading) {
        onClose();
      }
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, isLoading, onClose]);

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
        style={{ maxWidth }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '50%',
                background: vStyles.iconBg,
                color: vStyles.iconColor,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.2rem',
                flexShrink: 0,
              }}
            >
              {icon || vStyles.defaultIcon}
            </div>
            <h2 id="confirm-dialog-title" className="modal-title" style={{ fontSize: '1.05rem', margin: 0 }}>
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

        <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
          {message && (
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', lineHeight: 1.6, margin: 0 }}>
              {translateText(message)}
            </p>
          )}

          {children}

          {effectiveVariant === 'danger' && !children && (
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
            className={`btn btn-sm ${confirmBtnClass || vStyles.btnClass}`}
            style={vStyles.btnStyle}
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

