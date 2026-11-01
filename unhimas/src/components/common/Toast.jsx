import { useState, useEffect } from 'react';
import { MdCheckCircle, MdError, MdInfo, MdWarning, MdClose } from 'react-icons/md';
import { useTranslation } from '../../i18n';

let showToastFn = null;
let toastSeq = 0;

export function toast(message, type = 'success', duration = 3500) {
  if (showToastFn) {
    const safeMsg = typeof message === 'string' ? message : message?.message || String(message || '');
    showToastFn({ id: `${Date.now()}_${++toastSeq}`, message: safeMsg, type, duration });
  }
}

toast.success = (msg, dur) => toast(msg, 'success', dur);
toast.error = (msg, dur) => toast(msg, 'error', dur);
toast.info = (msg, dur) => toast(msg, 'info', dur);
toast.warning = (msg, dur) => toast(msg, 'warning', dur);

export default function ToastContainer() {
  const { translateText } = useTranslation();
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    showToastFn = (newToast) => {
      setToasts((prev) => [...prev, newToast]);
      if (newToast.duration > 0) {
        setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== newToast.id));
        }, newToast.duration);
      }
    };
    return () => {
      showToastFn = null;
    };
  }, []);

  const dismissToast = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  if (toasts.length === 0) return null;

  return (
    <div className="toast-container" aria-live="polite" aria-relevant="additions text">
      {toasts.map((t) => {
        let Icon = MdCheckCircle;
        if (t.type === 'error') Icon = MdError;
        if (t.type === 'info') Icon = MdInfo;
        if (t.type === 'warning') Icon = MdWarning;

        return (
          <div
            key={t.id}
            className={`toast ${t.type}`}
            role={t.type === 'error' ? 'alert' : 'status'}
          >
            <Icon className="toast-icon" aria-hidden="true" />
            <div className="toast-message">{translateText(t.message)}</div>
            <button
              type="button"
              className="toast-dismiss-btn"
              onClick={() => dismissToast(t.id)}
              aria-label={translateText('Dismiss notification')}
            >
              <MdClose aria-hidden="true" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
