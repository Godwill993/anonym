import { getStudentFeeBalance } from './feesService';
import { supabase } from '../lib/supabase';

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
    const value = data.value || {};
    const minPaidRatio = Number(value.min_paid_ratio ?? value.minPaidRatio ?? 1);
    return {
      enabled: value.enabled !== false,
      minPaidRatio:
        Number.isFinite(minPaidRatio) && minPaidRatio > 0 && minPaidRatio <= 1
          ? minPaidRatio
          : 1,
    };
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
    return {
      cleared: true,
      outstanding: 0,
      required: false,
      totalInvoiced: 0,
      totalPaid: 0,
      minPaidRatio: policy.minPaidRatio,
    };
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
    const outstanding = Number(bal?.outstanding_balance ?? 0);
    const totalInvoiced = Number(bal?.total_invoiced ?? 0);
    const totalPaid = Number(bal?.total_paid ?? 0);
    const ratio = totalInvoiced > 0 ? totalPaid / totalInvoiced : 1;
    const meetsRatio = ratio + 1e-9 >= policy.minPaidRatio;
    const cleared = outstanding <= 0 || meetsRatio;
    return {
      cleared,
      outstanding,
      required: true,
      totalInvoiced,
      totalPaid,
      minPaidRatio: policy.minPaidRatio,
      paidRatio: ratio,
    };
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
