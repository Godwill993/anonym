import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  canEditMarks,
  canEditAttendanceSession,
  nextMarkStatus,
  studentCanSeeResults,
} from './marksWorkflow.js';

describe('marks workflow', () => {
  it('allows edit only in draft or returned', () => {
    assert.equal(canEditMarks('draft'), true);
    assert.equal(canEditMarks('returned'), true);
    assert.equal(canEditMarks('submitted'), false);
    assert.equal(canEditMarks('approved'), false);
    assert.equal(canEditMarks('published'), false);
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
});

describe('attendance session workflow', () => {
  it('mirrors marks edit rules', () => {
    assert.equal(canEditAttendanceSession('draft'), true);
    assert.equal(canEditAttendanceSession('returned'), true);
    assert.equal(canEditAttendanceSession('submitted'), false);
    assert.equal(canEditAttendanceSession('approved'), false);
  });
});
