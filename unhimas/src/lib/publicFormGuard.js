/**
 * Guards and sanitizers for public (unauthenticated) forms.
 * Used by admissions and other public endpoints.
 */

export function isHoneypotTriggered(payload) {
  const website = payload?.website;
  return Boolean(website && String(website).trim());
}

export function isSubmitTooFast(openedAt, minMs = 2500) {
  if (!openedAt) return false;
  return Date.now() - openedAt < minMs;
}

function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const e = email.trim();
  if (e.length < 5 || e.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

export function validateAdmissionPayload(payload) {
  const first = String(payload?.first_name || '').trim();
  const last = String(payload?.last_name || '').trim();
  const email = String(payload?.email || '').trim();
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

export function validateApplicationLookup(applicationNumber, email) {
  const number = String(applicationNumber || '').trim();
  const em = String(email || '').trim().toLowerCase();
  if (!number || number.length < 5) {
    return { ok: false, message: 'Application number is required' };
  }
  if (!isValidEmail(em)) {
    return { ok: false, message: 'A valid email address is required' };
  }
  return { ok: true, number, email: em };
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
