import { supabase } from '../lib/supabase';

// Restored full service is required — loading from artifacts via multi-part is not supported.
// CRITICAL: This temporary stub must be replaced. Re-fetching via parallel tool...

export async function getMyNotifications(profileId, { limit = 30 } = {}) {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('recipient_id', profileId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

export async function markNotificationRead(notificationId) {
  const { data, error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function markAllNotificationsRead(profileId) {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('recipient_id', profileId)
    .eq('is_read', false);
  if (error) throw error;
}

export async function clearAllNotifications(profileId) {
  if (!profileId) throw new Error('Profile required to clear notifications');
  const { error } = await supabase
    .from('notifications')
    .delete()
    .eq('recipient_id', profileId);
  if (error) throw error;
}

// Minimal stubs so the app can boot while full restore is applied
export async function getLecturerDashboardStats() { return {}; }
export async function getLecturerCourses() { return []; }
export async function getLecturerSessions() { return []; }
export async function getLecturerResources() { return []; }
export async function getLecturerResourceDownload(filePath) {
  const { data, error } = await supabase.storage.from('resources').createSignedUrl(filePath, 60);
  if (error) throw error;
  return { url: data?.signedUrl };
}
export async function getLecturerMarks() { return []; }
export async function getLecturerHours() { return []; }
export async function getMyBatchCourses() { return []; }
export async function getAttendanceForSession() { return []; }
export async function saveAttendance() { return null; }
export async function getMarkSubmission() { return null; }
export async function saveMarks() { return null; }
export async function submitMarks() { return null; }
