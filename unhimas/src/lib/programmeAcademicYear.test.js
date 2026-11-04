import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isAcademicYearInProgrammeRange,
  isProgrammePeriodComplete,
  resolveProgrammeEndAcademicYear,
} from './programmeAcademicYear.js';

const academicYears = [
  { id: '2027', name: '2027/2028', start_date: '2027-09-01', end_date: '2028-07-31' },
  { id: '2025', name: '2025/2026', start_date: '2025-09-01', end_date: '2026-07-31' },
  { id: '2026', name: '2026/2027', start_date: '2026-09-01', end_date: '2027-07-31' },
];

describe('programme academic-year ranges', () => {
  it('uses the start session for a one-year programme', () => {
    assert.equal(resolveProgrammeEndAcademicYear(academicYears, '2026', 1)?.id, '2026');
  });

  it('resolves multi-year programmes by ordered academic sessions', () => {
    assert.equal(resolveProgrammeEndAcademicYear(academicYears, '2025', 2)?.id, '2026');
    assert.equal(resolveProgrammeEndAcademicYear(academicYears, '2025', 3)?.id, '2027');
  });

  it('returns null when the required future session is not configured', () => {
    assert.equal(resolveProgrammeEndAcademicYear(academicYears, '2026', 3), null);
    assert.equal(resolveProgrammeEndAcademicYear(academicYears, 'missing', 2), null);
  });

  it('does not skip a missing academic year when resolving the programme end', () => {
    const yearsWithGap = academicYears.filter((year) => year.id !== '2026');
    assert.equal(resolveProgrammeEndAcademicYear(yearsWithGap, '2025', 2), null);
  });

  it('resolves annual sessions when their exact start dates differ', () => {
    const years = [
      { id: 'a', start_date: '2025-09-01' },
      { id: 'b', start_date: '2026-10-15' },
    ];
    assert.equal(resolveProgrammeEndAcademicYear(years, 'a', 2)?.id, 'b');
  });

  it('checks completion against the end session date', () => {
    const batch = {
      programme_end_academic_year_id: '2026',
      programme_end_academic_years: { end_date: '2027-07-31' },
    };
    assert.equal(isProgrammePeriodComplete(batch, new Date(2027, 6, 30, 12)), false);
    assert.equal(isProgrammePeriodComplete(batch, new Date(2027, 7, 1, 12)), true);
  });

  it('limits semester sessions to the cohort range', () => {
    const batch = {
      academic_year_id: '2025',
      programme_end_academic_year_id: '2026',
      academic_years: { start_date: '2025-09-01' },
      programme_end_academic_years: { start_date: '2026-09-01' },
    };
    assert.equal(isAcademicYearInProgrammeRange(academicYears[1], batch), true);
    assert.equal(isAcademicYearInProgrammeRange(academicYears[0], batch), false);
    assert.equal(isAcademicYearInProgrammeRange(academicYears[2], batch), true);
  });
});
