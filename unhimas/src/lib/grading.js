/**
 * Grade calculation for UNHIMAS.
 * Prefer the database grading_scale table; fall back to the standard
 * Cameroonian-style scale used by the institution (A 80–100 … F <50).
 */

const DEFAULT_SCALE = [
  { min_score: 80, max_score: 100, grade: 'A', grade_point: 4.0, remark: 'Excellent' },
  { min_score: 70, max_score: 79.99, grade: 'B', grade_point: 3.0, remark: 'Very Good' },
  { min_score: 60, max_score: 69.99, grade: 'C', grade_point: 2.0, remark: 'Good' },
  { min_score: 50, max_score: 59.99, grade: 'D', grade_point: 1.0, remark: 'Pass' },
  { min_score: 0, max_score: 49.99, grade: 'F', grade_point: 0.0, remark: 'Fail' },
];

/**
 * @param {number} totalScore - attendance + coursework + exam (0–100)
 * @param {Array<{min_score:number,max_score:number,grade:string,grade_point:number,remark?:string}>} [scale]
 * @returns {{ grade: string, grade_point: number, remark: string|null }}
 */
export function computeGrade(totalScore, scale = DEFAULT_SCALE) {
  const total = Number(totalScore);
  if (Number.isNaN(total) || total < 0) {
    return { grade: 'F', grade_point: 0, remark: 'Fail' };
  }
  const clamped = Math.min(100, total);
  const ordered = [...scale].sort((a, b) => Number(b.min_score) - Number(a.min_score));
  for (const row of ordered) {
    const min = Number(row.min_score);
    const max = Number(row.max_score);
    if (clamped >= min && clamped <= max) {
      return {
        grade: row.grade,
        grade_point: Number(row.grade_point),
        remark: row.remark || null,
      };
    }
  }
  if (clamped >= 80) return { grade: 'A', grade_point: 4.0, remark: 'Excellent' };
  if (clamped >= 70) return { grade: 'B', grade_point: 3.0, remark: 'Very Good' };
  if (clamped >= 60) return { grade: 'C', grade_point: 2.0, remark: 'Good' };
  if (clamped >= 50) return { grade: 'D', grade_point: 1.0, remark: 'Pass' };
  return { grade: 'F', grade_point: 0.0, remark: 'Fail' };
}

/**
 * UI helper: badge class for a letter grade.
 */
export function gradeBadgeClass(grade) {
  switch (String(grade || '').toUpperCase()) {
    case 'A':
      return 'badge-green';
    case 'B':
      return 'badge-blue';
    case 'C':
    case 'D':
      return 'badge-amber';
    default:
      return 'badge-red';
  }
}

export { DEFAULT_SCALE };
