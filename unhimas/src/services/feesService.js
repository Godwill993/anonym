import { supabase } from '../lib/supabase';
import { notifyInvoiceIssued, notifyPaymentReceived } from './notificationService';
import {
  canCompletePayment,
  canFailPayment,
  validatePaymentInitiation,
} from '../lib/paymentStatusLogic';
import { normalizeFeeClearancePolicy } from '../lib/feeClearanceLogic';

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
  { value: 'bank', label: 'Bank Transfer / Deposit' },
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
      students ( id, matricule, first_name, last_name, profile_id, email ),
      academic_years ( id, name ),
      semesters ( id, name ),
      invoice_items ( *, fee_categories ( code, name ) )
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
      students ( id, matricule, first_name, last_name, profile_id, email ),
      academic_years ( id, name ),
      semesters ( id, name ),
      invoice_items ( *, fee_categories ( code, name ) )
    `)
    .eq('id', invoiceId)
    .single();
  if (error) throw error;
  return data;
}

export async function createStudentResitInvoice(batchCourseIds) {
  const { data: invoiceId, error } = await supabase.rpc(
    'create_student_resit_invoice',
    { p_batch_course_ids: batchCourseIds },
  );
  if (error) throw error;
  if (!invoiceId) throw new Error('The resit invoice could not be created');
  return getInvoice(invoiceId);
}

export async function createInvoice({ studentId, academicYearId, semesterId, items, notes, dueDate }) {
  const { data: invNum, error: numErr } = await supabase.rpc('generate_invoice_number');
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

  const full = await getInvoice(invoice.id);
  const stu = full?.students;
  if (stu?.email) {
    void notifyInvoiceIssued({
      email: stu.email,
      invoiceNumber: full.invoice_number,
      amountLabel: formatXAF(full.total_amount),
      studentName: `${stu.first_name || ''} ${stu.last_name || ''}`.trim(),
    });
  }
  return full;
}

export async function cancelInvoice(invoiceId, { notes } = {}) {
  if (!invoiceId) throw new Error('Invoice id is required');
  const inv = await getInvoice(invoiceId);
  if (!inv) throw new Error('Invoice not found');
  if (Number(inv.amount_paid) > 0) {
    throw new Error('Cannot cancel an invoice with payments applied. Reconcile or refund payments first.');
  }
  const updatedNotes = notes
    ? (inv.notes ? `${inv.notes} | Cancelled: ${notes}` : `Cancelled: ${notes}`)
    : (inv.notes || 'Cancelled by administrator');

  const { data, error } = await supabase
    .from('student_invoices')
    .update({
      status: 'cancelled',
      notes: updatedNotes,
      updated_at: new Date().toISOString(),
    })
    .eq('id', invoiceId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function bulkCreateInvoices({
  batchId,
  structureIds,
  academicYearId,
  semesterId,
  notes,
  dueDate,
}) {
  if (!batchId) throw new Error('Batch is required');
  if (!structureIds?.length) throw new Error('Select at least one fee structure');

  const { data: students, error: stuErr } = await supabase
    .from('students')
    .select('id, matricule, first_name, last_name')
    .eq('batch_id', batchId);
  if (stuErr) throw stuErr;
  if (!students?.length) {
    return { created: 0, failed: 0, errors: [], totalStudents: 0 };
  }

  const { data: structures, error: stErr } = await supabase
    .from('fee_structures')
    .select('id, fee_category_id, amount, description, fee_categories ( name )')
    .in('id', structureIds)
    .eq('is_active', true);
  if (stErr) throw stErr;
  if (!structures?.length) throw new Error('No active fee structures found');

  const itemsTemplate = structures.map((s) => ({
    fee_structure_id: s.id,
    fee_category_id: s.fee_category_id,
    description: s.description || s.fee_categories?.name || 'Fee',
    quantity: 1,
    unit_amount: Number(s.amount),
  }));

  let created = 0;
  const errors = [];

  for (const student of students) {
    try {
      await createInvoice({
        studentId: student.id,
        academicYearId,
        semesterId,
        items: itemsTemplate,
        notes: notes || `Bulk invoice — batch`,
        dueDate,
      });
      created += 1;
    } catch (err) {
      errors.push({
        studentId: student.id,
        matricule: student.matricule,
        message: err?.message || 'Failed',
      });
    }
  }

  return {
    created,
    failed: errors.length,
    errors,
    totalStudents: students.length,
  };
}

// ── Payments ────────────────────────────────────────────────

export async function listPayments({ studentId, invoiceId, limit = 100 } = {}) {
  let q = supabase
    .from('payments')
    .select(`
      *,
      student_invoices (
        id, invoice_number, total_amount, balance, status,
        academic_years ( name ),
        semesters ( name ),
        invoice_items ( description, quantity, unit_amount )
      ),
      students ( id, matricule, first_name, last_name, email )
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
 * Record a payment attempt (typically initiated by a student).
 * Enforces pending status by default under RLS.
 */
export async function initiatePayment({
  invoiceId,
  studentId,
  amount,
  method,
  phoneNumber,
  providerReference,
  notes,
  completeImmediately = false,
}) {
  const validated = validatePaymentInitiation({
    invoiceId,
    studentId,
    amount,
    method,
    phoneNumber,
    providerReference,
  });
  if (!validated.ok) {
    throw new Error(validated.message);
  }

  const envAllowsAutoComplete = import.meta.env.VITE_PAYMENTS_AUTO_COMPLETE === 'true';
  const shouldComplete = Boolean(completeImmediately && envAllowsAutoComplete);

  let paymentReference;
  try {
    const { data } = await supabase.rpc('generate_payment_reference');
    paymentReference = data;
  } catch {
    paymentReference = `PAY-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(Date.now()).slice(-6)}`;
  }

  const payload = {
    payment_reference: paymentReference,
    invoice_id: validated.invoiceId,
    student_id: validated.studentId,
    amount: validated.amount,
    method: validated.method,
    status: shouldComplete ? 'completed' : 'pending',
    phone_number: validated.phoneNumber,
    provider_reference: validated.providerReference || null,
    notes: notes ? String(notes).trim() || null : null,
    paid_at: shouldComplete ? new Date().toISOString() : null,
  };

  const { data, error } = await supabase
    .from('payments')
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * Admin path to record offline/cash/bank payments directly.
 * Can complete immediately or save as pending.
 */
export async function recordAdminPayment({
  invoiceId,
  studentId,
  amount,
  method = 'cash',
  phoneNumber,
  providerReference,
  notes,
  completeImmediately = true,
  recordedBy,
}) {
  const validated = validatePaymentInitiation({
    invoiceId,
    studentId,
    amount,
    method,
    phoneNumber,
    providerReference,
  });
  if (!validated.ok) {
    throw new Error(validated.message);
  }

  let paymentReference;
  try {
    const { data } = await supabase.rpc('generate_payment_reference');
    paymentReference = data;
  } catch {
    paymentReference = `PAY-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(Date.now()).slice(-6)}`;
  }

  const nowIso = new Date().toISOString();
  const payload = {
    payment_reference: paymentReference,
    invoice_id: validated.invoiceId,
    student_id: validated.studentId,
    amount: validated.amount,
    method: validated.method,
    status: completeImmediately ? 'completed' : 'pending',
    phone_number: validated.phoneNumber,
    provider_reference: validated.providerReference || null,
    notes: notes ? String(notes).trim() || null : null,
    recorded_by: recordedBy || null,
    paid_at: completeImmediately ? nowIso : null,
  };

  const { data, error } = await supabase
    .from('payments')
    .insert(payload)
    .select('*, students:student_id ( email, first_name, last_name )')
    .single();
  if (error) throw error;

  if (completeImmediately && data?.students?.email) {
    void notifyPaymentReceived({
      email: data.students.email,
      paymentReference: data.payment_reference,
      amountLabel: formatXAF(data.amount),
      receiptNumber: data.receipt_number,
    });
  }

  return data;
}

/**
 * Admin path to complete a payment (pending -> completed).
 */
export async function markPaymentCompleted(paymentId, { providerReference, recordedBy } = {}) {
  if (!paymentId) throw new Error('Payment id is required');

  const { data: existing, error: findErr } = await supabase
    .from('payments')
    .select('id, status, payment_reference, amount')
    .eq('id', paymentId)
    .maybeSingle();
  if (findErr) throw findErr;
  if (!existing) throw new Error('Payment not found');

  const gate = canCompletePayment(existing.status);
  if (!gate.ok) {
    if (gate.reason === 'already_completed') {
      throw new Error('This payment is already completed');
    }
    throw new Error(`Cannot complete a payment with status "${existing.status}"`);
  }

  const { data, error } = await supabase
    .from('payments')
    .update({
      status: 'completed',
      provider_reference: providerReference || null,
      recorded_by: recordedBy || null,
      paid_at: new Date().toISOString(),
    })
    .eq('id', paymentId)
    .eq('status', 'pending')
    .select('*, students:student_id ( email, first_name, last_name )')
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    throw new Error('Payment status changed concurrently; refresh and try again');
  }

  const email = data?.students?.email;
  if (email) {
    void notifyPaymentReceived({
      email,
      paymentReference: data.payment_reference,
      amountLabel: formatXAF(data.amount),
      receiptNumber: data.receipt_number,
    });
  }
  return data;
}

/**
 * Admin path to reject / mark a pending payment as failed.
 */
export async function markPaymentFailed(paymentId, { reason, recordedBy } = {}) {
  if (!paymentId) throw new Error('Payment id is required');

  const { data: existing, error: findErr } = await supabase
    .from('payments')
    .select('id, status, notes')
    .eq('id', paymentId)
    .maybeSingle();
  if (findErr) throw findErr;
  if (!existing) throw new Error('Payment not found');

  const gate = canFailPayment(existing.status);
  if (!gate.ok) {
    if (gate.reason === 'already_failed') {
      throw new Error('This payment is already marked as failed');
    }
    throw new Error(`Cannot reject a payment with status "${existing.status}"`);
  }

  const rejectionNote = reason ? String(reason).trim() : 'Rejected by administrator';
  const updatedNotes = existing.notes
    ? `${existing.notes} | Rejected: ${rejectionNote}`
    : `Rejected: ${rejectionNote}`;

  const { data, error } = await supabase
    .from('payments')
    .update({
      status: 'failed',
      notes: updatedNotes,
      recorded_by: recordedBy || null,
    })
    .eq('id', paymentId)
    .eq('status', 'pending')
    .select()
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    throw new Error('Payment status changed concurrently; refresh and try again');
  }
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

// ── Financial System Settings ───────────────────────────────

export async function getFeeClearanceSetting() {
  try {
    const { data, error } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'fee_clearance_required')
      .maybeSingle();
    if (error || !data) return { enabled: true, minPaidRatio: 1 };
    return normalizeFeeClearancePolicy(data.value || {});
  } catch {
    return { enabled: true, minPaidRatio: 1 };
  }
}

export async function updateFeeClearanceSetting({ enabled, minPaidRatio }) {
  const policy = normalizeFeeClearancePolicy({ enabled, minPaidRatio });
  const { data, error } = await supabase
    .from('system_settings')
    .upsert({
      key: 'fee_clearance_required',
      value: { enabled: policy.enabled, min_paid_ratio: policy.minPaidRatio },
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (error) throw error;
  return policy;
}

export async function getPaymentsAutoCompleteSetting() {
  try {
    const { data, error } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'payments_auto_complete')
      .maybeSingle();
    if (error || !data) return false;
    return Boolean(data.value?.enabled);
  } catch {
    return false;
  }
}

export async function updatePaymentsAutoCompleteSetting(enabled) {
  const { data, error } = await supabase
    .from('system_settings')
    .upsert({
      key: 'payments_auto_complete',
      value: { enabled: Boolean(enabled) },
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (error) throw error;
  return Boolean(enabled);
}
