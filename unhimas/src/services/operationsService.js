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
          name,
          code
        ),
        semesters (
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

export async function reviewSubmission(id, { status, admin_comment = '' }) {
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

  if (status === 'published') {
    updates.published_at = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from('mark_submissions')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

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
  } else {
    const { data, error } = await supabase
      .from('settings')
      .insert([updates])
      .select()
      .single();
    if (error) throw error;
    return data;
  }
}

// ============================================================
// GRADING SCALE
// ============================================================

export async function getGradingScale() {
  const { data, error } = await supabase
    .from('grading_scale')
    .select('*')
    .order('min_score', { ascending: false });

  if (error) throw error;
  return data || [];
}

// ============================================================
// AUDIT LOG
// ============================================================

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
