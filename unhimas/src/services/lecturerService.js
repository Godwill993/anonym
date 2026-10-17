import { supabase } from '../lib/supabase';

// ============================================================
// LECTURER PROFILE
// ============================================================

export async function getMyLecturerProfile() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  const { data, error } = await supabase
    .from('lecturers')
    .select(`*, departments:department_id (id, name, abbreviation)`)
    .eq('profile_id', user.id)
    .single();
  if (error) throw error;
  return data;
}

// ============================================================
// MY COURSES
// ============================================================

export async function getMyCourses(lecturerId) {
  const { data, error } = await supabase
    .from('batch_courses')
    .select(`
      id, is_compulsory,
      courses:course_id (id, code, name, credit_units),
      batches:batch_id (id, name, code, departments:department_id (name, abbreviation)),
      semesters:semester_id (id, name, number, is_current, academic_years:academic_year_id (id, name, is_current))
    `)
    .eq('lecturer_id', lecturerId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

// ============================================================
// TODAY'S SESSIONS
// ============================================================

export async function getTodaySessions(lecturerId) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const { data, error } = await supabase
    .from('class_sessions')
    .select(`
      *,
      batch_courses:batch_course_id (
        id,
        courses:course_id (id, code, name),
        batches:batch_id (id, name, code)
      )
    `)
    .eq('lecturer_id', lecturerId)
    .gte('scheduled_start', today.toISOString())
    .lt('scheduled_start', tomorrow.toISOString())
    .order('scheduled_start');
  if (error) throw error;
  return data || [];
}

// ============================================================
// UPCOMING SESSIONS
// ============================================================

export async function getUpcomingSessions(lecturerId) {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  const weekLater = new Date(tomorrow);
  weekLater.setDate(weekLater.getDate() + 7);
  const { data, error } = await supabase
    .from('class_sessions')
    .select(`
      *,
      batch_courses:batch_course_id (
        id,
        courses:course_id (code, name),
        batches:batch_id (name, code)
      )
    `)
    .eq('lecturer_id', lecturerId)
    .gte('scheduled_start', tomorrow.toISOString())
    .lt('scheduled_start', weekLater.toISOString())
    .order('scheduled_start')
    .limit(5);
  if (error) throw error;
  return data || [];
}

// ============================================================
// MY MARK SUBMISSIONS
// ============================================================

export async function getMyMarkSubmissions(lecturerId) {
  const { data, error } = await supabase
    .from('mark_submissions')
    .select(`
      *,
      batch_courses:batch_course_id (
        id,
        courses:course_id (id, code, name, credit_units),
        batches:batch_id (id, name, code),
        semesters:semester_id (id, name, number)
      )
    `)
    .eq('lecturer_id', lecturerId)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

// ============================================================
// GET or CREATE a mark submission
// ============================================================

export async function getOrCreateMarkSubmission(batchCourseId, lecturerId) {
  const { data: existing, error: findError } = await supabase
    .from('mark_submissions')
    .select('*')
    .eq('batch_course_id', batchCourseId)
    .maybeSingle();
  if (findError) throw findError;
  if (existing) return existing;
  const { data, error } = await supabase
    .from('mark_submissions')
    .insert([{ batch_course_id: batchCourseId, lecturer_id: lecturerId, status: 'draft' }])
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ============================================================
// MARKS
// ============================================================

export async function getMarksForSubmission(submissionId) {
  const { data, error } = await supabase
    .from('marks')
    .select(`*, students:student_id (id, matricule, first_name, middle_name, last_name)`)
    .eq('mark_submission_id', submissionId)
    .order('students(matricule)');
  if (error) throw error;
  return data || [];
}

export async function getStudentsInBatch(batchId) {
  const { data, error } = await supabase
    .from('students')
    .select('id, matricule, first_name, middle_name, last_name')
    .eq('batch_id', batchId)
    .eq('is_active', true)
    .order('matricule');
  if (error) throw error;
  return data || [];
}

export async function upsertMark({ mark_submission_id, student_id, attendance_score, coursework_score, exam_score, lecturer_comment }) {
  const { data, error } = await supabase
    .from('marks')
    .upsert(
      [{
        mark_submission_id,
        student_id,
        attendance_score: Number(attendance_score) || 0,
        coursework_score: Number(coursework_score) || 0,
        exam_score: Number(exam_score) || 0,
        lecturer_comment: lecturer_comment || null,
        updated_at: new Date().toISOString(),
      }],
      { onConflict: 'mark_submission_id,student_id' }
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function submitMarkSubmission(submissionId) {
  const { data, error } = await supabase
    .from('mark_submissions')
    .update({ status: 'submitted', submitted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', submissionId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function resubmitMarkSubmission(submissionId) {
  const { data, error } = await supabase
    .from('mark_submissions')
    .update({ status: 'submitted', submitted_at: new Date().toISOString(), updated_at: new Date().toISOString(), admin_comment: null })
    .eq('id', submissionId)
    .eq('status', 'returned')
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ============================================================
// CLASS SESSIONS
// ============================================================

export async function getSessionsForBatchCourse(batchCourseId, lecturerId) {
  const { data, error } = await supabase
    .from('class_sessions')
    .select('*')
    .eq('batch_course_id', batchCourseId)
    .eq('lecturer_id', lecturerId)
    .order('scheduled_start', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function createClassSession({ batch_course_id, lecturer_id, room, scheduled_start, scheduled_end, topic, notes }) {
  const { data, error } = await supabase
    .from('class_sessions')
    .insert([{ batch_course_id, lecturer_id, room: room || null, scheduled_start, scheduled_end, topic: topic || null, notes: notes || null }])
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ============================================================
// ATTENDANCE
// ============================================================

export async function getAttendanceForSession(sessionId) {
  const { data, error } = await supabase
    .from('attendance')
    .select(`*, students:student_id (id, matricule, first_name, middle_name, last_name)`)
    .eq('session_id', sessionId)
    .order('students(matricule)');
  if (error) throw error;
  return data || [];
}

export async function upsertAttendance({ session_id, student_id, status, marked_by, note }) {
  const { data, error } = await supabase
    .from('attendance')
    .upsert(
      [{ session_id, student_id, status, marked_at: new Date().toISOString(), marked_by: marked_by || null, note: note || null, updated_at: new Date().toISOString() }],
      { onConflict: 'session_id,student_id' }
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function markAllPresent(sessionId, studentIds, markedBy) {
  const rows = studentIds.map((sid) => ({
    session_id: sessionId,
    student_id: sid,
    status: 'present',
    marked_at: new Date().toISOString(),
    marked_by: markedBy || null,
    updated_at: new Date().toISOString(),
  }));
  const { data, error } = await supabase
    .from('attendance')
    .upsert(rows, { onConflict: 'session_id,student_id' })
    .select();
  if (error) throw error;
  return data || [];
}

export async function submitSessionAttendance({ sessionId, unmarkedStudentIds = [], profileId = null }) {
  const now = new Date().toISOString();

  // If there are any unmarked students, record them as absent
  if (unmarkedStudentIds.length > 0) {
    const absentRows = unmarkedStudentIds.map((sid) => ({
      session_id: sessionId,
      student_id: sid,
      status: 'absent',
      marked_at: now,
      marked_by: profileId,
      updated_at: now,
    }));
    const { error: attError } = await supabase
      .from('attendance')
      .upsert(absentRows, { onConflict: 'session_id,student_id' });
    if (attError) throw attError;
  }

  // Update session with actual_end to mark attendance finalized
  const { data: sessionData, error: sGetErr } = await supabase
    .from('class_sessions')
    .select('actual_start, scheduled_start')
    .eq('id', sessionId)
    .single();
  if (sGetErr) throw sGetErr;

  const actualStart = sessionData.actual_start || sessionData.scheduled_start || now;

  const { data, error } = await supabase
    .from('class_sessions')
    .update({
      actual_start: actualStart,
      actual_end: now,
    })
    .eq('id', sessionId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function calculateAttendanceScoresForBatchCourse(batchCourseId, attendanceMax = 5) {
  const { data: sessions, error: sessError } = await supabase
    .from('class_sessions')
    .select('id')
    .eq('batch_course_id', batchCourseId);
  if (sessError) throw sessError;

  const sessionIds = (sessions || []).map((s) => s.id);
  if (sessionIds.length === 0) return {};

  const { data: records, error: recError } = await supabase
    .from('attendance')
    .select('student_id, status, marked_at')
    .in('session_id', sessionIds);
  if (recError) throw recError;

  const studentStats = {};
  (records || []).forEach((r) => {
    if (!r.marked_at) return;
    if (!studentStats[r.student_id]) {
      studentStats[r.student_id] = { total: 0, attended: 0 };
    }
    studentStats[r.student_id].total++;
    if (r.status === 'present' || r.status === 'late') {
      studentStats[r.student_id].attended++;
    }
  });

  const scores = {};
  Object.keys(studentStats).forEach((studentId) => {
    const { total, attended } = studentStats[studentId];
    if (total === 0) {
      scores[studentId] = 0;
    } else {
      const calculated = (attended / total) * attendanceMax;
      scores[studentId] = Number(Math.min(attendanceMax, Math.max(0, calculated)).toFixed(1));
    }
  });

  return scores;
}

// ============================================================
// MY HOURS
// ============================================================

export async function getMyShifts(lecturerId, { limit = 50, dateFrom = null, dateTo = null } = {}) {
  let query = supabase
    .from('lecturer_shifts')
    .select('*')
    .eq('lecturer_id', lecturerId)
    .order('clock_in', { ascending: false })
    .limit(limit);
  if (dateFrom) query = query.gte('clock_in', dateFrom);
  if (dateTo) query = query.lte('clock_in', dateTo);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

// ============================================================
// NOTIFICATIONS
// ============================================================

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

export async function getLecturerResources(lecturerId) {
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
    .in('course_id', (await supabase.from('batch_courses').select('course_id').eq('lecturer_id', lecturerId)).data?.map((item) => item.course_id) || [])
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function getLecturerResourceDownload(filePath) {
  const { data, error } = await supabase.storage.from('resources').createSignedUrl(filePath, 60);
  if (error) throw error;
  if (!data?.signedUrl) {
    throw new Error('No signed URL returned for this resource.');
  }
  return { url: data.signedUrl, error: null };
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

// ============================================================
// DASHBOARD STATS
// ============================================================

export async function getLecturerDashboardStats(lecturerId, profileId) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

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

  const queryErrors = [coursesRes, todaySessionsRes, pendingMarksRes, returnedMarksRes, unreadNotifsRes, monthlyHoursRes]
    .map((result) => result.error)
    .filter(Boolean);
  if (queryErrors.length) throw queryErrors[0];

  const { data: openShiftData, error: openShiftError } = await supabase
    .from('lecturer_shifts')
    .select('id, clock_in, status')
    .eq('lecturer_id', lecturerId)
    .eq('status', 'open')
    .maybeSingle();
  if (openShiftError) throw openShiftError;

  const monthlyHours = (monthlyHoursRes.data || [])
    .reduce((sum, row) => sum + Number(row.hours_taught || 0), 0);

  return {
    totalCourses: coursesRes.count ?? 0,
    todaySessions: todaySessionsRes.count ?? 0,
    pendingMarksDraft: pendingMarksRes.count ?? 0,
    returnedMarks: returnedMarksRes.count ?? 0,
    unreadNotifications: unreadNotifsRes.count ?? 0,
    monthlyHours: Number(monthlyHours.toFixed(1)),
    currentShift: openShiftData || null,
  };
}

// ============================================================
// ATTENDANCE SUMMARY
// ============================================================

export async function getAttendanceSummaryForBatchCourse(batchCourseId) {
  const { data: sessions, error: sErr } = await supabase
    .from('class_sessions')
    .select('id')
    .eq('batch_course_id', batchCourseId);
  if (sErr) throw sErr;
  if (!sessions?.length) return { totalSessions: 0, summary: [] };
  const sessionIds = sessions.map((s) => s.id);
  const { data: records, error: aErr } = await supabase
    .from('attendance')
    .select(`student_id, status, students:student_id (matricule, first_name, last_name)`)
    .in('session_id', sessionIds);
  if (aErr) throw aErr;
  const byStudent = {};
  (records || []).forEach((r) => {
    if (!byStudent[r.student_id]) {
      byStudent[r.student_id] = { student_id: r.student_id, student: r.students, present: 0, absent: 0, late: 0, total: 0 };
    }
    byStudent[r.student_id].total++;
    if (r.status === 'present') byStudent[r.student_id].present++;
    else if (r.status === 'absent') byStudent[r.student_id].absent++;
    else if (r.status === 'late') byStudent[r.student_id].late++;
  });
  return { totalSessions: sessions.length, summary: Object.values(byStudent) };
}
