import { useEffect, useRef } from 'react';
import {
  getTurnstileSiteKey,
  isTurnstileEnabled,
  loadTurnstileScript,
} from '../../lib/turnstile';

/**
 * Renders Cloudflare Turnstile when VITE_TURNSTILE_SITE_KEY is configured.
 * Renders nothing when disabled (default).
 *
 * @param {{ onToken: (token: string) => void, onExpire?: () => void, onError?: () => void }} props
 */
export default function TurnstileWidget({ onToken, onExpire, onError }) {
  const containerRef = useRef(null);
  const widgetIdRef = useRef(null);

  useEffect(() => {
    if (!isTurnstileEnabled()) return undefined;

    let cancelled = false;
    const siteKey = getTurnstileSiteKey();

    loadTurnstileScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.turnstile) return;
        if (widgetIdRef.current != null) {
          try {
            window.turnstile.remove(widgetIdRef.current);
          } catch {
            // ignore
          }
        }
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          callback: (token) => {
            if (typeof onToken === 'function') onToken(token);
          },
          'expired-callback': () => {
            if (typeof onExpire === 'function') onExpire();
          },
          'error-callback': () => {
            if (typeof onError === 'function') onError();
          },
        });
      })
      .catch(() => {
        if (typeof onError === 'function') onError();
      });

    return () => {
      cancelled = true;
      if (widgetIdRef.current != null && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          // ignore
        }
        widgetIdRef.current = null;
      }
    };
  }, [onToken, onExpire, onError]);

  if (!isTurnstileEnabled()) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      className="turnstile-widget"
      style={{ marginTop: 8, marginBottom: 4, minHeight: 65 }}
    />
  );
}
