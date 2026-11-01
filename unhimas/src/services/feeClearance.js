import { getStudentFeeBalance } from './feesService';
import { supabase } from '../lib/supabase';
import {
  evaluateFeeClearance,
  normalizeFeeClearancePolicy,
} from '../lib/feeClearanceLogic';

/**
 * Whether fee clearance is required before viewing results/transcript.
 * system_settings.fee_clearance_required:
 *   { "enabled": true, "min_paid_ratio": 1 }
 * min_paid_ratio: 1 = full balance, 0.5 = at least 50% of invoiced paid, etc.
 */
export async function getFeeClearancePolicy() {
  try {
    const { data, error } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'fee_clearance_required')
      .maybeSingle();
    if (error || !data) {
      return { enabled: true, minPaidRatio: 1 };
    }
    return normalizeFeeClearancePolicy(data.value || {});
  } catch {
    return { enabled: true, minPaidRatio: 1 };
  }
}

export async function isFeeClearanceRequired() {
  const policy = await getFeeClearancePolicy();
  return policy.enabled;
}

/**
 * Returns { cleared, outstanding, required, totalInvoiced, totalPaid, minPaidRatio }.
 * cleared=true means student may view official results/transcript.
 */
export async function checkFeeClearance(studentId) {
  const policy = await getFeeClearancePolicy();
  if (!policy.enabled) {
    return evaluateFeeClearance({
      enabled: false,
      minPaidRatio: policy.minPaidRatio,
    });
  }
  if (!studentId) {
    return {
      cleared: false,
      outstanding: null,
      required: true,
      totalInvoiced: null,
      totalPaid: null,
      minPaidRatio: policy.minPaidRatio,
    };
  }
  try {
    const bal = await getStudentFeeBalance(studentId);
    return evaluateFeeClearance({
      outstanding: bal?.outstanding_balance,
      totalInvoiced: bal?.total_invoiced,
      totalPaid: bal?.total_paid,
      minPaidRatio: policy.minPaidRatio,
      enabled: true,
    });
  } catch {
    // Fail open on balance errors so a missing fees migration does not block academics
    return {
      cleared: true,
      outstanding: 0,
      required: true,
      error: true,
      minPaidRatio: policy.minPaidRatio,
    };
  }
}

export { evaluateFeeClearance, normalizeFeeClearancePolicy };
