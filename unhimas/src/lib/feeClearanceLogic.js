/**
 * Pure fee-clearance decision helpers (no I/O).
 * Used by services/feeClearance.js and covered by unit tests.
 */

/**
 * Normalize a policy object from system_settings or defaults.
 * @param {{ enabled?: boolean, min_paid_ratio?: number, minPaidRatio?: number } | null | undefined} value
 * @returns {{ enabled: boolean, minPaidRatio: number }}
 */
export function normalizeFeeClearancePolicy(value) {
  if (!value || typeof value !== 'object') {
    return { enabled: true, minPaidRatio: 1 };
  }
  const raw = Number(value.min_paid_ratio ?? value.minPaidRatio ?? 1);
  const minPaidRatio =
    Number.isFinite(raw) && raw > 0 && raw <= 1 ? raw : 1;
  return {
    enabled: value.enabled !== false,
    minPaidRatio,
  };
}

/**
 * Decide whether a student is cleared to view official results/transcript.
 *
 * Rules:
 * - If policy is disabled → always cleared.
 * - If outstanding <= 0 → cleared.
 * - Else cleared when totalPaid / totalInvoiced >= minPaidRatio
 *   (when totalInvoiced is 0, ratio is treated as 1).
 *
 * @param {{ outstanding?: number, totalInvoiced?: number, totalPaid?: number, minPaidRatio?: number, enabled?: boolean }} input
 * @returns {{ cleared: boolean, outstanding: number, totalInvoiced: number, totalPaid: number, minPaidRatio: number, paidRatio: number, required: boolean }}
 */
export function evaluateFeeClearance({
  outstanding = 0,
  totalInvoiced = 0,
  totalPaid = 0,
  minPaidRatio = 1,
  enabled = true,
} = {}) {
  const policy = normalizeFeeClearancePolicy({ enabled, minPaidRatio });
  const o = Number(outstanding) || 0;
  const invoiced = Number(totalInvoiced) || 0;
  const paid = Number(totalPaid) || 0;

  if (!policy.enabled) {
    return {
      cleared: true,
      outstanding: o,
      totalInvoiced: invoiced,
      totalPaid: paid,
      minPaidRatio: policy.minPaidRatio,
      paidRatio: invoiced > 0 ? paid / invoiced : 1,
      required: false,
    };
  }

  const paidRatio = invoiced > 0 ? paid / invoiced : 1;
  const meetsRatio = paidRatio + 1e-9 >= policy.minPaidRatio;
  const cleared = o <= 0 || meetsRatio;

  return {
    cleared,
    outstanding: o,
    totalInvoiced: invoiced,
    totalPaid: paid,
    minPaidRatio: policy.minPaidRatio,
    paidRatio,
    required: true,
  };
}
