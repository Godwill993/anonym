/**
 * Pure helpers for public forms (apply, status lookup, result verification).
 * No I/O — safe to unit test and reuse across pages/services.
 */

/** Minimum milliseconds a human is expected to spend before submit. */
export const MIN_FORM_MS = 2500;

/** Client-side cooldown between successful public submissions (ms). */
export const SUBMIT_COOLDOWN_MS = 30_000;

/** Default minimum gap between public lookup attempts (ms). */
export const PUBLIC_LOOKUP_COOLDOWN_MS = 8_000;

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
 * Sliding-window throttle for public lookups.
 * Storage is injected so the helper stays pure/testable.
 *
 * @param {{ getItem: (k: string) => string|null, setItem: (k: string, v: string) => void }} store
 * @param {string} key - e.g. 'unhimas:public-lookup:results'
 * @param {number} [now]
 * @param {number} [cooldownMs]
 * @returns {{ allowed: true } | { allowed: false, retryAfterMs: number }}
 */
export function checkPublicLookupThrottle(
  store,
  key,
  now = Date.now(),
  cooldownMs = PUBLIC_LOOKUP_COOLDOWN_MS,
) {
  if (!store || typeof store.getItem !== 'function') {
    return { allowed: true };
  }
  let last = 0;
  try {
    last = Number(store.getItem(key) || 0);
  } catch {
    last = 0;
  }
  if (Number.isFinite(last) && last > 0 && now - last < cooldownMs) {
    return { allowed: false, retryAfterMs: cooldownMs - (now - last) };
  }
  return { allowed: true };
}

/**
 * Record that a public lookup was attempted (call after validation passes).
 */
export function recordPublicLookupAttempt(
  store,
  key,
  now = Date.now(),
) {
  if (!store || typeof store.setItem !== 'function') return;
  try {
    store.setItem(key, String(now));
  } catch {
    // private mode / quota
  }
}

export function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const e = email.trim();
  if (e.length < 5 || e.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

export function normalizeApplicationNumber(value) {
  return String(value || '').trim().toUpperCase();
}

export function isPlausibleApplicationNumber(value) {
  const n = normalizeApplicationNumber(value);
  return n.length >= 5 && n.length <= 40;
}

export function validateApplicationLookup(applicationNumber, email) {
  const number = normalizeApplicationNumber(applicationNumber);
  const em = String(email || '').trim().toLowerCase();
  if (!number || number.length < 5) {
    return { ok: false, message: 'Application number is required' };
  }
  if (!isValidEmail(em)) {
    return { ok: false, message: 'A valid email address is required' };
  }
  return { ok: true, number, email: em };
}

export function normalizeMatricule(value) {
  return String(value || '').trim().toUpperCase();
}

export function isPlausibleMatricule(value) {
  const m = normalizeMatricule(value);
  if (m.length < 5 || m.length > 40) return false;
  return /[A-Z0-9]/.test(m);
}

/**
 * Validate public results verification lookup.
 * @returns {{ ok: true, matricule: string } | { ok: false, message: string }}
 */
export function validateResultsLookup(matricule) {
  const normalized = normalizeMatricule(matricule);
  if (!normalized) {
    return { ok: false, message: 'Enter a student matricule.' };
  }
  if (!isPlausibleMatricule(normalized)) {
    return {
      ok: false,
      message: 'Enter a valid student matricule (e.g. UNH202612345 or UNH/2026/SWE/001)',
    };
  }
  return { ok: true, matricule: normalized };
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
    programme_id,
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
    programme_id: programme_id || null,
    preferred_level: preferred_level || null,
    academic_year_id: academic_year_id || null,
    previous_school: String(previous_school || '').trim() || null,
    previous_qualification: String(previous_qualification || '').trim() || null,
  };
}
