import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isHoneypotTriggered,
  isSubmitTooFast,
  isValidEmail,
  validateAdmissionPayload,
  sanitizeAdmissionPayload,
  normalizeApplicationNumber,
  isPlausibleApplicationNumber,
  validateApplicationLookup,
  normalizeMatricule,
  isPlausibleMatricule,
  validateResultsLookup,
  checkPublicLookupThrottle,
  recordPublicLookupAttempt,
  MIN_FORM_MS,
  PUBLIC_LOOKUP_COOLDOWN_MS,
} from './publicFormGuard.js';

function memoryStore(seed = {}) {
  const map = new Map(Object.entries(seed));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
  };
}

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

describe('application number helpers', () => {
  it('normalizes case and whitespace', () => {
    assert.equal(normalizeApplicationNumber('  app-2026-01000 '), 'APP-2026-01000');
  });

  it('accepts plausible APP numbers', () => {
    assert.equal(isPlausibleApplicationNumber('APP-2026-01000'), true);
    assert.equal(isPlausibleApplicationNumber('app-01000'), true);
  });

  it('rejects garbage numbers', () => {
    assert.equal(isPlausibleApplicationNumber('x'), false);
    assert.equal(isPlausibleApplicationNumber('12345'), false);
    assert.equal(isPlausibleApplicationNumber(''), false);
  });
});

describe('validateApplicationLookup', () => {
  it('lowercases email and uppercases application number', () => {
    const r = validateApplicationLookup(' app-2026-01000 ', 'Ada@Example.COM');
    assert.equal(r.ok, true);
    assert.equal(r.number, 'APP-2026-01000');
    assert.equal(r.email, 'ada@example.com');
  });

  it('rejects missing or invalid fields', () => {
    assert.equal(validateApplicationLookup('', 'a@b.co').ok, false);
    assert.equal(validateApplicationLookup('APP-2026-1', 'not-an-email').ok, false);
    assert.equal(validateApplicationLookup('nope', 'a@b.co').ok, false);
  });
});

describe('matricule helpers', () => {
  it('normalizes case and strips spaces', () => {
    assert.equal(normalizeMatricule('  unh/2026/swe/001 '), 'UNH/2026/SWE/001');
    assert.equal(normalizeMatricule('unh 2026 001'), 'UNH2026001');
  });

  it('accepts common UNHIMAS shapes', () => {
    assert.equal(isPlausibleMatricule('UNH202612345'), true);
    assert.equal(isPlausibleMatricule('UNH/2026/SWE/001'), true);
    assert.equal(isPlausibleMatricule('UNH-2026-001'), true);
  });

  it('rejects too-short or empty values', () => {
    assert.equal(isPlausibleMatricule(''), false);
    assert.equal(isPlausibleMatricule('AB'), false);
  });
});

describe('validateResultsLookup', () => {
  it('returns normalized matricule on success', () => {
    const r = validateResultsLookup(' unh/2026/swe/001 ');
    assert.equal(r.ok, true);
    assert.equal(r.matricule, 'UNH/2026/SWE/001');
  });

  it('rejects invalid matricules', () => {
    assert.equal(validateResultsLookup('').ok, false);
    assert.equal(validateResultsLookup('??').ok, false);
  });
});

describe('public lookup throttle', () => {
  it('allows first attempt and blocks within cooldown', () => {
    const store = memoryStore();
    const key = 'test-key';
    const t0 = 1_000_000;
    assert.equal(checkPublicLookupThrottle(store, key, t0).allowed, true);
    recordPublicLookupAttempt(store, key, t0);
    const blocked = checkPublicLookupThrottle(store, key, t0 + 1000);
    assert.equal(blocked.allowed, false);
    assert.ok(blocked.retryAfterMs > 0);
    const allowed = checkPublicLookupThrottle(
      store,
      key,
      t0 + PUBLIC_LOOKUP_COOLDOWN_MS,
    );
    assert.equal(allowed.allowed, true);
  });

  it('allows when store is missing', () => {
    assert.equal(checkPublicLookupThrottle(null, 'k').allowed, true);
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
