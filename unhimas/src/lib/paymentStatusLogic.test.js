import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  canCompletePayment,
  amountsMatch,
  validatePaymentCompletion,
} from './paymentStatusLogic.js';

describe('canCompletePayment', () => {
  it('allows pending only', () => {
    assert.equal(canCompletePayment('pending').ok, true);
    assert.equal(canCompletePayment('completed').ok, false);
    assert.equal(canCompletePayment('failed').ok, false);
    assert.equal(canCompletePayment('').ok, false);
  });
});

describe('amountsMatch', () => {
  it('skips check when reported is omitted', () => {
    assert.equal(amountsMatch(50000, null).ok, true);
    assert.equal(amountsMatch(50000, undefined).ok, true);
  });

  it('accepts equal amounts and 1 XAF tolerance', () => {
    assert.equal(amountsMatch(50000, 50000).ok, true);
    assert.equal(amountsMatch(50000, 50001).ok, true);
    assert.equal(amountsMatch(50000, 49999).ok, true);
  });

  it('rejects larger mismatches', () => {
    assert.equal(amountsMatch(50000, 49000).ok, false);
  });
});

describe('validatePaymentCompletion', () => {
  it('accepts pending with matching amount', () => {
    const r = validatePaymentCompletion(
      { status: 'pending', amount: 25000 },
      { amount: 25000 },
    );
    assert.equal(r.ok, true);
  });

  it('rejects already completed', () => {
    const r = validatePaymentCompletion({ status: 'completed', amount: 1 });
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'already_completed');
  });

  it('rejects amount mismatch', () => {
    const r = validatePaymentCompletion(
      { status: 'pending', amount: 100 },
      { amount: 200 },
    );
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'amount_mismatch');
  });
});
