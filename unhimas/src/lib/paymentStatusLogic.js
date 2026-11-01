/**
 * Pure payment status transition + initiation rules for UNHIMAS.
 * Mirrors Edge Function `payment-webhook` guards and client initiatePayment.
 * No I/O — unit-testable.
 */

export const COMPLETABLE_STATUSES = Object.freeze(['pending']);

export const ALLOWED_PAYMENT_METHODS = Object.freeze([
  'mtn_momo',
  'orange_money',
  'bank',
  'cash',
  'other',
]);

export const MOMO_METHODS = Object.freeze(['mtn_momo', 'orange_money']);

/**
 * Whether a payment row may be transitioned to completed.
 * @param {string|null|undefined} status
 * @returns {{ ok: true } | { ok: false, reason: string }}
 */
export function canCompletePayment(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'completed') {
    return { ok: false, reason: 'already_completed' };
  }
  if (!COMPLETABLE_STATUSES.includes(s)) {
    return { ok: false, reason: `invalid_status:${s || 'unknown'}` };
  }
  return { ok: true };
}

/**
 * Compare expected (DB) amount with provider-reported amount.
 * Allows 1 XAF tolerance for float/rounding noise.
 * @param {number|string} expected
 * @param {number|string|null|undefined} reported - omit to skip check
 * @returns {{ ok: true } | { ok: false, expected: number, reported: number }}
 */
export function amountsMatch(expected, reported) {
  if (reported == null || reported === '') {
    return { ok: true };
  }
  const exp = Number(expected);
  const rep = Number(reported);
  if (!Number.isFinite(exp) || !Number.isFinite(rep)) {
    return { ok: false, expected: exp, reported: rep };
  }
  if (Math.abs(exp - rep) > 1) {
    return { ok: false, expected: exp, reported: rep };
  }
  return { ok: true };
}

/**
 * Full pre-check before completing a payment (webhook / admin).
 * @param {{ status?: string, amount?: number|string }} payment
 * @param {{ amount?: number|string|null }} [opts]
 */
export function validatePaymentCompletion(payment, opts = {}) {
  if (!payment || typeof payment !== 'object') {
    return { ok: false, reason: 'missing_payment' };
  }
  const statusGate = canCompletePayment(payment.status);
  if (!statusGate.ok) {
    return statusGate;
  }
  const amountGate = amountsMatch(payment.amount, opts.amount);
  if (!amountGate.ok) {
    return { ok: false, reason: 'amount_mismatch', ...amountGate };
  }
  return { ok: true };
}

/**
 * Normalize Cameroon phone input to digits (optional leading country code 237).
 * @param {string|null|undefined} value
 * @returns {string} digits only
 */
export function normalizeCameroonPhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.startsWith('237') && digits.length >= 12) {
    return digits.slice(3);
  }
  if (digits.startsWith('00237') && digits.length >= 14) {
    return digits.slice(5);
  }
  return digits;
}

/**
 * Plausible CM mobile number: 9 digits starting with 6 (after stripping 237).
 * @param {string|null|undefined} value
 */
export function isPlausibleCameroonMobile(value) {
  const n = normalizeCameroonPhone(value);
  return /^6\d{8}$/.test(n);
}

/**
 * Validate a new payment attempt before insert.
 * @param {{
 *   invoiceId?: string,
 *   studentId?: string,
 *   amount?: number|string,
 *   method?: string,
 *   phoneNumber?: string|null,
 * }} payload
 * @returns {{ ok: true, amount: number, method: string, phoneNumber: string|null, invoiceId: string, studentId: string } | { ok: false, message: string }}
 */
export function validatePaymentInitiation(payload) {
  if (!payload || typeof payload !== 'object') {
    return { ok: false, message: 'Invalid payment payload' };
  }

  const invoiceId = String(payload.invoiceId || '').trim();
  const studentId = String(payload.studentId || '').trim();
  if (!invoiceId) {
    return { ok: false, message: 'Invoice is required' };
  }
  if (!studentId) {
    return { ok: false, message: 'Student is required' };
  }

  const amount = Number(payload.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, message: 'Payment amount must be a positive number' };
  }
  // Hard ceiling to catch unit mistakes (e.g. millimes); institutional fees are well below this
  if (amount > 500_000_000) {
    return { ok: false, message: 'Payment amount is unrealistically large' };
  }

  const methodRaw = String(payload.method || 'other').trim().toLowerCase();
  const method = ALLOWED_PAYMENT_METHODS.includes(methodRaw) ? methodRaw : 'other';

  let phoneNumber = null;
  const rawPhone = payload.phoneNumber;
  if (rawPhone != null && String(rawPhone).trim()) {
    const normalized = normalizeCameroonPhone(rawPhone);
    phoneNumber = normalized || null;
  }

  if (MOMO_METHODS.includes(method)) {
    if (!phoneNumber || !isPlausibleCameroonMobile(phoneNumber)) {
      return {
        ok: false,
        message:
          'A valid Cameroon mobile number is required for Mobile Money (e.g. 6XX XXX XXX)',
      };
    }
    // Store national 9-digit form for operator consistency
    phoneNumber = normalizeCameroonPhone(phoneNumber);
  }

  return { ok: true, amount, method, phoneNumber, invoiceId, studentId };
}
