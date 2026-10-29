import { supabase } from '../lib/supabase';
import { canEditAttendanceSession } from '../lib/marksWorkflow';

function migrationHint(error) {
  const msg = error?.message || '';
  const code = error?.code || '';
  if (
    code === '42703' ||
    /attendance_status/i.test(msg) ||
    /column .* does not exist/i.test(msg)
  ) {
    return new Error(
      'Attendance approval is not set up on the database yet. Ask an admin to run APPLY_ATTENDANCE_WORKFLOW.sql (or migrations 20261029000000 + 20261029000001) in the Supabase SQL editor, then try again.',
    );
  }
  if (code === 'PGRST116' || /0 rows/i.test(msg)) {
    return new Error(
      'Could not submit this session. It may already be submitted or approved, or the session was not found.',
    );
  }
  return error instanceof Error ? error : new Error(msg || 'Could not update attendance status');
}

/** Submit session attendance for admin review (draft/returned → submitted). */
export async function submitSessionAttendance(sessionId) {
  if (!sessionId) throw new Error('No session selected');
  const { data, error } = await supabase
    .from('class_sessions')
    .update({
      attendance_status: 'submitted',
      attendance_submitted_at: new Date().toISOString(),
      attendance_admin_comment: null,
    })
    .eq('id', sessionId)
    .in('attendance_status', ['draft', 'returned'])
    .select()
    .single();
  if (error) throw migrationHint(error);
  return data;
}

/** After admin returns attendance, lecturer can resubmit. */
export async function resubmitSessionAttendance(sessionId) {
  if (!sessionId) throw new Error('No session selected');
  const { data, error } = await supabase
    .from('class_sessions')
    .update({
      attendance_status: 'submitted',
      attendance_submitted_at: new Date().toISOString(),
      attendance_admin_comment: null,
    })
    .eq('id', sessionId)
    .eq('attendance_status', 'returned')
    .select()
    .single();
  if (error) throw migrationHint(error);
  return data;
}

/** Whether lecturer may still edit attendance for this session. */
export function canEditSessionAttendance(session) {
  return canEditAttendanceSession(session?.attendance_status);
}
