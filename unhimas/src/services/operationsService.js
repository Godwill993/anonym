import { supabase } from '../lib/supabase';

// ============================================================
// MARK SUBMISSIONS & APPROVAL WORKFLOW
// ============================================================

export async function getMarkSubmissions({ status = null } = {}) {
  let query = supabase
    .from('mark_submissions')
    .select(`
      *,
      batch_courses (
        id,
        is_compulsory,
        courses (
          id,
          code,
          name,
          credit_units
        ),
        batches (
          id,
          name,
          code,
          departments (
            name,
            abbreviation
          )
        ),
        semesters (
          id,
          name,
          number,
          academic_years (
            name
          )
        )
      ),
      lecturers (
        id,
        staff_id,
        first_name,
        last_name
      )
    `)
    .order('updated_at', { ascending: false });

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function getSubmissionDetail(id) {
  const { data: submission, error: subError } = await supabase
    .from('mark_submissions')
    .select(`
      *,
      batch_courses (
        id,
        courses (
          code,
          name,
          credit_units
        ),
        batches (
          id,
          name,
          code
        ),
        semesters (
          id,
          name,
          number,
          academic_years (
            name
          )
        )
      ),
      lecturers (
        first_name,
        last_name,
        staff_id
      )
    `)
    .eq('id', id)
    .single();

  if (subError) throw subError;

  const { data: marks, error: marksError } = await supabase
    .from('marks')
    .select(`
      *,
      students (
        id,
        matricule,
        first_name,
        last_name
      )
    `)
    .eq('mark_submission_id', id)
    .order('students(matricule)');

  if (marksError) throw marksError;

  return {
    ...submission,
    marks: marks || [],
  };
}

/**
 * Approve or return a marksheet only.
 * Publishing is batch-level — use publishBatchResults(), not this function.
 */
export async function reviewSubmission(id, { status, admin_comment = '' }) {
  if (status === 'published') {
    throw new Error(
      'Results are published by batch, not by single course. Use “Publish batch results” (or Force publish) on Mark Approval.',
    );
  }

  const allowed = ['approved', 'returned', 'submitted'];
  if (!allowed.includes(status)) {
    throw new Error(`Invalid review status: ${status}`);
  }

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) throw new Error('Your session has expired. Please sign in again.');

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', authData.user.id)
    .single();
  if (profileError || !profile) throw new Error('Your administrator profile could not be verified.');

  const updates = {
    status,
    admin_comment,
    reviewed_at: new Date().toISOString(),
    reviewed_by: profile.id,
  };

  const { data, error } = await supabase
    .from('mark_submissions')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Readiness of every course in a batch + semester.
 * A course is ready when its mark submission is approved or already published.
 */
export async function getBatchResultsReadiness(batchId, semesterId) {
  const { data, error } = await supabase.rpc('get_batch_results_readiness', {
    p_batch_id: batchId,
    p_semester_id: semesterId,
  });
  if (error) throw error;
  return data || [];
}

/** Overview rows for all batch + semester combinations that have courses. */
export async function listBatchSemesterReadiness() {
  const { data, error } = await supabase.rpc('list_batch_semester_readiness');
  if (error) throw error;
  return data || [];
}

/**
 * Publish approved mark submissions for a batch + semester.
 * - force=false (default): every course must be approved or already published.
 * - force=true: publish only courses that are approved; incomplete ones stay out of student results.
 */
export async function publishBatchResults(batchId, semesterId, { force = false } = {}) {
  const { data, error } = await supabase.rpc('publish_batch_results', {
    p_batch_id: batchId,
    p_semester_id: semesterId,
    p_force: Boolean(force),
  });
  if (error) throw error;
  return data;
}

// ============================================================
// SETTINGS
// ============================================================

export async function getSystemSettings() {
  const { data, error } = await supabase
    .from('settings')
    .select('*')
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data || {
    school_name: 'UNHIMAS',
    school_abbreviation: 'UNH',
    attendance_max: 5,
    coursework_max: 25,
    exam_max: 70,
    attendance_threshold: 75,
    timezone: 'Africa/Douala',
  };
}

export async function updateSystemSettings(settingsId, updates) {
  if (settingsId) {
    const { data, error } = await supabase
      .from('settings')
      .update(updates)
      .eq('id', settingsId)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
  const { data, error } = await supabase
    .from('settings')
    .insert([updates])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getGradingScale() {
  const { data, error } = await supabase
    .from('grading_scale')
    .select('*')
    .order('min_score', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function getAuditLogs({ limit = 50, action = null, tableName = null } = {}) {
  let query = supabase
    .from('audit_log')
    .select(`
      *,
      profiles:actor_id (
        full_name,
        login_id,
        role
      )
    `)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (action) query = query.eq('action', action);
  if (tableName) query = query.eq('table_name', tableName);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}
