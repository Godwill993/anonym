import { supabase } from '../lib/supabase';

/**
 * Admin service — overview stats, notifications, resources, audit helpers.
 */

export async function getAdminOverviewStats() {
  const [
    studentsRes,
    lecturersRes,
    departmentsRes,
    coursesRes,
    batchesRes,
    pendingMarksRes,
    publishedRes,
    activeShiftsRes,
  ] = await Promise.all([
    supabase.from('students').select('*', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('lecturers').select('*', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('departments').select('*', { count: 'exact', head: true }),
    supabase.from('courses').select('*', { count: 'exact', head: true }),
    supabase.from('batches').select('*', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('mark_submissions').select('*', { count: 'exact', head: true }).eq('status', 'submitted'),
    supabase.from('mark_submissions').select('*', { count: 'exact', head: true }).eq('status', 'published'),
    supabase.from('lecturer_shifts').select('*', { count: 'exact', head: true }).is('clock_out', null),
  ]);

  return {
    totalStudents: studentsRes.count ?? 0,
    totalLecturers: lecturersRes.count ?? 0,
    totalDepartments: departmentsRes.count ?? 0,
    totalCourses: coursesRes.count ?? 0,
    totalBatches: batchesRes.count ?? 0,
    pendingMarkSubmissions: pendingMarksRes.count ?? 0,
    publishedResults: publishedRes.count ?? 0,
    activeLecturerShifts: activeShiftsRes.count ?? 0,
  };
}

export async function getDepartmentEnrollment() {
  const { data, error } = await supabase
    .from('departments')
    .select('id, name, abbreviation, students:students(count)')
    .order('name');

  if (error) throw error;

  return (data || []).map((d) => ({
    id: d.id,
    name: d.abbreviation || d.name,
    fullName: d.name,
    students: d.students?.[0]?.count ?? 0,
  }));
}

export async function getLiveLecturerPresence() {
  const { data, error } = await supabase
    .from('lecturer_shifts')
    .select('id, clock_in, lecturers:lecturer_id(id, first_name, last_name, staff_id)')
    .is('clock_out', null)
    .order('clock_in', { ascending: false })
    .limit(20);

  if (error) throw error;
  return data || [];
}

export async function getPendingSubmissionsList() {
  const { data, error } = await supabase
    .from('mark_submissions')
    .select(
      `
      id,
      status,
      submitted_at,
      batch_courses (
        id,
        courses (id, code, name),
        batches (id, name, code)
      )
    `,
    )
    .eq('status', 'submitted')
    .order('submitted_at', { ascending: false })
    .limit(15);

  if (error) throw error;
  return data || [];
}

export async function getRecentAuditLogs(limit = 8) {
  const { data, error } = await supabase
    .from('audit_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

export async function getAdminNotifications(profileId, { limit = 100 } = {}) {
  let query = supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (profileId) query = query.eq('recipient_id', profileId);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function markAdminNotificationRead(notificationId) {
  const { data, error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function markAllAdminNotificationsRead(profileId) {
  let query = supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('is_read', false);
  if (profileId) query = query.eq('recipient_id', profileId);
  const { error } = await query;
  if (error) throw error;
}

/** Permanently remove all notifications for this user (inbox wipe). */
export async function clearAllAdminNotifications(profileId) {
  if (!profileId) throw new Error('Profile required to clear notifications');
  const { error } = await supabase
    .from('notifications')
    .delete()
    .eq('recipient_id', profileId);
  if (error) throw error;
}

export async function getAdminResources() {
  const { data, error } = await supabase
    .from('resources')
    .select(`
      id,
      title,
      description,
      course_id,
      batch_id,
      file_path,
      file_name,
      mime_type,
      created_at,
      courses:course_id (id, code, name),
      batches:batch_id (id, name, code)
    `)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function getAdminResourceDownload(filePath) {
  const { data, error } = await supabase.storage.from('resources').createSignedUrl(filePath, 60);
  if (error) throw error;
  return { url: data?.signedUrl };
}

export async function uploadAdminResource({ file, title, description, course_id, batch_id }) {
  const ext = file.name.includes('.') ? file.name.split('.').pop() : 'bin';
  const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error: upErr } = await supabase.storage.from('resources').upload(path, file, {
    contentType: file.type || 'application/octet-stream',
    upsert: false,
  });
  if (upErr) throw upErr;

  const { data, error } = await supabase
    .from('resources')
    .insert([
      {
        title,
        description,
        course_id: course_id || null,
        batch_id: batch_id || null,
        file_path: path,
        file_name: file.name,
        mime_type: file.type || null,
      },
    ])
    .select()
    .single();

  if (error) {
    await supabase.storage.from('resources').remove([path]);
    throw error;
  }
  return data;
}

export async function deleteAdminResource(id) {
  const { data: row, error: fetchErr } = await supabase
    .from('resources')
    .select('file_path')
    .eq('id', id)
    .single();
  if (fetchErr) throw fetchErr;

  const { error } = await supabase.from('resources').delete().eq('id', id);
  if (error) throw error;

  if (row?.file_path) {
    await supabase.storage.from('resources').remove([row.file_path]);
  }
  return true;
}
