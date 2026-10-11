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

export async function getMyResults() {
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) throw new Error('Authentication is required.');

  const { data, error } = await supabase
    .from('results')
    .select('*')
    .eq('profile_id', authData.user.id)
    .order('academic_year', { ascending: false });

  if (error) throw error;
  return data || [];
}
