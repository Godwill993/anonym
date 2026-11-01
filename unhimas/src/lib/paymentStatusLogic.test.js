import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  canCompletePayment,
  amountsMatch,
  validatePaymentCompletion,
  validatePaymentInitiation,
  normalizeCameroonPhone,
  isPlausibleCameroonMobile,
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

describe('Cameroon phone helpers', () => {
  it('strips country code and non-digits', () => {
    assert.equal(normalizeCameroonPhone('+237 6 70 00 00 00'), '670000000');
    assert.equal(normalizeCameroonPhone('237670000000'), '670000000');
    assert.equal(normalizeCameroonPhone('670000000'), '670000000');
  });

  it('accepts 9-digit mobiles starting with 6', () => {
    assert.equal(isPlausibleCameroonMobile('670000000'), true);
    assert.equal(isPlausibleCameroonMobile('+237670000000'), true);
    assert.equal(isPlausibleCameroonMobile('770000000'), false);
    assert.equal(isPlausibleCameroonMobile('67000'), false);
  });
});

describe('validatePaymentInitiation', () => {
  it('accepts a normal MoMo attempt with phone', () => {
    const r = validatePaymentInitiation({
      invoiceId: 'inv-1',
      studentId: 'stu-1',
      amount: 15000,
      method: 'mtn_momo',
      phoneNumber: '+237 670 00 00 00',
    });
    assert.equal(r.ok, true);
    assert.equal(r.amount, 15000);
    assert.equal(r.method, 'mtn_momo');
    assert.equal(r.phoneNumber, '670000000');
  });

  it('requires phone for MoMo methods', () => {
    const r = validatePaymentInitiation({
      invoiceId: 'inv-1',
      studentId: 'stu-1',
      amount: 15000,
      method: 'orange_money',
    });
    assert.equal(r.ok, false);
  });

  it('does not require phone for cash', () => {
    const r = validatePaymentInitiation({
      invoiceId: 'inv-1',
      studentId: 'stu-1',
      amount: 5000,
      method: 'cash',
    });
    assert.equal(r.ok, true);
    assert.equal(r.phoneNumber, null);
  });

  it('rejects missing invoice or student', () => {
    assert.equal(
      validatePaymentInitiation({ studentId: 's', amount: 1 }).ok,
      false,
    );
    assert.equal(
      validatePaymentInitiation({ invoiceId: 'i', amount: 1 }).ok,
      false,
    );
  });

  it('rejects non-positive amounts', () => {
    assert.equal(
      validatePaymentInitiation({
        invoiceId: 'i',
        studentId: 's',
        amount: 0,
      }).ok,
      false,
    );
    assert.equal(
      validatePaymentInitiation({
        invoiceId: 'i',
        studentId: 's',
        amount: -5,
      }).ok,
      false,
    );
  });

  it('normalizes unknown methods to other', () => {
    const r = validatePaymentInitiation({
      invoiceId: 'i',
      studentId: 's',
      amount: 100,
      method: 'crypto',
    });
    assert.equal(r.ok, true);
    assert.equal(r.method, 'other');
  });
});
