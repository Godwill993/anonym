/**
 * Role and permission helpers for UNHIMAS.
 * Role checks on routes still use ProtectedRoute; these helpers are for
 * UI visibility and action-level gates inside pages.
 */

export const ROLES = Object.freeze({
  ADMIN: 'admin',
  FRONTDESK: 'frontdesk',
  LECTURER: 'lecturer',
  STUDENT: 'student',
});

export const ALL_ROLES = Object.freeze(Object.values(ROLES));

/** True if profile.role is one of the allowed roles. */
export function hasRole(profile, roles) {
  if (!profile?.role) return false;
  const allowed = Array.isArray(roles) ? roles : [roles];
  return allowed.includes(profile.role);
}

export function isAdmin(profile) {
  return hasRole(profile, ROLES.ADMIN);
}

export function isFrontDesk(profile) {
  return hasRole(profile, [ROLES.FRONTDESK, ROLES.ADMIN]);
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
 * Capability matrix — expand as fine-grained permissions are needed.
 * Keys are capability names; values are roles that may perform them.
 */
const CAPABILITIES = Object.freeze({
  manage_academic_structure: [ROLES.ADMIN],
  manage_people: [ROLES.ADMIN],
  create_accounts: [ROLES.ADMIN],
  approve_marks: [ROLES.ADMIN],
  publish_results: [ROLES.ADMIN],
  manage_announcements: [ROLES.ADMIN],
  manage_resources: [ROLES.ADMIN],
  view_audit_log: [ROLES.ADMIN],
  manage_settings: [ROLES.ADMIN],
  clock_lecturers: [ROLES.FRONTDESK, ROLES.ADMIN],
  enter_marks: [ROLES.LECTURER],
  mark_attendance: [ROLES.LECTURER],
  view_own_results: [ROLES.STUDENT],
  view_own_transcript: [ROLES.STUDENT],
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
