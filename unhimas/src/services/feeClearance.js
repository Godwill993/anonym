import { getStudentFeeBalance } from './feesService';
import { supabase } from '../lib/supabase';

/**
 * Whether fee clearance is required before viewing results/transcript.
 * Controlled by system_settings.fee_clearance_required.enabled (default true).
 */
export async function isFeeClearanceRequired() {
  try {
    const { data, error } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'fee_clearance_required')
      .maybeSingle();
    if (error || !data) return true;
    return data.value?.enabled !== false;
  } catch {
    return true;
  }
}

/**
 * Returns { cleared, outstanding, required }.
 * cleared=true means student may view official results/transcript.
 */
export async function checkFeeClearance(studentId) {
  const required = await isFeeClearanceRequired();
  if (!required) {
    return { cleared: true, outstanding: 0, required: false };
  }
  if (!studentId) {
    return { cleared: false, outstanding: null, required: true };
  }
  try {
    const bal = await getStudentFeeBalance(studentId);
    const outstanding = Number(bal?.outstanding_balance ?? 0);
    return {
      cleared: outstanding <= 0,
      outstanding,
      required: true,
    };
  } catch {
    // Fail open on balance errors so a missing fees migration does not block academics
    return { cleared: true, outstanding: 0, required: true, error: true };
  }
}
