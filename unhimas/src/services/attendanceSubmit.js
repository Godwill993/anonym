import { supabase } from '../lib/supabase';
import { canEditAttendanceSession } from '../lib/marksWorkflow';

/** Submit session attendance for admin review (draft/returned → submitted). */
export async function submitSessionAttendance(sessionId) {
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
  if (error) throw error;
  return data;
}

/** After admin returns attendance, lecturer can resubmit. */
export async function resubmitSessionAttendance(sessionId) {
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
  if (error) throw error;
  return data;
}

/** Whether lecturer may still edit attendance for this session. */
export function canEditSessionAttendance(session) {
  return canEditAttendanceSession(session?.attendance_status);
}
