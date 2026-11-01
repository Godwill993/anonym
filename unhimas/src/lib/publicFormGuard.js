/**
 * Pure helpers for public forms (apply, status lookup, result verification).
 * No I/O — safe to unit test and reuse across pages/services.
 */

/** Minimum milliseconds a human is expected to spend before submit. */
export const MIN_FORM_MS = 2500;

/** Client-side cooldown between successful public submissions (ms). */
export const SUBMIT_COOLDOWN_MS = 30_000;

/**
 * Honeypot fields must remain empty. Any non-empty value ⇒ treat as bot.
 * @param {Record<string, unknown>} payload
 * @param {string[]} [fields]
 */
export function isHoneypotTriggered(payload, fields = ['website']) {
  if (!payload || typeof payload !== 'object') return false;
  return fields.some((key) => {
    const v = payload[key];
    return typeof v === 'string' ? v.trim().length > 0 : Boolean(v);
  });
}

/**
 * Reject instant scripted submits when the form was opened too recently.
 * @param {number} openedAt - Date.now() when the form mounted
 * @param {number} [now]
 * @param {number} [minMs]
 */
export function isSubmitTooFast(openedAt, now = Date.now(), minMs = MIN_FORM_MS) {
  if (!Number.isFinite(openedAt) || openedAt <= 0) return false;
  return now - openedAt < minMs;
}

/**
 * Lightweight email shape check (not full RFC).
 * @param {string} email
 */
export function isValidEmail(email) {
  if (typeof email !== 'string') return false;
  const s = email.trim();
  if (s.length < 5 || s.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

/**
 * Normalize an application number for lookup (trim + uppercase).
 * @param {string} value
 */
export function normalizeApplicationNumber(value) {
  return String(value || '').trim().toUpperCase();
}

/**
 * Plausible application number shape used by UNHIMAS generators.
 * Accepts APP-YYYY-##### and short fallbacks like APP-#####.
 * @param {string} value
 */
export function isPlausibleApplicationNumber(value) {
  const n = normalizeApplicationNumber(value);
  if (n.length < 6 || n.length > 40) return false;
  // APP-2026-01000 or APP-01000 or APP-2026-1
  return /^APP-[A-Z0-9-]{3,}$/.test(n);
}

/**
 * Validate public application status lookup inputs.
 * @returns {{ ok: true, number: string, email: string } | { ok: false, message: string }}
 */
export function validateApplicationLookup(applicationNumber, email) {
  const number = normalizeApplicationNumber(applicationNumber);
  const normalizedEmail = String(email || '').trim().toLowerCase();

  if (!number) {
    return { ok: false, message: 'Application number is required' };
  }
  if (!isPlausibleApplicationNumber(number)) {
    return { ok: false, message: 'Enter a valid application number (e.g. APP-2026-01000)' };
  }
  if (!isValidEmail(normalizedEmail)) {
    return { ok: false, message: 'A valid email address is required' };
  }
  return { ok: true, number, email: normalizedEmail };
}

/**
 * Validate required admission application fields (client + service).
 * @returns {{ ok: true } | { ok: false, message: string }}
 */
export function validateAdmissionPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return { ok: false, message: 'Invalid application payload' };
  }
  const first = String(payload.first_name || '').trim();
  const last = String(payload.last_name || '').trim();
  const email = String(payload.email || '').trim();

  if (first.length < 1 || first.length > 100) {
    return { ok: false, message: 'First name is required' };
  }
  if (last.length < 1 || last.length > 100) {
    return { ok: false, message: 'Last name is required' };
  }
  if (!isValidEmail(email)) {
    return { ok: false, message: 'A valid email address is required' };
  }
  return { ok: true };
}

/**
 * Strip honeypot and unknown control fields before DB insert.
 */
export function sanitizeAdmissionPayload(payload) {
  const {
    website: _website,
    first_name,
    middle_name,
    last_name,
    email,
    phone,
    date_of_birth,
    gender,
    nationality,
    department_id,
    preferred_level,
    academic_year_id,
    previous_school,
    previous_qualification,
  } = payload || {};

  return {
    first_name: String(first_name || '').trim(),
    middle_name: String(middle_name || '').trim() || null,
    last_name: String(last_name || '').trim(),
    email: String(email || '').trim().toLowerCase(),
    phone: String(phone || '').trim() || null,
    date_of_birth: date_of_birth || null,
    gender: gender || null,
    nationality: nationality || 'Cameroonian',
    department_id: department_id || null,
    preferred_level: preferred_level || null,
    academic_year_id: academic_year_id || null,
    previous_school: String(previous_school || '').trim() || null,
    previous_qualification: String(previous_qualification || '').trim() || null,
  };
}
