import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ROLES,
  MAX_ADMINS,
  hasRole,
  isAdmin,
  isLecturer,
  isStudent,
  isActiveAccount,
  can,
  getCapabilitiesForRole,
} from './permissions.js';

const admin = { role: 'admin', is_active: true };
const lecturer = { role: 'lecturer', is_active: true };
const student = { role: 'student', is_active: true };
const inactiveAdmin = { role: 'admin', is_active: false };

describe('role helpers', () => {
  it('detects roles correctly', () => {
    assert.equal(isAdmin(admin), true);
    assert.equal(isLecturer(lecturer), true);
    assert.equal(isStudent(student), true);
    assert.equal(isAdmin(lecturer), false);
    assert.equal(isStudent(null), false);
  });

  it('hasRole accepts array or single role', () => {
    assert.equal(hasRole(admin, ROLES.ADMIN), true);
    assert.equal(hasRole(lecturer, [ROLES.ADMIN, ROLES.LECTURER]), true);
    assert.equal(hasRole(student, [ROLES.ADMIN]), false);
  });

  it('treats inactive profiles as inactive accounts', () => {
    assert.equal(isActiveAccount(admin), true);
    assert.equal(isActiveAccount(inactiveAdmin), false);
    assert.equal(isActiveAccount(null), false);
  });

  it('enforces max three administrators constant', () => {
    assert.equal(MAX_ADMINS, 3);
  });
});

describe('capability matrix', () => {
  it('allows admins to manage people and fees', () => {
    assert.equal(can(admin, 'manage_people'), true);
    assert.equal(can(admin, 'manage_fees'), true);
    assert.equal(can(admin, 'approve_marks'), true);
    assert.equal(can(admin, 'publish_results'), true);
  });

  it('restricts lecturers to teaching capabilities', () => {
    assert.equal(can(lecturer, 'enter_marks'), true);
    assert.equal(can(lecturer, 'mark_attendance'), true);
    assert.equal(can(lecturer, 'manage_fees'), false);
    assert.equal(can(lecturer, 'approve_marks'), false);
  });

  it('restricts students to own academic/financial views', () => {
    assert.equal(can(student, 'view_own_results'), true);
    assert.equal(can(student, 'view_own_fees'), true);
    assert.equal(can(student, 'pay_own_fees'), true);
    assert.equal(can(student, 'manage_people'), false);
    assert.equal(can(student, 'enter_marks'), false);
  });

  it('denies capabilities for inactive accounts', () => {
    assert.equal(can(inactiveAdmin, 'manage_people'), false);
    assert.equal(can(inactiveAdmin, 'approve_marks'), false);
  });

  it('denies unknown capabilities', () => {
    assert.equal(can(admin, 'launch_missiles'), false);
  });

  it('lists capabilities for a role', () => {
    const adminCaps = getCapabilitiesForRole(ROLES.ADMIN);
    assert.ok(adminCaps.includes('manage_fees'));
    assert.ok(adminCaps.includes('approve_marks'));

    const studentCaps = getCapabilitiesForRole(ROLES.STUDENT);
    assert.ok(studentCaps.includes('view_own_results'));
    assert.ok(!studentCaps.includes('manage_people'));
  });
});
