import { supabase } from '../lib/supabase';
import { notifyApplicationSubmitted, notifyAdmissionDecision } from './notificationService';
import {
  isHoneypotTriggered,
  sanitizeAdmissionPayload,
  validateAdmissionPayload,
} from '../lib/publicFormGuard';

export const ADMISSION_STATUSES = [
  'submitted',
  'under_review',
  'accepted',
  'rejected',
  'waitlisted',
  'withdrawn',
];

export async function listApplications({ status, limit = 100 } = {}) {
  let q = supabase
    .from('admission_applications')
    .select(`
      *,
      departments ( id, name, abbreviation ),
      academic_years ( id, name )
    `)
    .order('submitted_at', { ascending: false })
    .limit(limit);
  if (status) q = q.eq('status', status);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function getApplication(id) {
  const { data, error } = await supabase
    .from('admission_applications')
    .select(`
      *,
      departments ( id, name, abbreviation ),
      academic_years ( id, name )
    `)
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

/** Public status check — number + email via security definer RPC */
export async function lookupApplication(applicationNumber, email) {
  const { data, error } = await supabase.rpc('lookup_admission_application', {
    p_number: applicationNumber,
    p_email: email,
  });
  if (error) throw error;
  if (Array.isArray(data)) return data[0] || null;
  return data || null;
}

/** Public / unauthenticated submit */
export async function submitApplication(payload) {
  // Silent success for bots — do not reveal detection
  if (isHoneypotTriggered(payload)) {
    return { application_number: 'APP-SPAM', status: 'submitted', _spam: true };
  }

  const validation = validateAdmissionPayload(payload);
  if (!validation.ok) {
    throw new Error(validation.message);
  }

  const clean = sanitizeAdmissionPayload(payload);

  let applicationNumber;
  try {
    const { data } = await supabase.rpc('generate_application_number');
    applicationNumber = data;
  } catch {
    applicationNumber = `APP-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`;
  }

  const row = {
    application_number: applicationNumber,
    status: 'submitted',
    ...clean,
  };

  const { data, error } = await supabase
    .from('admission_applications')
    .insert(row)
    .select()
    .single();
  if (error) throw error;

  void notifyApplicationSubmitted(data);
  return data;
}

export async function updateApplicationStatus(id, { status, adminNotes, reviewedBy }) {
  const { data, error } = await supabase
    .from('admission_applications')
    .update({
      status,
      admin_notes: adminNotes ?? undefined,
      reviewed_by: reviewedBy || null,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  void notifyAdmissionDecision(data);
  return data;
}

export async function acceptAndEnrollApplication(applicationId, { batchId, reviewedBy }) {
  if (!batchId) throw new Error('Batch is required to enrol');

  const app = await getApplication(applicationId);
  if (!app) throw new Error('Application not found');
  if (app.student_id) {
    return { application: app, student: { id: app.student_id }, alreadyEnrolled: true };
  }

  const year = new Date().getFullYear();
  const suffix = String(Date.now()).slice(-5);
  const matricule = `UNH${year}${suffix}`;

  const { data: student, error: stuErr } = await supabase
    .from('students')
    .insert({
      matricule,
      first_name: app.first_name,
      middle_name: app.middle_name,
      last_name: app.last_name,
      email: app.email,
      phone: app.phone,
      batch_id: batchId,
      admission_date: new Date().toISOString().slice(0, 10),
    })
    .select()
    .single();
  if (stuErr) throw stuErr;

  const { data: updated, error: upErr } = await supabase
    .from('admission_applications')
    .update({
      status: 'accepted',
      student_id: student.id,
      reviewed_by: reviewedBy || null,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', applicationId)
    .select()
    .single();
  if (upErr) throw upErr;

  void notifyAdmissionDecision(updated);
  return { application: updated, student, alreadyEnrolled: false };
}
