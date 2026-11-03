import { supabase } from '../lib/supabase';

// ============================================================
// PROGRAMMES (HND / B.Tech / M.Tech / B.Sc / M.Sc)
// ============================================================

export async function getProgrammes({ activeOnly = false } = {}) {
  let query = supabase
    .from('programmes')
    .select('*')
    .order('sort_order')
    .order('name');
  if (activeOnly) query = query.eq('is_active', true);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function getProgramme(id) {
  const { data, error } = await supabase
    .from('programmes')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

export async function createProgramme(payload) {
  const row = {
    code: String(payload.code || '').toUpperCase().trim(),
    name: String(payload.name || '').trim(),
    award: payload.award || null,
    track: payload.track || 'professional',
    duration_years: Number(payload.duration_years) || 1,
    sort_order: payload.sort_order != null ? Number(payload.sort_order) : 0,
    is_active: payload.is_active !== false,
  };
  const { data, error } = await supabase.from('programmes').insert([row]).select().single();
  if (error) throw error;
  return data;
}

export async function updateProgramme(id, updates) {
  if (updates.code) updates.code = String(updates.code).toUpperCase().trim();
  const { data, error } = await supabase.from('programmes').update(updates).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function getProgrammeProgressions() {
  const { data, error } = await supabase
    .from('programme_progressions')
    .select(`
      *,
      from_programme:from_programme_id(id, code, name, award, track, duration_years),
      to_programme:to_programme_id(id, code, name, award, track, duration_years)
    `)
    .order('sort_order');
  if (error) throw error;
  return data || [];
}

export async function getEffectiveProgrammeDuration(programmeId, departmentId = null) {
  const { data, error } = await supabase.rpc('get_effective_programme_duration', {
    p_programme_id: programmeId,
    p_department_id: departmentId,
  });
  if (error) throw error;
  return data;
}

export async function getEffectiveHndDuration(departmentId) {
  const { data, error } = await supabase.rpc('get_effective_hnd_duration', {
    p_department_id: departmentId,
  });
  if (error) throw error;
  return data;
}

// ============================================================
// DEPARTMENTS
// ============================================================

export async function getDepartments() {
  const { data, error } = await supabase
    .from('departments')
    .select('*')
    .order('name');
  if (error) throw error;
  return data || [];
}

export async function createDepartment({ name, abbreviation, description }) {
  const { data, error } = await supabase
    .from('departments')
    .insert([{ name: name.trim(), abbreviation: abbreviation?.trim() || null, description: description?.trim() || null }])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateDepartment(id, updates) {
  const { data, error } = await supabase.from('departments').update(updates).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

// ============================================================
// ACADEMIC YEARS & SEMESTERS
// ============================================================

export async function getAcademicYears() {
  const { data, error } = await supabase.from('academic_years').select('*').order('start_date', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function createAcademicYear({ name, start_date, end_date, is_current }) {
  const { data, error } = await supabase
    .from('academic_years')
    .insert([{ name, start_date, end_date, is_current: !!is_current }])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function setCurrentAcademicYear(id) {
  await supabase.from('academic_years').update({ is_current: false }).neq('id', id);
  const { data, error } = await supabase.from('academic_years').update({ is_current: true }).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function getSemesters(academicYearId = null) {
  let query = supabase
    .from('semesters')
    .select('*, academic_years:academic_year_id(id, name, is_current)')
    .order('number');
  if (academicYearId) query = query.eq('academic_year_id', academicYearId);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function createSemester({ academic_year_id, name, number, start_date, end_date, is_current }) {
  const { data, error } = await supabase
    .from('semesters')
    .insert([{ academic_year_id, name, number, start_date, end_date, is_current: !!is_current }])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function setCurrentSemester(id) {
  await supabase.from('semesters').update({ is_current: false }).neq('id', id);
  const { data, error } = await supabase.from('semesters').update({ is_current: true }).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

// ============================================================
// BATCHES (programme_id + year_of_study required for Cameroon model)
// ============================================================

export async function getBatches(departmentId = null) {
  let query = supabase
    .from('batches')
    .select(`
      *,
      programmes:programme_id(id, code, name, award, track, duration_years),
      departments:department_id(id, name, abbreviation),
      academic_years:academic_year_id(id, name, is_current)
    `)
    .order('name');
  if (departmentId) query = query.eq('department_id', departmentId);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function createBatch({
  department_id,
  academic_year_id,
  programme_id,
  year_of_study,
  name,
  level_name,
  batch_number,
  code,
}) {
  const row = {
    department_id,
    academic_year_id,
    programme_id: programme_id || null,
    year_of_study: year_of_study != null ? Number(year_of_study) : null,
    name: name.trim(),
    level_name: level_name?.trim() || null,
    batch_number: batch_number != null ? Number(batch_number) : 1,
    code: code?.trim() || null,
  };
  const { data, error } = await supabase.from('batches').insert([row]).select().single();
  if (error) throw error;
  return data;
}

export async function updateBatch(id, updates) {
  if (updates.year_of_study != null) updates.year_of_study = Number(updates.year_of_study);
  const { data, error } = await supabase.from('batches').update(updates).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

// ============================================================
// COURSES & BATCH COURSES
// ============================================================

export async function getCourses(departmentId = null) {
  let query = supabase.from('courses').select('*, departments:department_id(id, name, abbreviation)').order('code');
  if (departmentId) query = query.eq('department_id', departmentId);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function createCourse({ department_id, code, name, credit_units }) {
  const { data, error } = await supabase
    .from('courses')
    .insert([{ department_id, code: code.toUpperCase().trim(), name: name.trim(), credit_units: Number(credit_units) || 1 }])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateCourse(id, updates) {
  if (updates.code) updates.code = updates.code.toUpperCase().trim();
  const { data, error } = await supabase.from('courses').update(updates).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function getBatchCourses({ batchId = null, semesterId = null, lecturerId = null } = {}) {
  let query = supabase
    .from('batch_courses')
    .select(`
      *,
      courses:course_id(id, code, name, credit_units),
      batches:batch_id(id, name, code),
      semesters:semester_id(id, name, number),
      lecturers:lecturer_id(id, first_name, last_name, staff_id)
    `)
    .order('created_at', { ascending: false });
  if (batchId) query = query.eq('batch_id', batchId);
  if (semesterId) query = query.eq('semester_id', semesterId);
  if (lecturerId) query = query.eq('lecturer_id', lecturerId);
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

export async function updateBatchCourse(id, updates) {
  const { data, error } = await supabase.from('batch_courses').update(updates).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteBatchCourse(id) {
  const { error } = await supabase.from('batch_courses').delete().eq('id', id);
  if (error) throw error;
  return true;
}

// ============================================================
// CLASS SESSIONS (admin)
// ============================================================

export async function getClassSessions({ limit = 200, from = null, to = null, batchCourseId = null } = {}) {
  let query = supabase
    .from('class_sessions')
    .select(`*, batch_courses:batch_course_id(id, courses:course_id(code, name), batches:batch_id(name, code))`)
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
  const { data, error } = await supabase.from('class_sessions').insert([payload]).select().single();
  if (error) throw error;
  return data;
}

export async function updateClassSessionAdmin(id, payload) {
  const { data, error } = await supabase.from('class_sessions').update(payload).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteClassSessionAdmin(id) {
  const { error } = await supabase.from('class_sessions').delete().eq('id', id);
  if (error) throw error;
  return true;
}

export async function generateSessionsFromTimetable({ from, to, batchCourseId = null }) {
  const { data, error } = await supabase.rpc('generate_sessions_from_timetable', {
    p_from: from,
    p_to: to,
    p_batch_course_id: batchCourseId,
  });
  if (error) throw error;
  return data;
}

// ============================================================
// PROGRAMME COMPLETION
// ============================================================

export async function getBatchProgrammeInfo(batchId) {
  const { data, error } = await supabase.rpc('get_batch_programme_info', { p_batch_id: batchId });
  if (error) throw error;
  return data;
}

export async function markStudentProgrammeCompleted(studentId, result = 'pass', notes = null) {
  const { data, error } = await supabase.rpc('mark_student_programme_completed', {
    p_student_id: studentId,
    p_result: result,
    p_notes: notes,
  });
  if (error) throw error;
  return data;
}

export async function markBatchProgrammeCompleted(batchId, result = 'pass', notes = null) {
  const { data, error } = await supabase.rpc('mark_batch_programme_completed', {
    p_batch_id: batchId,
    p_result: result,
    p_notes: notes,
  });
  if (error) throw error;
  return data;
}

export async function getStudentProgrammeCompletions(studentId = null) {
  let query = supabase
    .from('student_programme_completions')
    .select(`
      *,
      programmes:programme_id(id, code, name, award),
      students:student_id(id, matricule, first_name, last_name)
    `)
    .order('completed_at', { ascending: false });
  if (studentId) query = query.eq('student_id', studentId);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}
