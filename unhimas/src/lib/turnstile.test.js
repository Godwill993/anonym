import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { requireTurnstileToken, isTurnstileEnabled, getTurnstileSiteKey } from './turnstile.js';

describe('turnstile helpers (no site key in unit env)', () => {
  it('reports disabled when no VITE_TURNSTILE_SITE_KEY', () => {
    // Under node --test, import.meta.env typically has no site key
    assert.equal(isTurnstileEnabled(), false);
    assert.equal(getTurnstileSiteKey(), '');
  });

  it('requireTurnstileToken allows empty token when disabled', () => {
    assert.equal(requireTurnstileToken('').ok, true);
    assert.equal(requireTurnstileToken(null).ok, true);
  });
});
