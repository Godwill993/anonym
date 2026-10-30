import { supabase } from '../lib/supabase';

/** Format XAF amounts for display */
export function formatXAF(amount) {
  if (amount == null || Number.isNaN(Number(amount))) return '—';
  return new Intl.NumberFormat('fr-CM', {
    style: 'currency',
    currency: 'XAF',
    maximumFractionDigits: 0,
  }).format(Number(amount));
}

export const PAYMENT_METHODS = [
  { value: 'mtn_momo', label: 'MTN Mobile Money' },
  { value: 'orange_money', label: 'Orange Money' },
  { value: 'bank', label: 'Bank Transfer' },
  { value: 'cash', label: 'Cash' },
  { value: 'other', label: 'Other' },
];

export const INVOICE_STATUSES = [
  'draft',
  'issued',
  'partially_paid',
  'paid',
  'cancelled',
  'waived',
];

// ── Categories ──────────────────────────────────────────────

export async function listFeeCategories({ activeOnly = false } = {}) {
  let q = supabase
    .from('fee_categories')
    .select('*')
    .order('sort_order', { ascending: true });
  if (activeOnly) q = q.eq('is_active', true);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function upsertFeeCategory(payload) {
  const { data, error } = await supabase
    .from('fee_categories')
    .upsert(payload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ── Structures ──────────────────────────────────────────────

export async function listFeeStructures({ academicYearId, activeOnly = true } = {}) {
  let q = supabase
    .from('fee_structures')
    .select(`
      *,
      fee_categories ( id, code, name ),
      academic_years ( id, name ),
      departments ( id, name ),
      batches ( id, name )
    `)
    .order('created_at', { ascending: false });
  if (activeOnly) q = q.eq('is_active', true);
  if (academicYearId) q = q.eq('academic_year_id', academicYearId);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function upsertFeeStructure(payload) {
  const { data, error } = await supabase
    .from('fee_structures')
    .upsert(payload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ── Invoices ────────────────────────────────────────────────

export async function listInvoices({ studentId, status, limit = 50 } = {}) {
  let q = supabase
    .from('student_invoices')
    .select(`
      *,
      students ( id, matricule, first_name, last_name, profile_id ),
      academic_years ( id, name ),
      semesters ( id, name ),
      invoice_items ( * )
    `)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (studentId) q = q.eq('student_id', studentId);
  if (status) q = q.eq('status', status);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function getInvoice(invoiceId) {
  const { data, error } = await supabase
    .from('student_invoices')
    .select(`
      *,
      students ( id, matricule, first_name, last_name, profile_id ),
      academic_years ( id, name ),
      semesters ( id, name ),
      invoice_items ( * )
    `)
    .eq('id', invoiceId)
    .single();
  if (error) throw error;
  return data;
}

export async function createInvoice({ studentId, academicYearId, semesterId, items, notes, dueDate }) {
  const { data: invNum, error: numErr } = await supabase.rpc('generate_invoice_number');
  // Fallback if RPC not yet available
  const invoiceNumber =
    invNum ||
    `INV-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;

  if (numErr && !invoiceNumber) throw numErr;

  const { data: invoice, error: invErr } = await supabase
    .from('student_invoices')
    .insert({
      invoice_number: typeof invNum === 'string' ? invNum : invoiceNumber,
      student_id: studentId,
      academic_year_id: academicYearId || null,
      semester_id: semesterId || null,
      status: 'issued',
      issue_date: new Date().toISOString().slice(0, 10),
      due_date: dueDate || null,
      notes: notes || null,
    })
    .select()
    .single();
  if (invErr) throw invErr;

  if (items?.length) {
    const rows = items.map((it) => ({
      invoice_id: invoice.id,
      fee_structure_id: it.fee_structure_id || null,
      fee_category_id: it.fee_category_id || null,
      description: it.description,
      quantity: it.quantity ?? 1,
      unit_amount: it.unit_amount,
    }));
    const { error: itemsErr } = await supabase.from('invoice_items').insert(rows);
    if (itemsErr) throw itemsErr;
  }

  return getInvoice(invoice.id);
}

// ── Payments ────────────────────────────────────────────────

export async function listPayments({ studentId, invoiceId, limit = 50 } = {}) {
  let q = supabase
    .from('payments')
    .select(`
      *,
      student_invoices ( id, invoice_number, total_amount, balance )
    `)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (studentId) q = q.eq('student_id', studentId);
  if (invoiceId) q = q.eq('invoice_id', invoiceId);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

/**
 * Student-initiated payment (starts as pending).
 * Admin can later mark completed, or a future webhook can do so.
 * For demo / internal use we also support immediate complete.
 */
export async function initiatePayment({
  invoiceId,
  studentId,
  amount,
  method,
  phoneNumber,
  notes,
  completeImmediately = false,
}) {
  let paymentReference;
  try {
    const { data } = await supabase.rpc('generate_payment_reference');
    paymentReference = data;
  } catch {
    paymentReference = `PAY-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(Date.now()).slice(-6)}`;
  }

  const payload = {
    payment_reference: paymentReference,
    invoice_id: invoiceId,
    student_id: studentId,
    amount: Number(amount),
    method: method || 'other',
    status: completeImmediately ? 'completed' : 'pending',
    phone_number: phoneNumber || null,
    notes: notes || null,
    paid_at: completeImmediately ? new Date().toISOString() : null,
  };

  const { data, error } = await supabase
    .from('payments')
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function markPaymentCompleted(paymentId, { providerReference, recordedBy } = {}) {
  const { data, error } = await supabase
    .from('payments')
    .update({
      status: 'completed',
      provider_reference: providerReference || null,
      recorded_by: recordedBy || null,
      paid_at: new Date().toISOString(),
    })
    .eq('id', paymentId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ── Balances ────────────────────────────────────────────────

export async function getStudentFeeBalance(studentId) {
  const { data, error } = await supabase
    .from('student_fee_balances')
    .select('*')
    .eq('student_id', studentId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getMyFeeBalance(profileId) {
  const { data: student, error: sErr } = await supabase
    .from('students')
    .select('id')
    .eq('profile_id', profileId)
    .maybeSingle();
  if (sErr) throw sErr;
  if (!student) return null;
  return getStudentFeeBalance(student.id);
}
