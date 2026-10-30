import { useEffect, useRef, useId } from 'react';
import { createPortal } from 'react-dom';
import { MdClose } from 'react-icons/md';
import { useTranslation } from '../../i18n';

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Accessible modal dialog.
 * - isOpen defaults to true so `{open && <Modal onClose />}` still works.
 * - Focus moves into the dialog on open and is restored on close.
 * - Tab is trapped inside the dialog.
 */
export default function Modal({
  isOpen = true,
  onClose,
  title,
  children,
  footer,
  maxWidth = '540px',
}) {
  const { translateText } = useTranslation();
  const panelRef = useRef(null);
  const previouslyFocused = useRef(null);
  const titleId = useId();

  useEffect(() => {
    if (!isOpen) return undefined;

    previouslyFocused.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    document.body.style.overflow = 'hidden';

    // Focus first focusable control, prefer close button last resort panel
    const focusFirst = () => {
      const panel = panelRef.current;
      if (!panel) return;
      const nodes = panel.querySelectorAll(FOCUSABLE);
      const target = nodes[0] || panel;
      if (target instanceof HTMLElement) {
        target.focus();
      }
    };
    // After paint
    const t = window.setTimeout(focusFirst, 0);

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose?.();
        return;
      }
      if (e.key !== 'Tab' || !panelRef.current) return;

      const nodes = Array.from(panelRef.current.querySelectorAll(FOCUSABLE)).filter(
        (el) => el instanceof HTMLElement && !el.hasAttribute('disabled') && el.offsetParent !== null,
      );
      if (nodes.length === 0) {
        e.preventDefault();
        panelRef.current.focus();
        return;
      }
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = document.activeElement;

      if (e.shiftKey) {
        if (active === first || !panelRef.current.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else if (active === last || !panelRef.current.contains(active)) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);

    return () => {
      window.clearTimeout(t);
      document.body.style.overflow = '';
      document.removeEventListener('keydown', handleKeyDown, true);
      const prev = previouslyFocused.current;
      if (prev && typeof prev.focus === 'function') {
        prev.focus();
      }
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const node = (
    <div
      className="modal-backdrop"
      onClick={() => onClose?.()}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose?.();
      }}
    >
      <div
        ref={panelRef}
        className="modal"
        style={{ maxWidth }}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2 id={titleId} className="modal-title">
            {typeof title === 'string' ? translateText(title) : title}
          </h2>
          <button
            type="button"
            className="modal-close"
            onClick={() => onClose?.()}
            aria-label={translateText('Close dialog')}
          >
            <MdClose aria-hidden="true" />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );

  return createPortal(node, document.body);
}
