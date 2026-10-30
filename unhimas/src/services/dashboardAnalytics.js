import { supabase } from '../lib/supabase';

/** Students per department for admin enrollment chart */
export async function getDepartmentEnrollment() {
  const { data, error } = await supabase
    .from('departments')
    .select('id, name, abbreviation, students:students(count)')
    .order('name');

  if (error) throw error;

  return (data || []).map((d) => ({
    id: d.id,
    name: d.abbreviation || d.name,
    fullName: d.name,
    students: d.students?.[0]?.count ?? 0,
  }));
}

/** Mark submission counts by workflow status */
export async function getMarkStatusBreakdown() {
  const statuses = ['draft', 'submitted', 'returned', 'approved', 'published'];
  const labels = {
    draft: 'Draft',
    submitted: 'Pending',
    returned: 'Returned',
    approved: 'Approved',
    published: 'Published',
  };

  const results = await Promise.all(
    statuses.map((status) =>
      supabase.from('mark_submissions').select('*', { count: 'exact', head: true }).eq('status', status),
    ),
  );

  return statuses.map((status, i) => ({
    status,
    label: labels[status],
    count: results[i].error ? 0 : results[i].count ?? 0,
  }));
}

/** Aggregated fee snapshot (XAF) from student_fee_balances view */
export async function getFeeCollectionSnapshot() {
  const { data, error } = await supabase
    .from('student_fee_balances')
    .select('total_invoiced, total_paid, outstanding_balance');

  if (error) {
    // View may not exist yet — return zeros
    if (error.code === '42P01' || /does not exist/i.test(error.message || '')) {
      return { invoiced: 0, paid: 0, outstanding: 0 };
    }
    throw error;
  }

  const rows = data || [];
  return {
    invoiced: rows.reduce((s, r) => s + Number(r.total_invoiced || 0), 0),
    paid: rows.reduce((s, r) => s + Number(r.total_paid || 0), 0),
    outstanding: rows.reduce((s, r) => s + Number(r.outstanding_balance || 0), 0),
  };
}

/** Lecturer-scoped mark status mix */
export async function getLecturerMarkStatusBreakdown(lecturerId) {
  if (!lecturerId) return [];
  const statuses = ['draft', 'submitted', 'returned', 'approved', 'published'];
  const labels = {
    draft: 'Draft',
    submitted: 'Submitted',
    returned: 'Returned',
    approved: 'Approved',
    published: 'Published',
  };

  const results = await Promise.all(
    statuses.map((status) =>
      supabase
        .from('mark_submissions')
        .select('*', { count: 'exact', head: true })
        .eq('lecturer_id', lecturerId)
        .eq('status', status),
    ),
  );

  return statuses.map((status, i) => ({
    status,
    label: labels[status],
    count: results[i].error ? 0 : results[i].count ?? 0,
  }));
}

/** Last N months of teaching hours for a lecturer */
export async function getLecturerHoursTrend(lecturerId, months = 6) {
  if (!lecturerId) return [];

  const start = new Date();
  start.setMonth(start.getMonth() - (months - 1));
  start.setDate(1);
  start.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from('lecturer_hours_monthly')
    .select('month, hours_taught')
    .eq('lecturer_id', lecturerId)
    .gte('month', start.toISOString())
    .order('month', { ascending: true });

  if (error) {
    // View optional
    if (error.code === '42P01' || /does not exist|relation/i.test(error.message || '')) {
      return [];
    }
    throw error;
  }

  // Fill missing months with 0 for a continuous axis
  const byMonth = new Map(
    (data || []).map((r) => {
      const d = new Date(r.month);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      return [key, Number(r.hours_taught || 0)];
    }),
  );

  const out = [];
  for (let i = 0; i < months; i++) {
    const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    out.push({
      label: d.toLocaleDateString(undefined, { month: 'short' }),
      hours: byMonth.get(key) ?? 0,
    });
  }
  return out;
}
