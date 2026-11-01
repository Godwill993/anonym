import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isHoneypotTriggered,
  isSubmitTooFast,
  isValidEmail,
  validateAdmissionPayload,
  sanitizeAdmissionPayload,
  MIN_FORM_MS,
} from './publicFormGuard.js';

describe('isHoneypotTriggered', () => {
  it('returns false when honeypot is empty', () => {
    assert.equal(isHoneypotTriggered({ website: '' }), false);
    assert.equal(isHoneypotTriggered({ website: '   ' }), false);
    assert.equal(isHoneypotTriggered({}), false);
  });

  it('returns true when honeypot is filled', () => {
    assert.equal(isHoneypotTriggered({ website: 'http://spam.test' }), true);
  });
});

describe('isSubmitTooFast', () => {
  it('flags submits faster than MIN_FORM_MS', () => {
    const opened = 1_000_000;
    assert.equal(isSubmitTooFast(opened, opened + 500), true);
    assert.equal(isSubmitTooFast(opened, opened + MIN_FORM_MS), false);
    assert.equal(isSubmitTooFast(opened, opened + MIN_FORM_MS + 1), false);
  });
});

describe('isValidEmail', () => {
  it('accepts common valid addresses', () => {
    assert.equal(isValidEmail('a@b.co'), true);
    assert.equal(isValidEmail('student.name@unhimas.cm'), true);
  });

  it('rejects invalid shapes', () => {
    assert.equal(isValidEmail(''), false);
    assert.equal(isValidEmail('nope'), false);
    assert.equal(isValidEmail('@missing.local'), false);
    assert.equal(isValidEmail('missing@'), false);
  });
});

describe('validateAdmissionPayload', () => {
  it('requires first name, last name, and email', () => {
    assert.equal(validateAdmissionPayload({}).ok, false);
    assert.equal(
      validateAdmissionPayload({
        first_name: 'Ada',
        last_name: 'Lovelace',
        email: 'ada@example.com',
      }).ok,
      true,
    );
  });
});

describe('sanitizeAdmissionPayload', () => {
  it('strips honeypot and normalizes email', () => {
    const clean = sanitizeAdmissionPayload({
      website: 'http://bot',
      first_name: '  Ada ',
      last_name: 'Lovelace',
      email: 'Ada@Example.COM',
      middle_name: '',
    });
    assert.equal('website' in clean, false);
    assert.equal(clean.first_name, 'Ada');
    assert.equal(clean.email, 'ada@example.com');
    assert.equal(clean.middle_name, null);
  });
});
