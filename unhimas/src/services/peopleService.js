import { supabase } from '../lib/supabase';

// ============================================================
// STUDENTS
// ============================================================

export async function getStudents({ batchId = null, departmentId = null, search = '' } = {}) {
  let query = supabase
    .from('students')
    .select(`
      *,
      programme_status,
      programme_completed_at,
      programme_completion_result,
      programmes:programme_id(id, code, name, award, track, duration_years),
      batches:batch_id(
        id,
        name,
        code,
        year_of_study,
        programme_id,
        programmes:programme_id(id, code, name, award, duration_years),
        departments:department_id(
          id,
          name,
          abbreviation
        )
      )
    `)
    .order('matricule');

  if (batchId) {
    query = query.eq('batch_id', batchId);
  }

  if (search && search.trim()) {
    const s = `%${search.trim()}%`;
    query = query.or(`matricule.ilike.${s},first_name.ilike.${s},last_name.ilike.${s},email.ilike.${s}`);
  }

  const { data, error } = await query;
  if (error) throw error;

  if (departmentId) {
    return (data || []).filter((stu) => stu.batches?.departments?.id === departmentId);
  }

  return data || [];
}

export async function createStudent({
  matricule,
  first_name,
  middle_name,
  last_name,
  email,
  phone,
  batch_id,
  programme_id,
  admission_date,
}) {
  // If programme not given, inherit from the batch (Cameroon model: cohort belongs to a programme)
  let resolvedProgrammeId = programme_id || null;
  if (!resolvedProgrammeId && batch_id) {
    const { data: batchRow } = await supabase
      .from('batches')
      .select('programme_id')
      .eq('id', batch_id)
      .maybeSingle();
    resolvedProgrammeId = batchRow?.programme_id || null;
  }

  const { data, error } = await supabase
    .from('students')
    .insert([
      {
        matricule: matricule.toUpperCase().trim(),
        first_name: first_name.trim(),
        middle_name: middle_name?.trim() || null,
        last_name: last_name.trim(),
        email: email?.trim() || null,
        phone: phone?.trim() || null,
        batch_id: batch_id || null,
        programme_id: resolvedProgrammeId,
        admission_date: admission_date || new Date().toISOString().split('T')[0],
      },
    ])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateStudent(id, updates) {
  if (updates.matricule) updates.matricule = updates.matricule.toUpperCase().trim();
  const { data, error } = await supabase
    .from('students')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteSchoolAccount({ recordType, recordId }) {
  const { error } = await supabase.rpc('delete_school_account', {
    p_record_type: recordType,
    p_record_id: recordId,
  });
  if (error) throw error;
}

// ============================================================
// LECTURERS
// ============================================================

export async function getLecturers({ departmentId = null, search = '' } = {}) {
  let query = supabase
    .from('lecturers')
    .select(`
      *,
      departments:department_id(
        id,
        name,
        abbreviation
      )
    `)
    .order('staff_id');

  if (departmentId) {
    query = query.eq('department_id', departmentId);
  }

  if (search && search.trim()) {
    const s = `%${search.trim()}%`;
    query = query.or(`staff_id.ilike.${s},first_name.ilike.${s},last_name.ilike.${s},email.ilike.${s}`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function createLecturer({
  staff_id,
  first_name,
  middle_name,
  last_name,
  email,
  phone,
  department_id,
  specialization,
}) {
  const { data, error } = await supabase
    .from('lecturers')
    .insert([
      {
        staff_id: staff_id.toUpperCase().trim(),
        first_name: first_name.trim(),
        middle_name: middle_name?.trim() || null,
        last_name: last_name.trim(),
        email: email?.trim() || null,
        phone: phone?.trim() || null,
        department_id: department_id || null,
        specialization: specialization?.trim() || null,
      },
    ])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateLecturer(id, updates) {
  if (updates.staff_id) updates.staff_id = updates.staff_id.toUpperCase().trim();
  const { data, error } = await supabase
    .from('lecturers')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ============================================================
// STAFF / PROFILES
// ============================================================

export async function getStaffProfiles({ role = null, search = '' } = {}) {
  let query = supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false });

  if (role) {
    query = query.eq('role', role);
  }

  if (search && search.trim()) {
    const s = `%${search.trim()}%`;
    query = query.or(`full_name.ilike.${s},login_id.ilike.${s}`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function toggleProfileStatus(id, is_active) {
  const { data, error } = await supabase
    .from('profiles')
    .update({ is_active })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ============================================================
// STUDENT TRANSFERS (uses public.student_transfers + RPC)
// ============================================================

export async function transferStudent({ studentId, toBatchId, reason = null }) {
  const { data, error } = await supabase.rpc('transfer_student', {
    p_student_id: studentId,
    p_to_batch_id: toBatchId,
    p_reason: reason,
  });
  if (error) throw error;
  return data;
}

export async function getStudentTransfers(studentId) {
  let query = supabase
    .from('student_transfers')
    .select(`
      *,
      students:student_id (id, matricule, first_name, last_name),
      from_batch:from_batch_id (id, name, code),
      to_batch:to_batch_id (id, name, code),
      transferred_by_profile:transferred_by (full_name, login_id)
    `)
    .order('transferred_at', { ascending: false });

  if (studentId) query = query.eq('student_id', studentId);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

/** Soft-archive: deactivates student + profile; keeps marks/transcripts. */
export async function archiveStudent(studentId) {
  const { error } = await supabase.rpc('archive_student', {
    p_student_id: studentId,
  });
  if (error) throw error;
}

/** True when the student has any mark rows (blocks hard delete). */
export async function studentHasMarks(studentId) {
  const { data, error } = await supabase.rpc('student_has_marks', {
    p_student_id: studentId,
  });
  if (error) throw error;
  return Boolean(data);
}
