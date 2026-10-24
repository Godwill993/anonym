import { useAuth } from '../context/AuthContext';
import { can as canCapability, isAdmin, isLecturer, isStudent, isActiveAccount } from '../lib/permissions';

/**
 * Hook: profile-aware permission checks for UI gates.
 * Usage: const { can, canManagePeople } = usePermissions();
 *        {can('manage_people') && <button>...</button>}
 */
export function usePermissions() {
  const { profile } = useAuth();

  const can = (capability) => canCapability(profile, capability);

  return {
    profile,
    can,
    isAdmin: isAdmin(profile),
    isLecturer: isLecturer(profile),
    isStudent: isStudent(profile),
    isActive: isActiveAccount(profile),
    canManagePeople: can('manage_people'),
    canCreateAccounts: can('create_accounts'),
    canApproveMarks: can('approve_marks'),
    canPublishResults: can('publish_results'),
    canManageAcademic: can('manage_academic_structure'),
    canManageAnnouncements: can('manage_announcements'),
    canManageResources: can('manage_resources'),
    canViewAuditLog: can('view_audit_log'),
    canManageSettings: can('manage_settings'),
    canClockLecturers: can('clock_lecturers'),
  };
}
