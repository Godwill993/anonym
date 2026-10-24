import { supabase } from '../lib/supabase';

// ============================================================
// CAMPUS OPS — lecturer clock-in / shift registry (admin)
// ============================================================

/** Daily campus presence metrics for admin dashboard widgets. */
export async function getCampusShiftStats() {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [openShiftsRes, todayShiftsRes, totalLecturersRes] = await Promise.all([
    supabase.from('lecturer_shifts').select('*', { count: 'exact', head: true }).eq('status', 'open'),
    supabase.from('lecturer_shifts').select('id, clock_in, clock_out, status').gte('clock_in', todayStart.toISOString()),
    supabase.from('lecturers').select('*', { count: 'exact', head: true }).eq('is_active', true),
  ]);

  let totalHoursToday = 0;
  let completedShiftsToday = 0;

  (todayShiftsRes.data || []).forEach((shift) => {
    if (shift.status === 'closed' && shift.clock_out) {
      completedShiftsToday++;
      const hrs = (new Date(shift.clock_out) - new Date(shift.clock_in)) / (1000 * 60 * 60);
      if (hrs > 0) totalHoursToday += hrs;
    } else if (shift.status === 'open') {
      const hrs = (new Date() - new Date(shift.clock_in)) / (1000 * 60 * 60);
      if (hrs > 0) totalHoursToday += hrs;
    }
  });

  return {
    currentlyClockedIn: openShiftsRes.count ?? 0,
    completedShiftsToday,
    totalHoursToday: Number(totalHoursToday.toFixed(1)),
    totalActiveLecturers: totalLecturersRes.count ?? 0,
  };
}

/** Active lecturers with current open-shift status. */
export async function getLecturersWithShiftStatus({ search = '', departmentId = '' } = {}) {
  let lecQuery = supabase
    .from('lecturers')
    .select(`
      id,
      staff_id,
      first_name,
      middle_name,
      last_name,
      email,
      phone,
      department_id,
      departments (
        id,
        name,
        abbreviation
      )
    `)
    .eq('is_active', true)
    .order('last_name');

  if (departmentId) {
    lecQuery = lecQuery.eq('department_id', departmentId);
  }

  const { data: lecturers, error: lecError } = await lecQuery;
  if (lecError) throw lecError;

  const { data: openShifts, error: shiftError } = await supabase
    .from('lecturer_shifts')
    .select('*')
    .eq('status', 'open');

  if (shiftError) throw shiftError;

  const openShiftMap = new Map();
  (openShifts || []).forEach((s) => {
    openShiftMap.set(s.lecturer_id, s);
  });

  let combined = (lecturers || []).map((l) => {
    const shift = openShiftMap.get(l.id);
    return {
      ...l,
      isClockedIn: Boolean(shift),
      activeShift: shift || null,
    };
  });

  if (search && search.trim()) {
    const term = search.toLowerCase().trim();
    combined = combined.filter((l) => {
      const fullName = `${l.first_name} ${l.middle_name || ''} ${l.last_name}`.toLowerCase();
      const staffId = l.staff_id?.toLowerCase() || '';
      const dept = l.departments?.name?.toLowerCase() || '';
      return fullName.includes(term) || staffId.includes(term) || dept.includes(term);
    });
  }

  return combined;
}

export async function clockInLecturer({ lecturerId, staffProfileId }) {
  const { data: existing } = await supabase
    .from('lecturer_shifts')
    .select('id')
    .eq('lecturer_id', lecturerId)
    .eq('status', 'open')
    .maybeSingle();

  if (existing) {
    throw new Error('Lecturer is already clocked in with an active shift.');
  }

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('lecturer_shifts')
    .insert([
      {
        lecturer_id: lecturerId,
        clock_in: now,
        status: 'open',
        clock_in_by: staffProfileId || null,
      },
    ])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function clockOutLecturer({ shiftId, staffProfileId }) {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('lecturer_shifts')
    .update({
      clock_out: now,
      status: 'closed',
      clock_out_by: staffProfileId || null,
    })
    .eq('id', shiftId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getShiftHistory({
  date = null,
  lecturerId = null,
  departmentId = null,
  status = null,
  limit = 100,
} = {}) {
  let query = supabase
    .from('lecturer_shifts')
    .select(`
      *,
      lecturers:lecturer_id (
        id,
        staff_id,
        first_name,
        last_name,
        department_id,
        departments:department_id (
          id,
          name,
          abbreviation
        )
      ),
      clock_in_staff:clock_in_by (
        full_name,
        login_id
      ),
      clock_out_staff:clock_out_by (
        full_name,
        login_id
      )
    `)
    .order('clock_in', { ascending: false })
    .limit(limit);

  if (status) query = query.eq('status', status);
  if (lecturerId) query = query.eq('lecturer_id', lecturerId);

  if (date) {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);
    query = query.gte('clock_in', start.toISOString()).lte('clock_in', end.toISOString());
  }

  const { data, error } = await query;
  if (error) throw error;

  let result = data || [];
  if (departmentId) {
    result = result.filter((s) => s.lecturers?.department_id === departmentId);
  }

  return result;
}
