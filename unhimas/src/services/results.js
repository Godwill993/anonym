import { supabase } from '../lib/supabase';

export async function lookupPublishedResults(matricule) {
  const normalized = matricule.trim().toUpperCase();
  if (!normalized) throw new Error('Enter a student matricule.');

  const { data, error } = await supabase.rpc('public_result_lookup', { p_matricule: normalized });
  if (error) throw error;
  return data || [];
}

export async function getPublishedResults(limit = 100) {
  const { data, error } = await supabase
    .from('results')
    .select('*')
    .order('academic_year', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

/**
 * Published results for the signed-in student.
 * Uses profile_id on the results view (added in schema improvements migration).
 * Falls back to resolving student_id if the view has not been migrated yet.
 */
export async function getMyResults() {
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) throw new Error('Authentication is required.');

  // Prefer profile_id filter (post-migration results view)
  let { data, error } = await supabase
    .from('results')
    .select('*')
    .eq('profile_id', authData.user.id)
    .order('academic_year', { ascending: false });

  if (error && /profile_id|column/i.test(error.message || '')) {
    // Pre-migration fallback: resolve student then filter by student_id
    const { data: student, error: stuErr } = await supabase
      .from('students')
      .select('id')
      .eq('profile_id', authData.user.id)
      .maybeSingle();
    if (stuErr) throw stuErr;
    if (!student) return [];

    const res = await supabase
      .from('results')
      .select('*')
      .eq('student_id', student.id)
      .order('academic_year', { ascending: false });
    if (res.error) throw res.error;
    return res.data || [];
  }

  if (error) throw error;
  return data || [];
}
