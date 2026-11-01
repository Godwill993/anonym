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
 * Validate a new payment attempt before insert.
 * @param {{ invoiceId?: string, studentId?: string, amount?: number|string, method?: string }} payload
 * @returns {{ ok: true, amount: number, method: string } | { ok: false, message: string }}
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

  return { ok: true, amount, method, invoiceId, studentId };
}
