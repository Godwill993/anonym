/** Pure helpers for marks / attendance submission status machines (testable without Supabase). */

export const MARK_STATUSES = Object.freeze(['draft', 'submitted', 'returned', 'approved', 'published']);

export const ATTENDANCE_SESSION_STATUSES = Object.freeze(['draft', 'submitted', 'returned', 'approved']);

/** Whether lecturer may edit marks for this submission status. */
export function canEditMarks(status) {
  const st = status || 'draft';
  return st === 'draft' || st === 'returned';
}

/** Whether lecturer may edit session attendance rows. */
export function canEditAttendanceSession(status) {
  const st = status || 'draft';
  return st === 'draft' || st === 'returned';
}

/**
 * Valid transitions for mark_submissions (simplified product rules).
 * Returns next status or null if transition is not allowed.
 */
export function nextMarkStatus(current, action) {
  const st = current || 'draft';
  switch (action) {
    case 'submit':
      if (st === 'draft' || st === 'returned') return 'submitted';
      return null;
    case 'return':
      if (st === 'submitted') return 'returned';
      return null;
    case 'approve':
      if (st === 'submitted') return 'approved';
      return null;
    case 'publish':
      if (st === 'approved') return 'published';
      return null;
    default:
      return null;
  }
}

/** Student-visible results only after publish. */
export function studentCanSeeResults(status) {
  return status === 'published';
}
