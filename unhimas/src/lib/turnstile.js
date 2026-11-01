/**
 * Cloudflare Turnstile helpers for UNHIMAS public forms.
 *
 * When VITE_TURNSTILE_SITE_KEY is unset, Turnstile is disabled and forms
 * behave exactly as before (honeypot + timing remain the primary bot controls).
 *
 * When enabled, ApplyPage also calls the `verify-turnstile` Edge Function
 * (TURNSTILE_SECRET_KEY) for server-side verification.
 */

import { supabase } from './supabase';

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

/**
 * Server-side verification via Supabase Edge Function `verify-turnstile`.
 * No-ops (success) when Turnstile is disabled in the frontend env.
 *
 * @param {string} token
 * @returns {Promise<{ ok: true } | { ok: false, message: string }>}
 */
export async function verifyTurnstileWithServer(token) {
  if (!isTurnstileEnabled()) {
    return { ok: true };
  }

  const local = requireTurnstileToken(token);
  if (!local.ok) return local;

  try {
    const { data, error } = await supabase.functions.invoke('verify-turnstile', {
      body: { token: token.trim() },
    });

    if (error) {
      return {
        ok: false,
        message:
          'Security verification is temporarily unavailable. Please try again shortly.',
      };
    }

    if (data?.success === true) {
      return { ok: true };
    }

    return {
      ok: false,
      message: 'Security check failed. Please try the challenge again.',
    };
  } catch {
    return {
      ok: false,
      message:
        'Security verification is temporarily unavailable. Please try again shortly.',
    };
  }
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
