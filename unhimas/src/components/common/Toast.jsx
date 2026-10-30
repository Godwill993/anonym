import { useState, useEffect } from 'react';
import { MdCheckCircle, MdError, MdInfo, MdWarning } from 'react-icons/md';
import { useTranslation } from '../../i18n';

let showToastFn = null;

export function toast(message, type = 'success', duration = 3500) {
  if (showToastFn) {
    showToastFn({ id: Date.now(), message, type, duration });
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
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== newToast.id));
      }, newToast.duration);
    };
    return () => {
      showToastFn = null;
    };
  }, []);

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
            <Icon style={{ fontSize: '1.25rem', flexShrink: 0 }} aria-hidden="true" />
            <span>{translateText(t.message)}</span>
          </div>
        );
      })}
    </div>
  );
}
