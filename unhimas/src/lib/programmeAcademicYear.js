/** Resolve the academic-year row that ends a cohort's programme. */
export function resolveProgrammeEndAcademicYear(academicYears, startAcademicYearId, durationYears) {
  const duration = Math.ceil(Number(durationYears));
  if (!startAcademicYearId || !Number.isFinite(duration) || duration < 1) return null;

  const orderedYears = [...(academicYears || [])]
    .filter((year) => year?.id && Number.isFinite(Date.parse(year.start_date)))
    .sort((a, b) => Date.parse(a.start_date) - Date.parse(b.start_date));
  const startIndex = orderedYears.findIndex((year) => year.id === startAcademicYearId);
  if (startIndex < 0) return null;

  const startYear = Number(orderedYears[startIndex].start_date.slice(0, 4));
  const endYear = startYear + duration - 1;
  return orderedYears.find((year) => Number(year.start_date.slice(0, 4)) === endYear) || null;
}

/** Whether the programme end session has finished; supports legacy annual batches. */
export function isProgrammePeriodComplete(batch, now = Date.now()) {
  if (batch?.programme_end_academic_year_id) {
    const endDate = batch.programme_end_academic_years?.end_date;
    const currentDate = new Date(now);
    if (!endDate || Number.isNaN(currentDate.getTime())) return false;
    const today = [
      currentDate.getFullYear(),
      String(currentDate.getMonth() + 1).padStart(2, '0'),
      String(currentDate.getDate()).padStart(2, '0'),
    ].join('-');
    return endDate.slice(0, 10) <= today;
  }

  const year = Number(batch?.year_of_study);
  const duration = Number(batch?.programmes?.duration_years);
  return Number.isFinite(year)
    && year >= 1
    && Number.isFinite(duration)
    && duration > 0
    && year >= Math.ceil(duration);
}

export function isAcademicYearInProgrammeRange(academicYear, batch) {
  if (!academicYear?.id || !batch?.academic_year_id) return false;
  if (!batch.programme_end_academic_year_id) {
    return academicYear.id === batch.academic_year_id;
  }

  const yearStart = Date.parse(academicYear.start_date || '');
  const cohortStart = Date.parse(batch.academic_years?.start_date || '');
  const cohortEnd = Date.parse(batch.programme_end_academic_years?.start_date || '');
  return Number.isFinite(yearStart)
    && Number.isFinite(cohortStart)
    && Number.isFinite(cohortEnd)
    && yearStart >= cohortStart
    && yearStart <= cohortEnd;
}

export function getProgrammeAcademicYearRangeLabel(batch) {
  const start = batch?.academic_years?.name;
  const end = batch?.programme_end_academic_years?.name;
  if (start && end && start !== end) return `${start} – ${end}`;
  return start || end || '';
}
