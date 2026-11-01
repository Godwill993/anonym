import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  canEditMarks,
  canEditAttendanceSession,
  nextMarkStatus,
  studentCanSeeResults,
  MARK_STATUSES,
  ATTENDANCE_SESSION_STATUSES,
} from './marksWorkflow.js';

describe('marks workflow', () => {
  it('allows edit only in draft or returned', () => {
    assert.equal(canEditMarks('draft'), true);
    assert.equal(canEditMarks('returned'), true);
    assert.equal(canEditMarks('submitted'), false);
    assert.equal(canEditMarks('approved'), false);
    assert.equal(canEditMarks('published'), false);
  });

  it('treats missing status as draft for edit checks', () => {
    assert.equal(canEditMarks(undefined), true);
    assert.equal(canEditMarks(null), true);
    assert.equal(canEditMarks(''), true);
  });

  it('submit → approve → publish path', () => {
    assert.equal(nextMarkStatus('draft', 'submit'), 'submitted');
    assert.equal(nextMarkStatus('submitted', 'approve'), 'approved');
    assert.equal(nextMarkStatus('approved', 'publish'), 'published');
    assert.equal(studentCanSeeResults('published'), true);
    assert.equal(studentCanSeeResults('approved'), false);
  });

  it('submit → return → resubmit path', () => {
    assert.equal(nextMarkStatus('submitted', 'return'), 'returned');
    assert.equal(nextMarkStatus('returned', 'submit'), 'submitted');
    assert.equal(nextMarkStatus('draft', 'approve'), null);
  });

  it('rejects illegal transitions', () => {
    assert.equal(nextMarkStatus('published', 'submit'), null);
    assert.equal(nextMarkStatus('approved', 'return'), null);
    assert.equal(nextMarkStatus('draft', 'publish'), null);
    assert.equal(nextMarkStatus('submitted', 'publish'), null);
    assert.equal(nextMarkStatus('returned', 'approve'), null);
    assert.equal(nextMarkStatus('draft', 'unknown'), null);
  });

  it('exposes the full status catalogue', () => {
    assert.deepEqual([...MARK_STATUSES], [
      'draft',
      'submitted',
      'returned',
      'approved',
      'published',
    ]);
  });

  it('only published results are student-visible', () => {
    for (const st of MARK_STATUSES) {
      assert.equal(studentCanSeeResults(st), st === 'published');
    }
  });
});

describe('attendance session workflow', () => {
  it('mirrors marks edit rules', () => {
    assert.equal(canEditAttendanceSession('draft'), true);
    assert.equal(canEditAttendanceSession('returned'), true);
    assert.equal(canEditAttendanceSession('submitted'), false);
    assert.equal(canEditAttendanceSession('approved'), false);
  });

  it('exposes attendance status catalogue without publish', () => {
    assert.deepEqual([...ATTENDANCE_SESSION_STATUSES], [
      'draft',
      'submitted',
      'returned',
      'approved',
    ]);
    assert.ok(!ATTENDANCE_SESSION_STATUSES.includes('published'));
  });
});
