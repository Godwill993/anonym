import { supabase } from '../lib/supabase';

const REPORT_LIMIT = 200;

export async function getLecturerHoursReport() {
  const { data, error } = await supabase
    .from('lecturer_hours_monthly')
    .select('*')
    .order('month', { ascending: false })
    .limit(REPORT_LIMIT);

  if (error) throw error;
  return data || [];
}

export async function getAttendanceReport() {
  const { data, error } = await supabase
    .from('attendance_summary')
    .select('*')
    .order('attendance_percentage', { ascending: false })
    .limit(REPORT_LIMIT);

  if (error) throw error;
  return data || [];
}

/**
 * Course-level averages/pass rates from published results.
 * Tries the course_performance view first, then aggregates from results / marks.
 */
export async function getCoursePerformanceReport() {
  // 1) Preferred: DB view
  const viewAttempt = await supabase
    .from('course_performance')
    .select('*')
    .order('average_score', { ascending: false })
    .limit(REPORT_LIMIT);

  if (!viewAttempt.error) {
    return viewAttempt.data || [];
  }

  // 2) Aggregate from published results view
  const resultsAttempt = await supabase
    .from('results')
    .select('course_id, course_code, course_name, total_score, grade')
    .limit(5000);

  if (!resultsAttempt.error && resultsAttempt.data) {
    return aggregateCoursePerformance(resultsAttempt.data);
  }

  // 3) Last resort: published mark_submissions + marks + courses
  const marksAttempt = await supabase
    .from('marks')
    .select(
      `
      total_score,
      grade,
      mark_submissions!inner (
        status,
        batch_courses!inner (
          course_id,
          courses ( id, code, name )
        )
      )
    `,
    )
    .eq('mark_submissions.status', 'published')
    .limit(5000);

  if (marksAttempt.error) {
    // Surface the original view error (most useful for ops)
    throw viewAttempt.error;
  }

  const rows = (marksAttempt.data || []).map((m) => {
    const course = m.mark_submissions?.batch_courses?.courses;
    return {
      course_id: course?.id || m.mark_submissions?.batch_courses?.course_id,
      course_code: course?.code || '—',
      course_name: course?.name || '—',
      total_score: m.total_score,
      grade: m.grade,
    };
  });

  return aggregateCoursePerformance(rows);
}

function aggregateCoursePerformance(rows) {
  const byCourse = new Map();

  for (const row of rows) {
    const key = row.course_id || row.course_code;
    if (!key) continue;
    if (!byCourse.has(key)) {
      byCourse.set(key, {
        course_id: row.course_id,
        course_code: row.course_code || '—',
        course_name: row.course_name || '—',
        students: 0,
        scoreSum: 0,
        passes: 0,
        failures: 0,
      });
    }
    const agg = byCourse.get(key);
    agg.students += 1;
    agg.scoreSum += Number(row.total_score) || 0;
    if (row.grade && row.grade !== 'F') agg.passes += 1;
    else if (row.grade === 'F') agg.failures += 1;
  }

  return Array.from(byCourse.values())
    .map((agg) => ({
      course_id: agg.course_id,
      course_code: agg.course_code,
      course_name: agg.course_name,
      students: agg.students,
      average_score:
        agg.students > 0 ? Math.round((agg.scoreSum / agg.students) * 100) / 100 : 0,
      passes: agg.passes,
      failures: agg.failures,
    }))
    .sort((a, b) => Number(b.average_score) - Number(a.average_score))
    .slice(0, REPORT_LIMIT);
}

/**
 * Published student results. Falls back to marks joins if the results view is missing.
 */
export async function getResultsReport() {
  const viewAttempt = await supabase
    .from('results')
    .select('*')
    .order('academic_year', { ascending: false })
    .limit(REPORT_LIMIT);

  if (!viewAttempt.error) {
    return viewAttempt.data || [];
  }

  // Fallback from marks
  const marksAttempt = await supabase
    .from('marks')
    .select(
      `
      attendance_score,
      coursework_score,
      exam_score,
      total_score,
      grade,
      grade_point,
      students ( id, matricule, first_name, last_name, batch_id,
        batches ( id, name, department_id, departments ( id, name ) )
      ),
      mark_submissions!inner (
        status,
        batch_courses!inner (
          semester_id,
          course_id,
          semesters ( id, name, academic_year_id, academic_years ( id, name ) ),
          courses ( id, code, name, credit_units )
        )
      )
    `,
    )
    .eq('mark_submissions.status', 'published')
    .limit(REPORT_LIMIT);

  if (marksAttempt.error) {
    throw viewAttempt.error;
  }

  return (marksAttempt.data || []).map((m) => {
    const bc = m.mark_submissions?.batch_courses;
    const student = m.students;
    const batch = student?.batches;
    const course = bc?.courses;
    const semester = bc?.semesters;
    return {
      student_id: student?.id,
      matricule: student?.matricule,
      first_name: student?.first_name,
      last_name: student?.last_name,
      batch_id: batch?.id,
      batch_name: batch?.name,
      department_id: batch?.departments?.id,
      department_name: batch?.departments?.name,
      academic_year_id: semester?.academic_years?.id,
      academic_year: semester?.academic_years?.name,
      semester_id: semester?.id,
      semester: semester?.name,
      course_id: course?.id,
      course_code: course?.code,
      course_name: course?.name,
      credit_units: course?.credit_units,
      attendance_score: m.attendance_score,
      coursework_score: m.coursework_score,
      exam_score: m.exam_score,
      total_score: m.total_score,
      grade: m.grade,
      grade_point: m.grade_point,
      result_status: 'published',
    };
  });
}
