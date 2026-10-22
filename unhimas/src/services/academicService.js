import { supabase } from '../lib/supabase';

// ============================================================
// DEPARTMENTS
// ============================================================

export async function getDepartments() {
  const { data, error } = await supabase
    .from('departments')
    .select(`
      *,
      batches:batches(count),
      courses:courses(count),
      lecturers:lecturers(count)
    `)
    .order('name');
  if (error) throw error;
  return data || [];
}

export async function createDepartment({ name, abbreviation, description }) {
  const { data, error } = await supabase
    .from('departments')
    .insert([{ name, abbreviation, description }])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateDepartment(id, updates) {
  const { data, error } = await supabase
    .from('departments')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ============================================================
// ACADEMIC YEARS & SEMESTERS
// ============================================================

export async function getAcademicYears() {
  const { data, error } = await supabase
    .from('academic_years')
    .select(`
      *,
      semesters:semesters(*)
    `)
    .order('start_date', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function createAcademicYear({ name, start_date, end_date, is_current }) {
  if (is_current) {
    await supabase.from('academic_years').update({ is_current: false }).neq('id', '00000000-0000-0000-0000-000000000000');
  }
  const { data, error } = await supabase
    .from('academic_years')
    .insert([{ name, start_date, end_date, is_current: Boolean(is_current) }])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function setCurrentAcademicYear(id) {
  await supabase.from('academic_years').update({ is_current: false }).neq('id', id);
  const { data, error } = await supabase
    .from('academic_years')
    .update({ is_current: true })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getSemesters(academicYearId = null) {
  let query = supabase
    .from('semesters')
    .select(`
      *,
      academic_years:academic_year_id(id, name, is_current)
    `)
    .order('number');

  if (academicYearId) {
    query = query.eq('academic_year_id', academicYearId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function createSemester({ academic_year_id, name, number, start_date, end_date, is_current }) {
  if (is_current) {
    await supabase.from('semesters').update({ is_current: false }).neq('id', '00000000-0000-0000-0000-000000000000');
  }
  const { data, error } = await supabase
    .from('semesters')
    .insert([{ academic_year_id, name, number: Number(number), start_date, end_date, is_current: Boolean(is_current) }])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function setCurrentSemester(id) {
  await supabase.from('semesters').update({ is_current: false }).neq('id', id);
  const { data, error } = await supabase
    .from('semesters')
    .update({ is_current: true })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ============================================================
// BATCHES
// ============================================================

export async function getBatches(departmentId = null) {
  let query = supabase
    .from('batches')
    .select(`
      *,
      departments:department_id(id, name, abbreviation),
      academic_years:academic_year_id(id, name),
      students:students(count)
    `)
    .order('created_at', { ascending: false });

  if (departmentId) {
    query = query.eq('department_id', departmentId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function createBatch({ department_id, academic_year_id, name, level_name, batch_number }) {
  const { data, error } = await supabase
    .from('batches')
    .insert([{ department_id, academic_year_id, name, level_name, batch_number }])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateBatch(id, updates) {
  const { data, error } = await supabase
    .from('batches')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ============================================================
// COURSES
// ============================================================

export async function getCourses(departmentId = null) {
  let query = supabase
    .from('courses')
    .select(`
      *,
      departments:department_id(id, name, abbreviation)
    `)
    .order('code');

  if (departmentId) {
    query = query.eq('department_id', departmentId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function createCourse({ department_id, code, name, credit_units }) {
  const { data, error } = await supabase
    .from('courses')
    .insert([{ department_id, code: code.toUpperCase().trim(), name, credit_units: Number(credit_units) || 3 }])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateCourse(id, updates) {
  if (updates.code) updates.code = updates.code.toUpperCase().trim();
  const { data, error } = await supabase
    .from('courses')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ============================================================
// BATCH COURSES (Course Allocations)
// ============================================================

export async function getBatchCourses({ batchId = null, semesterId = null } = {}) {
  let query = supabase
    .from('batch_courses')
    .select(`
      *,
      batches:batch_id(id, name, code, department_id, departments(name, abbreviation)),
      courses:course_id(id, code, name, credit_units),
      semesters:semester_id(id, name, number, academic_years(name)),
      lecturers:lecturer_id(id, staff_id, first_name, last_name)
    `)
    .order('created_at', { ascending: false });

  if (batchId) query = query.eq('batch_id', batchId);
  if (semesterId) query = query.eq('semester_id', semesterId);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function assignBatchCourse({ batch_id, course_id, semester_id, lecturer_id, is_compulsory = true }) {
  const { data, error } = await supabase
    .from('batch_courses')
    .insert([{ batch_id, course_id, semester_id, lecturer_id: lecturer_id || null, is_compulsory }])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteBatchCourse(id) {
  const { error } = await supabase
    .from('batch_courses')
    .delete()
    .eq('id', id);
  if (error) throw error;
  return true;
}

// ============================================================
// CLASS SESSIONS
// ============================================================

export async function getClassSessions({ limit = 200, from = null, to = null, batchCourseId = null } = {}) {
  let query = supabase
    .from('class_sessions')
    .select(`
      *,
      batch_courses (
        id,
        batch_id,
        courses (id, code, name, credit_units),
        batches (id, name, code),
        semesters (id, name, number),
        lecturers:lecturer_id (id, first_name, last_name, staff_id)
      ),
      lecturers (id, first_name, last_name, staff_id)
    `)
    .order('scheduled_start', { ascending: false })
    .limit(limit);

  if (from) query = query.gte('scheduled_start', from);
  if (to) query = query.lte('scheduled_start', to);
  if (batchCourseId) query = query.eq('batch_course_id', batchCourseId);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function createClassSessionAdmin(payload) {
  const row = {
    batch_course_id: payload.batch_course_id,
    lecturer_id: payload.lecturer_id,
    scheduled_start: new Date(payload.scheduled_start).toISOString(),
    scheduled_end: new Date(payload.scheduled_end).toISOString(),
    room: payload.room?.trim() || null,
    topic: payload.topic?.trim() || null,
    notes: payload.notes?.trim() || null,
  };
  if (!(new Date(row.scheduled_end) > new Date(row.scheduled_start))) {
    throw new Error('End time must be after start time.');
  }
  const { data, error } = await supabase.from('class_sessions').insert([row]).select().single();
  if (error) throw error;
  return data;
}

export async function updateClassSessionAdmin(id, payload) {
  const row = {};
  if (payload.batch_course_id) row.batch_course_id = payload.batch_course_id;
  if (payload.lecturer_id) row.lecturer_id = payload.lecturer_id;
  if (payload.scheduled_start) row.scheduled_start = new Date(payload.scheduled_start).toISOString();
  if (payload.scheduled_end) row.scheduled_end = new Date(payload.scheduled_end).toISOString();
  if (payload.room !== undefined) row.room = payload.room?.trim() || null;
  if (payload.topic !== undefined) row.topic = payload.topic?.trim() || null;
  if (payload.notes !== undefined) row.notes = payload.notes?.trim() || null;
  if (row.scheduled_start && row.scheduled_end && !(new Date(row.scheduled_end) > new Date(row.scheduled_start))) {
    throw new Error('End time must be after start time.');
  }
  const { data, error } = await supabase.from('class_sessions').update(row).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteClassSessionAdmin(id) {
  const { error } = await supabase.from('class_sessions').delete().eq('id', id);
  if (error) throw error;
  return true;
}

// ============================================================
// TIMETABLE → CLASS SESSION GENERATION
// ============================================================

/**
 * Generate concrete class_sessions from timetable_slots for a date range.
 * Skips slots that already have a session on the same day (within 5 minutes).
 * Requires migration 20261022000000 (RPC generate_sessions_from_timetable).
 * @param {{ from: string, to: string, batchCourseId?: string|null }} opts
 *   from/to as YYYY-MM-DD
 * @returns {Promise<number>} number of sessions created
 */
export async function generateSessionsFromTimetable({ from, to, batchCourseId = null }) {
  if (!from || !to) throw new Error('Start and end dates are required.');
  if (to < from) throw new Error('End date must be on or after the start date.');
  const { data, error } = await supabase.rpc('generate_sessions_from_timetable', {
    p_from: from,
    p_to: to,
    p_batch_course_id: batchCourseId || null,
  });
  if (error) throw error;
  return data ?? 0;
}
