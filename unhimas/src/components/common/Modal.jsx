import { useEffect } from 'react';
import { MdClose } from 'react-icons/md';
import { useTranslation } from '../../i18n';

export default function Modal({ isOpen, onClose, title, children, footer, maxWidth = '540px' }) {
  const { translateText } = useTranslation();
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
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
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div
        className="modal"
        style={{ maxWidth }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2 id="modal-title" className="modal-title">{translateText(title)}</h2>
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            aria-label={translateText('Close dialog')}
          >
            <MdClose />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}
