import { supabase } from '../lib/supabase';

export async function getMyStudentProfile() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  const { data, error } = await supabase.from('students').select(`*, batches:batch_id (id, name, code, departments:department_id (id, name, abbreviation), academic_years:academic_year_id (id, name, is_current))`).eq('profile_id', user.id).single();
  if (error) throw error;
  return data;
}

export async function getMyStudentCourses(batchId) {
  const { data, error } = await supabase.from('batch_courses').select(`id, is_compulsory, courses:course_id (id, code, name, credit_units), semesters:semester_id (id, name, number, is_current, academic_years:academic_year_id (name)), lecturers:lecturer_id (id, first_name, last_name, staff_id)`).eq('batch_id', batchId).order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function getMyAttendance(studentId, { batchCourseId = null } = {}) {
  let sessionsQuery = supabase.from('class_sessions').select('id, batch_course_id, scheduled_start, scheduled_end, topic');
  if (batchCourseId) sessionsQuery = sessionsQuery.eq('batch_course_id', batchCourseId);
  const { data: sessions, error: sErr } = await sessionsQuery;
  if (sErr) throw sErr;
  if (!sessions?.length) return [];
  const sessionIds = sessions.map((s) => s.id);
  const { data: attendanceRecords, error: aErr } = await supabase.from('attendance').select('session_id, status, marked_at').eq('student_id', studentId).in('session_id', sessionIds);
  if (aErr) throw aErr;
  const attendanceMap = {};
  (attendanceRecords || []).forEach((r) => { attendanceMap[r.session_id] = r; });
  return sessions.map((s) => ({ ...s, attendance: attendanceMap[s.id] || { status: 'absent' } }));
}

export async function getMyAttendanceSummary(studentId, batchId) {
  const { data: batchCourses, error: bcErr } = await supabase.from('batch_courses').select(`id, courses:course_id (code, name), semesters:semester_id (name, number)`).eq('batch_id', batchId);
  if (bcErr) throw bcErr;
  if (!batchCourses?.length) return [];
  const summary = await Promise.all(batchCourses.map(async (bc) => {
    const { data: sessions, error: sessionsError } = await supabase.from('class_sessions').select('id').eq('batch_course_id', bc.id);
    if (sessionsError) throw sessionsError;
    const sessionIds = (sessions || []).map((s) => s.id);
    if (!sessionIds.length) return { ...bc, totalSessions: 0, present: 0, absent: 0, late: 0, percentage: 0 };
    const { data: records, error: recordsError } = await supabase.from('attendance').select('status').eq('student_id', studentId).in('session_id', sessionIds);
    if (recordsError) throw recordsError;
    let present = 0, absent = 0, late = 0;
    (records || []).forEach((r) => { if (r.status === 'present') present++; else if (r.status === 'absent') absent++; else if (r.status === 'late') late++; });
    const total = sessionIds.length;
    const attended = present + late;
    return { ...bc, totalSessions: total, present, absent, late, percentage: total > 0 ? Math.round((attended / total) * 100) : 0 };
  }));
  return summary;
}

export async function getMyResults(studentId) {
  const { data, error } = await supabase.from('marks').select(`id, attendance_score, coursework_score, exam_score, total_score, grade, grade_point, lecturer_comment, updated_at, mark_submissions:mark_submission_id (id, status, published_at, batch_courses:batch_course_id (id, courses:course_id (id, code, name, credit_units), semesters:semester_id (id, name, number, academic_years:academic_year_id (name))))`).eq('student_id', studentId).eq('mark_submissions.status', 'published');
  if (error) throw error;
  return (data || []).filter((m) => m.mark_submissions?.status === 'published');
}

export async function getMyTimetable(batchId) {
  const { data: batchCourses, error: bcErr } = await supabase.from('batch_courses').select('id, courses:course_id (code, name), lecturers:lecturer_id (first_name, last_name)').eq('batch_id', batchId);
  if (bcErr) throw bcErr;
  if (!batchCourses?.length) return [];
  const batchCourseIds = batchCourses.map((bc) => bc.id);
  const bcMap = {};
  batchCourses.forEach((bc) => { bcMap[bc.id] = bc; });
  const { data: slots, error: sErr } = await supabase.from('timetable_slots').select(`id, day_of_week, start_time, end_time, room, batch_course_id`).in('batch_course_id', batchCourseIds).order('day_of_week').order('start_time');
  if (sErr) throw sErr;
  return (slots || []).map((slot) => ({ ...slot, batch_course: bcMap[slot.batch_course_id] || null }));
}

export async function getMyAnnouncements(batchId, departmentId) {
  let query = supabase.from('announcements').select('*').eq('is_published', true).order('published_at', { ascending: false }).limit(20);
  if (batchId && departmentId) query = query.or(`and(batch_id.is.null,department_id.is.null),batch_id.eq.${batchId},department_id.eq.${departmentId}`);
  else if (batchId) query = query.or(`and(batch_id.is.null,department_id.is.null),batch_id.eq.${batchId}`);
  else query = query.is('batch_id', null).is('department_id', null);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function getStudentResources(batchId, _departmentId) {
  if (!batchId) return [];
  const { data: batchCourses, error: coursesError } = await supabase.from('batch_courses').select('course_id').eq('batch_id', batchId);
  if (coursesError) throw coursesError;
  const courseIds = [...new Set((batchCourses || []).map((row) => row.course_id).filter(Boolean))];
  let query = supabase.from('resources').select(`id, title, description, course_id, batch_id, file_path, file_name, mime_type, created_at, course:course_id (id, code, name)`).order('created_at', { ascending: false });
  if (courseIds.length > 0) query = query.or(`batch_id.eq.${batchId},course_id.in.(${courseIds.join(',')})`);
  else query = query.eq('batch_id', batchId);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function getStudentResourceDownload(filePath) {
  const { data, error } = await supabase.storage.from('resources').createSignedUrl(filePath, 60);
  if (error) throw error;
  if (!data?.signedUrl) throw new Error('No signed URL returned for this resource.');
  return { url: data.signedUrl, error: null };
}

export async function getMyUpcomingSessions(batchId, { limit = 5 } = {}) {
  const { data: batchCourses, error: coursesError } = await supabase.from('batch_courses').select('id').eq('batch_id', batchId);
  if (coursesError) throw coursesError;
  const batchCourseIds = (batchCourses || []).map((course) => course.id);
  if (batchCourseIds.length === 0) return [];
  const { data, error } = await supabase.from('class_sessions').select(`id, batch_course_id, scheduled_start, scheduled_end, room, topic, batch_courses:batch_course_id (id, courses:course_id (code, name), lecturers:lecturer_id (first_name, last_name))`).in('batch_course_id', batchCourseIds).gte('scheduled_start', new Date().toISOString()).order('scheduled_start', { ascending: true }).limit(limit);
  if (error) throw error;
  return data || [];
}

export async function getStudentNotifications(profileId, { limit = 30 } = {}) {
  const { data, error } = await supabase.from('notifications').select('*').eq('recipient_id', profileId).order('created_at', { ascending: false }).limit(limit);
  if (error) throw error;
  return data || [];
}

export async function markStudentNotificationRead(notificationId) {
  const { data, error } = await supabase.from('notifications').update({ is_read: true }).eq('id', notificationId).select().single();
  if (error) throw error;
  return data;
}

export async function markAllStudentNotificationsRead(profileId) {
  const { error } = await supabase.from('notifications').update({ is_read: true }).eq('recipient_id', profileId).eq('is_read', false);
  if (error) throw error;
}

/** Permanently remove all notifications for this student. */
export async function clearAllStudentNotifications(profileId) {
  if (!profileId) throw new Error('Profile required to clear notifications');
  const { error } = await supabase.from('notifications').delete().eq('recipient_id', profileId);
  if (error) throw error;
}

export async function getStudentDashboardStats(studentId, batchId, profileId) {
  const [coursesRes, unreadNotifsRes, currentYearRes, overallGpaRes, attendanceRes, resultsRes, settingsRes] = await Promise.all([
    supabase.from('batch_courses').select('*', { count: 'exact', head: true }).eq('batch_id', batchId),
    supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('recipient_id', profileId).eq('is_read', false),
    supabase.from('academic_years').select('id, name').eq('is_current', true).limit(1).maybeSingle(),
    supabase.from('student_overall_gpa').select('overall_gpa').eq('student_id', studentId).maybeSingle(),
    supabase.from('attendance_summary').select('total_sessions, attended_sessions').eq('student_id', studentId),
    supabase.from('results').select('student_id', { count: 'exact', head: true }).eq('student_id', studentId),
    supabase.from('settings').select('attendance_threshold').limit(1).maybeSingle(),
  ]);
  const errors = [coursesRes, unreadNotifsRes, currentYearRes, overallGpaRes, attendanceRes, resultsRes, settingsRes].map((r) => r.error).filter(Boolean);
  if (errors.length) throw errors[0];
  let currentSemester = null;
  if (currentYearRes.data) {
    const { data, error } = await supabase.from('semesters').select('id, name, number').eq('academic_year_id', currentYearRes.data.id).eq('is_current', true).maybeSingle();
    if (error) throw error;
    if (data) currentSemester = { ...data, academic_years: currentYearRes.data };
  }
  const totalSessions = (attendanceRes.data || []).reduce((sum, row) => sum + Number(row.total_sessions || 0), 0);
  const attendedSessions = (attendanceRes.data || []).reduce((sum, row) => sum + Number(row.attended_sessions || 0), 0);
  const attendancePct = totalSessions > 0 ? Math.round((attendedSessions / totalSessions) * 100) : null;
  let semesterGpa = null;
  if (currentSemester) {
    const { data, error } = await supabase.from('student_semester_gpa').select('semester_gpa').eq('student_id', studentId).eq('semester_id', currentSemester.id).maybeSingle();
    if (error) throw error;
    semesterGpa = data?.semester_gpa ?? null;
  }
  const gpaValue = semesterGpa ?? overallGpaRes.data?.overall_gpa ?? null;
  return {
    totalCourses: coursesRes.count ?? 0,
    publishedResults: resultsRes.count ?? 0,
    gpa: gpaValue === null ? null : Number(gpaValue).toFixed(2),
    gpaScope: semesterGpa !== null ? 'Current Semester GPA' : 'Cumulative GPA',
    currentSemester,
    attendancePct,
    attendanceThreshold: Number(settingsRes.data?.attendance_threshold ?? 75),
    unreadNotifications: unreadNotifsRes.count ?? 0,
  };
}
