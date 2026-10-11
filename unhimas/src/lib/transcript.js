const round = (value, precision = 2) => {
  const factor = 10 ** precision;
  return Math.round((value + Number.EPSILON) * factor) / factor;
};

const getCourse = (result) => result.mark_submissions?.batch_courses?.courses;
const getSemester = (result) => result.mark_submissions?.batch_courses?.semesters;

export function buildTranscriptSummary(results = []) {
  const bySemester = new Map();
  let totalQualityPoints = 0;
  let totalCredits = 0;
  let completedCourses = 0;
  let failedCourses = 0;

  for (const result of results) {
    const course = getCourse(result);
    const semester = getSemester(result);
    if (!course || !semester) continue;

    const credits = Number(course.credit_units || 0);
    const gradePoint = Number(result.grade_point || 0);
    const key = semester.id || `${semester.academic_years?.id || ''}:${semester.number || ''}`;

    if (!bySemester.has(key)) {
      bySemester.set(key, {
        id: semester.id,
        name: semester.name,
        number: semester.number,
        academicYear: semester.academic_years?.name || '',
        marks: [],
        attemptedCredits: 0,
        qualityPoints: 0,
        failed: 0,
      });
    }

    const semesterSummary = bySemester.get(key);
    semesterSummary.marks.push(result);
    semesterSummary.attemptedCredits += credits;
    semesterSummary.qualityPoints += gradePoint * credits;
    totalQualityPoints += gradePoint * credits;
    totalCredits += credits;

    if (result.grade === 'F') {
      failedCourses += 1;
      semesterSummary.failed += 1;
    } else {
      completedCourses += 1;
    }
  }

  const semesters = [...bySemester.values()]
    .sort((a, b) => Number(a.number || 0) - Number(b.number || 0))
    .map((semester) => ({
      ...semester,
      semesterGpa: semester.attemptedCredits
        ? round(semester.qualityPoints / semester.attemptedCredits)
        : null,
    }));

  return {
    totalCredits,
    overallGpa: totalCredits ? round(totalQualityPoints / totalCredits) : null,
    completedCourses,
    failedCourses,
    semesters,
  };
}
