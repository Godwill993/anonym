/**
 * Cloudflare Turnstile helpers for UNHIMAS public forms.
 *
 * When VITE_TURNSTILE_SITE_KEY is unset, Turnstile is disabled and forms
 * behave exactly as before (honeypot + timing remain the primary bot controls).
 *
 * Client-side presence of a token is a UX gate only. For production-grade
 * verification, validate the token server-side with TURNSTILE_SECRET_KEY
 * (Edge Function) — see docs/PUBLIC_ENDPOINTS.md.
 */

export function getTurnstileSiteKey() {
  try {
    const key = import.meta.env?.VITE_TURNSTILE_SITE_KEY;
    return typeof key === 'string' && key.trim() ? key.trim() : '';
  } catch {
    return '';
  }
}

export function isTurnstileEnabled() {
  return Boolean(getTurnstileSiteKey());
}

/**
 * @param {string|null|undefined} token
 * @returns {{ ok: true } | { ok: false, message: string }}
 */
export function requireTurnstileToken(token) {
  if (!isTurnstileEnabled()) {
    return { ok: true };
  }
  if (typeof token === 'string' && token.trim().length > 10) {
    return { ok: true };
  }
  return {
    ok: false,
    message: 'Please complete the security check before submitting.',
  };
}

const SCRIPT_ID = 'cf-turnstile-script';
const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

/**
 * Load the Turnstile script once. Resolves when `window.turnstile` is available.
 * @returns {Promise<void>}
 */
export function loadTurnstileScript() {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Turnstile requires a browser environment'));
  }
  if (window.turnstile) {
    return Promise.resolve();
  }

  const existing = document.getElementById(SCRIPT_ID);
  if (existing) {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      const poll = () => {
        if (window.turnstile) return resolve();
        if (Date.now() - start > 15000) {
          return reject(new Error('Turnstile script load timed out'));
        }
        setTimeout(poll, 50);
      };
      poll();
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Turnstile script'));
    document.head.appendChild(script);
  });
}
