import { supabase } from '../lib/supabase';
import { checkFeeClearance } from './feeClearance';

/** Whether registration requires fee clearance (default true). */
export async function registrationRequiresFeeClearance() {
  try {
    const { data, error } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'course_registration')
      .maybeSingle();
    if (error || !data) return true;
    return data.value?.require_fee_clearance !== false;
  } catch {
    return true;
  }
}

export function isRegistrationWindowOpen(semester) {
  if (!semester) return false;
  if (!semester.registration_open) return false;
  if (semester.registration_closes_at) {
    const closes = new Date(semester.registration_closes_at).getTime();
    if (Number.isFinite(closes) && Date.now() > closes) return false;
  }
  return true;
}

/** Current semester for the student's batch academic year when possible. */
export async function getCurrentSemesterForStudent(student) {
  const yearId = student?.batches?.academic_year_id || student?.batches?.academic_years?.id;
  let q = supabase
    .from('semesters')
    .select('id, name, number, is_current, registration_open, registration_closes_at, academic_year_id')
    .eq('is_current', true)
    .limit(1);
  if (yearId) q = q.eq('academic_year_id', yearId);
  const { data, error } = await q.maybeSingle();
  if (error) throw error;
  return data;
}

export async function listBatchCoursesForSemester(batchId, semesterId) {
  const { data, error } = await supabase
    .from('batch_courses')
    .select(
      `
      id, is_compulsory, batch_id, semester_id,
      courses:course_id ( id, code, name, credit_units ),
      lecturers:lecturer_id ( id, first_name, last_name ),
      semesters:semester_id ( id, name, number, is_current, registration_open, registration_closes_at )
    `,
    )
    .eq('batch_id', batchId)
    .eq('semester_id', semesterId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function listMyRegistrations(studentId) {
  const { data, error } = await supabase
    .from('student_course_registrations')
    .select('id, batch_course_id, status, registered_at, dropped_at')
    .eq('student_id', studentId);
  if (error) {
    // Table may not exist yet — fail soft
    if (error.code === '42P01' || error.message?.includes('does not exist')) {
      return [];
    }
    throw error;
  }
  return data || [];
}

/**
 * Register for an optional batch course.
 * Compulsory courses need no row (treated as registered).
 */
export async function registerForCourse({ studentId, batchCourseId, student }) {
  const needClearance = await registrationRequiresFeeClearance();
  if (needClearance) {
    const clearance = await checkFeeClearance(studentId);
    if (clearance.required && !clearance.cleared) {
      const err = new Error('Fee clearance required before course registration');
      err.code = 'FEE_CLEARANCE';
      err.outstanding = clearance.outstanding;
      throw err;
    }
  }

  const semester = await getCurrentSemesterForStudent(student);
  if (!isRegistrationWindowOpen(semester)) {
    const err = new Error('Course registration is closed for this semester');
    err.code = 'WINDOW_CLOSED';
    throw err;
  }

  const { data: bc, error: bcErr } = await supabase
    .from('batch_courses')
    .select('id, is_compulsory, batch_id, semester_id')
    .eq('id', batchCourseId)
    .single();
  if (bcErr) throw bcErr;

  if (bc.batch_id !== student.batch_id) {
    throw new Error('Course is not offered for your batch');
  }
  if (bc.semester_id !== semester?.id) {
    throw new Error('You can only register for courses in the current semester');
  }
  if (bc.is_compulsory) {
    return { status: 'registered', compulsory: true };
  }

  const { data, error } = await supabase
    .from('student_course_registrations')
    .upsert(
      {
        student_id: studentId,
        batch_course_id: batchCourseId,
        status: 'registered',
        registered_at: new Date().toISOString(),
        dropped_at: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'student_id,batch_course_id' },
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function dropCourse({ studentId, batchCourseId, student }) {
  const semester = await getCurrentSemesterForStudent(student);
  if (!isRegistrationWindowOpen(semester)) {
    const err = new Error('Course registration is closed; you cannot drop courses');
    err.code = 'WINDOW_CLOSED';
    throw err;
  }

  const { data: bc, error: bcErr } = await supabase
    .from('batch_courses')
    .select('id, is_compulsory')
    .eq('id', batchCourseId)
    .single();
  if (bcErr) throw bcErr;
  if (bc.is_compulsory) {
    throw new Error('Compulsory courses cannot be dropped');
  }

  const { data, error } = await supabase
    .from('student_course_registrations')
    .upsert(
      {
        student_id: studentId,
        batch_course_id: batchCourseId,
        status: 'dropped',
        dropped_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'student_id,batch_course_id' },
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Merge batch courses with registration rows for UI. */
export function attachRegistrationState(batchCourses, registrations) {
  const map = {};
  (registrations || []).forEach((r) => {
    map[r.batch_course_id] = r;
  });
  return (batchCourses || []).map((bc) => {
    if (bc.is_compulsory) {
      return {
        ...bc,
        registrationStatus: 'registered',
        isRegistered: true,
        canRegister: false,
        canDrop: false,
      };
    }
    const reg = map[bc.id];
    const isRegistered = reg?.status === 'registered';
    return {
      ...bc,
      registrationStatus: reg?.status || 'not_registered',
      isRegistered,
      canRegister: !isRegistered,
      canDrop: isRegistered,
      registration: reg || null,
    };
  });
}
