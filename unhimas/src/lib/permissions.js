/**
 * Role and permission helpers for UNHIMAS.
 * Administrators handle campus operations (clock-in) and academic approvals.
 * Up to three administrator accounts are allowed (enforced in DB).
 * Roles in use: admin, lecturer, student (frontdesk removed).
 */

export const ROLES = Object.freeze({
  ADMIN: 'admin',
  LECTURER: 'lecturer',
  STUDENT: 'student',
});

export const ALL_ROLES = Object.freeze(Object.values(ROLES));

/** Maximum number of administrator profiles (DB-enforced). */
export const MAX_ADMINS = 3;

/** True if profile.role is one of the allowed roles. */
export function hasRole(profile, roles) {
  if (!profile?.role) return false;
  const allowed = Array.isArray(roles) ? roles : [roles];
  return allowed.includes(profile.role);
}

export function isAdmin(profile) {
  return hasRole(profile, ROLES.ADMIN);
}

export function isLecturer(profile) {
  return hasRole(profile, ROLES.LECTURER);
}

export function isStudent(profile) {
  return hasRole(profile, ROLES.STUDENT);
}

/** Active accounts only; inactive users are treated as unauthorized. */
export function isActiveAccount(profile) {
  return Boolean(profile?.is_active);
}

/**
 * Capability matrix.
 * Keys are capability names; values are roles that may perform them.
 * UI nav uses these; RLS remains the real security boundary.
 */
const CAPABILITIES = Object.freeze({
  manage_academic_structure: [ROLES.ADMIN],
  manage_people: [ROLES.ADMIN],
  create_accounts: [ROLES.ADMIN],
  approve_marks: [ROLES.ADMIN],
  approve_attendance: [ROLES.ADMIN],
  publish_results: [ROLES.ADMIN],
  manage_announcements: [ROLES.ADMIN],
  manage_resources: [ROLES.ADMIN],
  view_audit_log: [ROLES.ADMIN],
  manage_settings: [ROLES.ADMIN],
  clock_lecturers: [ROLES.ADMIN],
  manage_fees: [ROLES.ADMIN],
  enter_marks: [ROLES.LECTURER],
  mark_attendance: [ROLES.LECTURER],
  view_own_results: [ROLES.STUDENT],
  view_own_transcript: [ROLES.STUDENT],
  view_own_fees: [ROLES.STUDENT],
  pay_own_fees: [ROLES.STUDENT],
});

/** Check whether a profile may perform a named capability. */
export function can(profile, capability) {
  if (!profile?.role || !profile?.is_active) return false;
  const allowed = CAPABILITIES[capability];
  if (!allowed) return false;
  return allowed.includes(profile.role);
}

export function getCapabilitiesForRole(role) {
  return Object.entries(CAPABILITIES)
    .filter(([, roles]) => roles.includes(role))
    .map(([name]) => name);
}
