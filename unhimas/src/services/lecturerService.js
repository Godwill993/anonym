import { supabase } from '../lib/supabase';

function parseSessionDateTime(value) {
  if (value == null || value === '') return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const str = String(value).trim();
  const localMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (localMatch && !/[zZ]|[+\-]\d{2}:?\d{2}$/.test(str)) {
    const [, y, mo, d, h, mi, s] = localMatch;
    const dt = new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s || 0), 0);
    return Number.isNaN(dt.getTime()) ? null : dt;
  }
  const dt = new Date(str);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

export async function getMyLecturerProfile() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  const { data, error } = await supabase.from('lecturers').select(`*, departments:department_id (id, name, abbreviation)`).eq('profile_id', user.id).single();
  if (error) throw error;
  return data;
}

export async function getMyCourses(lecturerId) {
  const { data, error } = await supabase.from('batch_courses').select(`id, is_compulsory, courses:course_id (id, code, name, credit_units), batches:batch_id (id, name, code, departments:department_id (name, abbreviation)), semesters:semester_id (id, name, number, is_current, academic_years:academic_year_id (id, name, is_current))`).eq('lecturer_id', lecturerId).order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function getTodaySessions(lecturerId) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
  const { data, error } = await supabase.from('class_sessions').select(`*, batch_courses:batch_course_id (id, courses:course_id (id, code, name), batches:batch_id (id, name, code))`).eq('lecturer_id', lecturerId).gte('scheduled_start', today.toISOString()).lt('scheduled_start', tomorrow.toISOString()).order('scheduled_start');
  if (error) throw error;
  return data || [];
}

export async function getUpcomingSessions(lecturerId) {
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(0, 0, 0, 0);
  const weekLater = new Date(tomorrow); weekLater.setDate(weekLater.getDate() + 7);
  const { data, error } = await supabase.from('class_sessions').select(`*, batch_courses:batch_course_id (id, courses:course_id (code, name), batches:batch_id (name, code))`).eq('lecturer_id', lecturerId).gte('scheduled_start', tomorrow.toISOString()).lt('scheduled_start', weekLater.toISOString()).order('scheduled_start').limit(5);
  if (error) throw error;
  return data || [];
}

export async function getMyMarkSubmissions(lecturerId) {
  const { data, error } = await supabase.from('mark_submissions').select(`*, batch_courses:batch_course_id (id, courses:course_id (id, code, name, credit_units), batches:batch_id (id, name, code), semesters:semester_id (id, name, number))`).eq('lecturer_id', lecturerId).order('updated_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function getOrCreateMarkSubmission(batchCourseId, lecturerId) {
  const { data: existing, error: findError } = await supabase.from('mark_submissions').select('*').eq('batch_course_id', batchCourseId).maybeSingle();
  if (findError) throw findError;
  let submission = existing;
  if (!submission) {
    const { data, error } = await supabase.from('mark_submissions').insert([{ batch_course_id: batchCourseId, lecturer_id: lecturerId, status: 'draft' }]).select().single();
    if (error) throw error;
    submission = data;
  }
  try { await supabase.rpc('ensure_marks_for_submission', { p_submission_id: submission.id }); } catch (_) {}
  return submission;
}

export async function ensureMarksForSubmission(submissionId) {
  const { data, error } = await supabase.rpc('ensure_marks_for_submission', { p_submission_id: submissionId });
  if (error) throw error;
  return data;
}

export async function getMarksForSubmission(submissionId) {
  const { data, error } = await supabase.from('marks').select(`*, students:student_id (id, matricule, first_name, middle_name, last_name)`).eq('mark_submission_id', submissionId).order('matricule', { foreignTable: 'students', ascending: true });
  if (error) throw error;
  return data || [];
}

export async function getStudentsInBatch(batchId) {
  const { data, error } = await supabase.from('students').select('id, matricule, first_name, middle_name, last_name').eq('batch_id', batchId).eq('is_active', true).order('matricule');
  if (error) throw error;
  return data || [];
}

export async function upsertMark({ mark_submission_id, student_id, attendance_score, coursework_score, exam_score, lecturer_comment }) {
  const { data, error } = await supabase.from('marks').upsert([{ mark_submission_id, student_id, attendance_score: Number(attendance_score) || 0, coursework_score: Number(coursework_score) || 0, exam_score: Number(exam_score) || 0, lecturer_comment: lecturer_comment || null, updated_at: new Date().toISOString() }], { onConflict: 'mark_submission_id,student_id' }).select().single();
  if (error) throw error;
  return data;
}

export async function submitMarkSubmission(submissionId) {
  const { data, error } = await supabase.from('mark_submissions').update({ status: 'submitted', submitted_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', submissionId).select().single();
  if (error) throw error;
  return data;
}

export async function resubmitMarkSubmission(submissionId) {
  const { data, error } = await supabase.from('mark_submissions').update({ status: 'submitted', submitted_at: new Date().toISOString(), updated_at: new Date().toISOString(), admin_comment: null }).eq('id', submissionId).eq('status', 'returned').select().single();
  if (error) throw error;
  return data;
}

export async function getSessionsForBatchCourse(batchCourseId, lecturerId) {
  const { data, error } = await supabase.from('class_sessions').select('*').eq('batch_course_id', batchCourseId).eq('lecturer_id', lecturerId).order('scheduled_start', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function createClassSession({ batch_course_id, lecturer_id, room, scheduled_start, scheduled_end, topic, notes }) {
  const start = parseSessionDateTime(scheduled_start);
  const end = parseSessionDateTime(scheduled_end);
  if (!start || !end) throw new Error('Invalid session date or time.');
  if (!(end.getTime() > start.getTime())) throw new Error('End time must be after start time.');
  const { data, error } = await supabase.from('class_sessions').insert([{ batch_course_id, lecturer_id, room: room?.trim() || null, scheduled_start: start.toISOString(), scheduled_end: end.toISOString(), topic: topic?.trim() || null, notes: notes?.trim() || null }]).select().single();
  if (error) throw error;
  return data;
}

export async function updateClassSession(id, { room, scheduled_start, scheduled_end, topic, notes }) {
  const row = {};
  if (scheduled_start) { const start = parseSessionDateTime(scheduled_start); if (!start) throw new Error('Invalid session start time.'); row.scheduled_start = start.toISOString(); }
  if (scheduled_end) { const end = parseSessionDateTime(scheduled_end); if (!end) throw new Error('Invalid session end time.'); row.scheduled_end = end.toISOString(); }
  if (room !== undefined) row.room = room?.trim() || null;
  if (topic !== undefined) row.topic = topic?.trim() || null;
  if (notes !== undefined) row.notes = notes?.trim() || null;
  if (row.scheduled_start && row.scheduled_end && !(new Date(row.scheduled_end).getTime() > new Date(row.scheduled_start).getTime())) throw new Error('End time must be after start time.');
  const { data, error } = await supabase.from('class_sessions').update(row).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteClassSession(id) {
  const { error } = await supabase.from('class_sessions').delete().eq('id', id);
  if (error) throw error;
  return true;
}

export async function getAttendanceForSession(sessionId) {
  const { data, error } = await supabase.from('attendance').select(`*, students:student_id (id, matricule, first_name, middle_name, last_name)`).eq('session_id', sessionId).order('matricule', { foreignTable: 'students', ascending: true });
  if (error) throw error;
  return data || [];
}

export async function upsertAttendance({ session_id, student_id, status, marked_by, note }) {
  const { data, error } = await supabase.from('attendance').upsert([{ session_id, student_id, status, marked_at: new Date().toISOString(), marked_by: marked_by || null, note: note || null, updated_at: new Date().toISOString() }], { onConflict: 'session_id,student_id' }).select().single();
  if (error) throw error;
  return data;
}

export async function markAllPresent(sessionId, studentIds, markedBy) {
  const rows = studentIds.map((sid) => ({ session_id: sessionId, student_id: sid, status: 'present', marked_at: new Date().toISOString(), marked_by: markedBy || null, updated_at: new Date().toISOString() }));
  const { data, error } = await supabase.from('attendance').upsert(rows, { onConflict: 'session_id,student_id' }).select();
  if (error) throw error;
  return data || [];
}

export async function getMyShifts(lecturerId, { limit = 50, dateFrom = null, dateTo = null } = {}) {
  let query = supabase.from('lecturer_shifts').select('*').eq('lecturer_id', lecturerId).order('clock_in', { ascending: false }).limit(limit);
  if (dateFrom) query = query.gte('clock_in', dateFrom);
  if (dateTo) query = query.lte('clock_in', dateTo);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function getMyNotifications(profileId, { limit = 30 } = {}) {
  const { data, error } = await supabase.from('notifications').select('*').eq('recipient_id', profileId).order('created_at', { ascending: false }).limit(limit);
  if (error) throw error;
  return data || [];
}

export async function getLecturerResources(lecturerId) {
  const { data: assigned, error: assignedError } = await supabase.from('batch_courses').select('course_id').eq('lecturer_id', lecturerId);
  if (assignedError) throw assignedError;
  const courseIds = [...new Set((assigned || []).map((row) => row.course_id).filter(Boolean))];
  if (courseIds.length === 0) return [];
  const { data, error } = await supabase.from('resources').select(`id, title, description, course_id, batch_id, file_path, file_name, mime_type, created_at, courses:course_id (id, code, name), batches:batch_id (id, name, code)`).in('course_id', courseIds).order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function getLecturerResourceDownload(filePath) {
  const { data, error } = await supabase.storage.from('resources').createSignedUrl(filePath, 60);
  if (error) throw error;
  if (!data?.signedUrl) throw new Error('No signed URL returned for this resource.');
  return { url: data.signedUrl, error: null };
}

export async function markNotificationRead(notificationId) {
  const { data, error } = await supabase.from('notifications').update({ is_read: true }).eq('id', notificationId).select().single();
  if (error) throw error;
  return data;
}

export async function markAllNotificationsRead(profileId) {
  const { error } = await supabase.from('notifications').update({ is_read: true }).eq('recipient_id', profileId).eq('is_read', false);
  if (error) throw error;
}

/** Permanently remove all notifications for this lecturer. */
export async function clearAllNotifications(profileId) {
  if (!profileId) throw new Error('Profile required to clear notifications');
  const { error } = await supabase.from('notifications').delete().eq('recipient_id', profileId);
  if (error) throw error;
}

export async function getLecturerDashboardStats(lecturerId, profileId) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();
  const nextMonthStart = new Date(today.getFullYear(), today.getMonth() + 1, 1).toISOString();
  const [coursesRes, todaySessionsRes, pendingMarksRes, returnedMarksRes, unreadNotifsRes, monthlyHoursRes] = await Promise.all([
    supabase.from('batch_courses').select('*', { count: 'exact', head: true }).eq('lecturer_id', lecturerId),
    supabase.from('class_sessions').select('*', { count: 'exact', head: true }).eq('lecturer_id', lecturerId).gte('scheduled_start', today.toISOString()).lt('scheduled_start', tomorrow.toISOString()),
    supabase.from('mark_submissions').select('*', { count: 'exact', head: true }).eq('lecturer_id', lecturerId).eq('status', 'draft'),
    supabase.from('mark_submissions').select('*', { count: 'exact', head: true }).eq('lecturer_id', lecturerId).eq('status', 'returned'),
    supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('recipient_id', profileId).eq('is_read', false),
    supabase.from('lecturer_hours_monthly').select('month, hours_taught').eq('lecturer_id', lecturerId).gte('month', monthStart).lt('month', nextMonthStart),
  ]);
  const queryErrors = [coursesRes, todaySessionsRes, pendingMarksRes, returnedMarksRes, unreadNotifsRes, monthlyHoursRes].map((r) => r.error).filter(Boolean);
  if (queryErrors.length) throw queryErrors[0];
  const { data: openShiftData, error: openShiftError } = await supabase.from('lecturer_shifts').select('id, clock_in, status').eq('lecturer_id', lecturerId).eq('status', 'open').maybeSingle();
  if (openShiftError) throw openShiftError;
  const monthlyHours = (monthlyHoursRes.data || []).reduce((sum, row) => sum + Number(row.hours_taught || 0), 0);
  return { totalCourses: coursesRes.count ?? 0, todaySessions: todaySessionsRes.count ?? 0, pendingMarksDraft: pendingMarksRes.count ?? 0, returnedMarks: returnedMarksRes.count ?? 0, unreadNotifications: unreadNotifsRes.count ?? 0, monthlyHours: Number(monthlyHours.toFixed(1)), currentShift: openShiftData || null };
}

export async function getAttendanceSummaryForBatchCourse(batchCourseId) {
  const { data: sessions, error: sErr } = await supabase.from('class_sessions').select('id').eq('batch_course_id', batchCourseId);
  if (sErr) throw sErr;
  if (!sessions?.length) return { totalSessions: 0, summary: [] };
  const sessionIds = sessions.map((s) => s.id);
  const { data: records, error: aErr } = await supabase.from('attendance').select(`student_id, status, students:student_id (matricule, first_name, last_name)`).in('session_id', sessionIds);
  if (aErr) throw aErr;
  const byStudent = {};
  (records || []).forEach((r) => {
    if (!byStudent[r.student_id]) byStudent[r.student_id] = { student_id: r.student_id, student: r.students, present: 0, absent: 0, late: 0, total: 0 };
    byStudent[r.student_id].total++;
    if (r.status === 'present') byStudent[r.student_id].present++;
    else if (r.status === 'absent') byStudent[r.student_id].absent++;
    else if (r.status === 'late') byStudent[r.student_id].late++;
  });
  return { totalSessions: sessions.length, summary: Object.values(byStudent) };
}
