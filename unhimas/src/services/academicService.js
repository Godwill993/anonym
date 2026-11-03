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

/**
 * Validate batch fields for Cameroon model.
 * programme_id and year_of_study are required so students inherit a programme.
 * @throws {Error} with a plain-language message
 */
export function assertBatchIntegrity({
  programme_id,
  year_of_study,
  name,
  department_id,
  academic_year_id,
  programme = null,
}) {
  if (!name || !String(name).trim()) {
    throw new Error('Batch name is required.');
  }
  if (!department_id) {
    throw new Error('Department is required.');
  }
  if (!academic_year_id) {
    throw new Error('School year (academic year) is required.');
  }
  if (!programme_id) {
    throw new Error('Programme is required (HND, B.Tech, or M.Tech). Set it on the batch so students inherit it.');
  }
  const year = Number(year_of_study);
  if (!Number.isFinite(year) || year < 1) {
    throw new Error('Year of study is required and must be at least 1.');
  }
  const maxYears = programme?.duration_years != null ? Number(programme.duration_years) : null;
  if (maxYears != null && Number.isFinite(maxYears) && year > maxYears) {
    const code = programme.code || 'this programme';
    throw new Error(`Year of study cannot exceed ${maxYears} for ${code}.`);
  }
  return year;
}

/** Build a short batch code when the admin leaves code empty. */
export function buildBatchCode({
  code,
  departmentAbbr,
  programmeCode,
  year_of_study,
  name,
  batch_number,
}) {
  const explicit = code != null ? String(code).trim() : '';
  if (explicit) return explicit.toUpperCase().slice(0, 32);
  const parts = [
    departmentAbbr || null,
    programmeCode || null,
    year_of_study != null ? `Y${year_of_study}` : null,
    batch_number != null ? `B${batch_number}` : null,
  ].filter(Boolean);
  if (parts.length >= 2) return parts.join('-').toUpperCase().slice(0, 32);
  const fromName = String(name || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 24);
  return fromName || `BATCH-${Date.now().toString(36).toUpperCase()}`;
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
  departmentAbbr,
  programmeCode,
  programme,
}) {
  let resolvedProgramme = programme || null;
  if (!resolvedProgramme && programme_id) {
    try {
      resolvedProgramme = await getProgramme(programme_id);
    } catch {
      resolvedProgramme = null;
    }
  }
  const year = assertBatchIntegrity({
    programme_id,
    year_of_study,
    name,
    department_id,
    academic_year_id,
    programme: resolvedProgramme,
  });

  const progCode = programmeCode || resolvedProgramme?.code || null;
  let deptAbbr = departmentAbbr || null;
  if (!deptAbbr && department_id) {
    try {
      const { data: dept } = await supabase
        .from('departments')
        .select('abbreviation')
        .eq('id', department_id)
        .maybeSingle();
      deptAbbr = dept?.abbreviation || null;
    } catch {
      /* ignore */
    }
  }

  const row = {
    department_id,
    academic_year_id,
    programme_id,
    year_of_study: year,
    name: name.trim(),
    level_name: level_name?.trim() || null,
    batch_number: batch_number != null ? Number(batch_number) : 1,
    code: buildBatchCode({
      code,
      departmentAbbr: deptAbbr,
      programmeCode: progCode,
      year_of_study: year,
      name,
      batch_number: batch_number != null ? Number(batch_number) : 1,
    }),
  };
  const { data, error } = await supabase.from('batches').insert([row]).select().single();
  if (error) throw error;
  return data;
}

export async function updateBatch(id, updates) {
  const next = { ...updates };
  if (next.year_of_study != null) next.year_of_study = Number(next.year_of_study);

  const touchesStructure =
    next.programme_id !== undefined ||
    next.year_of_study !== undefined ||
    next.name !== undefined ||
    next.department_id !== undefined ||
    next.academic_year_id !== undefined;

  if (touchesStructure) {
    const { data: existing, error: loadErr } = await supabase
      .from('batches')
      .select('name, department_id, academic_year_id, programme_id, year_of_study')
      .eq('id', id)
      .single();
    if (loadErr) throw loadErr;

    const merged = {
      name: next.name !== undefined ? next.name : existing.name,
      department_id: next.department_id !== undefined ? next.department_id : existing.department_id,
      academic_year_id: next.academic_year_id !== undefined ? next.academic_year_id : existing.academic_year_id,
      programme_id: next.programme_id !== undefined ? next.programme_id : existing.programme_id,
      year_of_study: next.year_of_study !== undefined ? next.year_of_study : existing.year_of_study,
    };

    let programme = null;
    if (merged.programme_id) {
      try {
        programme = await getProgramme(merged.programme_id);
      } catch {
        programme = null;
      }
    }
    const year = assertBatchIntegrity({ ...merged, programme });
    next.year_of_study = year;
    if (next.programme_id !== undefined) next.programme_id = merged.programme_id;
  }

  if (next.code !== undefined) {
    const trimmed = next.code != null ? String(next.code).trim() : '';
    next.code = trimmed ? trimmed.toUpperCase().slice(0, 32) : next.code;
  }

  delete next.departmentAbbr;
  delete next.programmeCode;
  delete next.programme;

  const { data, error } = await supabase.from('batches').update(next).eq('id', id).select().single();
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
// Requires migration: unhimas/supabase/migrations/20261103000000_programme_completion.sql
// (is_final_year_batch, get_batch_programme_info, mark_*_programme_completed).
// Apply that migration on Supabase before relying on these RPCs in production.
// ============================================================

/**
 * Local mirror of is_final_year_batch when only duration_years is known.
 * Prefer isFinalYearBatch() / getBatchProgrammeInfo() so Biomedical HND (3 yrs)
 * and other effective durations match the database.
 */
export function computeIsFinalYear({ year_of_study, duration_years } = {}) {
  const year = Number(year_of_study);
  const dur = Number(duration_years);
  if (!Number.isFinite(year) || year < 1) return false;
  if (!Number.isFinite(dur) || dur <= 0) return false;
  return year >= Math.ceil(dur);
}

/** RPC: true when batch year_of_study is the final year (uses effective duration). */
export async function isFinalYearBatch(batchId) {
  if (!batchId) return false;
  const { data, error } = await supabase.rpc('is_final_year_batch', { p_batch_id: batchId });
  if (error) throw error;
  return Boolean(data);
}

/**
 * RPC: programme + year + is_final_year for one batch.
 * Returns a single object (first row) or null.
 */
export async function getBatchProgrammeInfo(batchId) {
  const { data, error } = await supabase.rpc('get_batch_programme_info', { p_batch_id: batchId });
  if (error) throw error;
  if (Array.isArray(data)) return data[0] || null;
  return data || null;
}

/**
 * Resolve final-year for UI: try server RPC, fall back to local duration.
 * Does not throw when the migration is missing — returns { isFinalYear, source }.
 */
export async function resolveBatchFinalYear(batch) {
  if (!batch?.id) {
    return { isFinalYear: false, source: 'none', info: null };
  }
  try {
    const info = await getBatchProgrammeInfo(batch.id);
    if (info && typeof info.is_final_year === 'boolean') {
      return { isFinalYear: info.is_final_year, source: 'rpc', info };
    }
  } catch (err) {
    console.debug(
      'get_batch_programme_info unavailable; using local final-year check:',
      err?.message || err,
    );
  }
  const duration = batch.programmes?.duration_years ?? batch.duration_years ?? null;
  return {
    isFinalYear: computeIsFinalYear({
      year_of_study: batch.year_of_study,
      duration_years: duration,
    }),
    source: 'local',
    info: null,
  };
}

export async function markStudentProgrammeCompleted(studentId, result = 'pass', notes = null) {
  // Requires migration 20261103000000_programme_completion.sql on Supabase.
  const { data, error } = await supabase.rpc('mark_student_programme_completed', {
    p_student_id: studentId,
    p_result: result,
    p_notes: notes,
  });
  if (error) throw error;
  return data;
}

export async function markBatchProgrammeCompleted(batchId, result = 'pass', notes = null) {
  // Server enforces is_final_year_batch; UI should hide the action when not final year.
  // Requires migration 20261103000000_programme_completion.sql on Supabase.
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
