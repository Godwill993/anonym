/**
 * Lightweight observability surface for UNHIMAS.
 *
 * Design goals:
 * - Zero required dependencies at runtime
 * - Safe no-op when monitoring is not configured
 * - Easy to point at Sentry (or any vendor) later without rewriting call sites
 *
 * Optional integration:
 * 1. Set VITE_SENTRY_DSN in the environment (documented in .env.example)
 * 2. Load @sentry/react in main.jsx when ready
 * 3. Optionally assign window.__UNHIMAS_REPORT_ERROR__ = (err, ctx) => Sentry.captureException(...)
 */

function readFlag(name) {
  try {
    return Boolean(import.meta.env?.[name]);
  } catch {
    return false;
  }
}

/**
 * Report an unexpected error (render boundary, failed critical path, etc.).
 * @param {unknown} error
 * @param {Record<string, unknown>} [context]
 */
export function reportError(error, context = {}) {
  // Always keep a local breadcrumb for support / support screenshots
  if (typeof console !== 'undefined' && console.error) {
    console.error('[UNHIMAS]', error, context);
  }

  try {
    const hook = typeof window !== 'undefined' ? window.__UNHIMAS_REPORT_ERROR__ : null;
    if (typeof hook === 'function') {
      hook(error, context);
      return;
    }
  } catch {
    // never throw from observability
  }

  // Placeholder for future native Sentry init when VITE_SENTRY_DSN is set and SDK is installed.
  // Intentionally does not import @sentry/* here to keep the default bundle free of that dependency.
  void readFlag('VITE_SENTRY_DSN');
}

/**
 * Report a non-fatal operational event.
 * @param {string} message
 * @param {Record<string, unknown>} [context]
 */
export function reportMessage(message, context = {}) {
  if (typeof console !== 'undefined' && console.warn) {
    console.warn('[UNHIMAS]', message, context);
  }
  try {
    const hook = typeof window !== 'undefined' ? window.__UNHIMAS_REPORT_MESSAGE__ : null;
    if (typeof hook === 'function') {
      hook(message, context);
    }
  } catch {
    // ignore
  }
}
