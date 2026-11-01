import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateFeeClearance,
  normalizeFeeClearancePolicy,
} from './feeClearanceLogic.js';

describe('normalizeFeeClearancePolicy', () => {
  it('defaults to enabled with full payment required', () => {
    assert.deepEqual(normalizeFeeClearancePolicy(null), {
      enabled: true,
      minPaidRatio: 1,
    });
    assert.deepEqual(normalizeFeeClearancePolicy(undefined), {
      enabled: true,
      minPaidRatio: 1,
    });
  });

  it('honours enabled: false', () => {
    assert.equal(normalizeFeeClearancePolicy({ enabled: false }).enabled, false);
  });

  it('clamps invalid ratios to 1', () => {
    assert.equal(normalizeFeeClearancePolicy({ min_paid_ratio: 0 }).minPaidRatio, 1);
    assert.equal(normalizeFeeClearancePolicy({ min_paid_ratio: 1.5 }).minPaidRatio, 1);
    assert.equal(normalizeFeeClearancePolicy({ minPaidRatio: -0.2 }).minPaidRatio, 1);
  });

  it('accepts partial payment thresholds', () => {
    assert.equal(normalizeFeeClearancePolicy({ min_paid_ratio: 0.5 }).minPaidRatio, 0.5);
    assert.equal(normalizeFeeClearancePolicy({ minPaidRatio: 0.75 }).minPaidRatio, 0.75);
  });
});

describe('evaluateFeeClearance', () => {
  it('clears when policy is disabled regardless of balance', () => {
    const r = evaluateFeeClearance({
      enabled: false,
      outstanding: 500_000,
      totalInvoiced: 500_000,
      totalPaid: 0,
    });
    assert.equal(r.cleared, true);
    assert.equal(r.required, false);
  });

  it('clears when outstanding is zero', () => {
    const r = evaluateFeeClearance({
      outstanding: 0,
      totalInvoiced: 200_000,
      totalPaid: 200_000,
      minPaidRatio: 1,
    });
    assert.equal(r.cleared, true);
    assert.equal(r.required, true);
  });

  it('blocks when nothing paid and full clearance required', () => {
    const r = evaluateFeeClearance({
      outstanding: 150_000,
      totalInvoiced: 150_000,
      totalPaid: 0,
      minPaidRatio: 1,
    });
    assert.equal(r.cleared, false);
    assert.ok(r.paidRatio < 1);
  });

  it('clears at 50% paid when minPaidRatio is 0.5', () => {
    const r = evaluateFeeClearance({
      outstanding: 75_000,
      totalInvoiced: 150_000,
      totalPaid: 75_000,
      minPaidRatio: 0.5,
    });
    assert.equal(r.cleared, true);
    assert.ok(Math.abs(r.paidRatio - 0.5) < 1e-9);
  });

  it('blocks below partial threshold', () => {
    const r = evaluateFeeClearance({
      outstanding: 100_000,
      totalInvoiced: 150_000,
      totalPaid: 50_000,
      minPaidRatio: 0.5,
    });
    assert.equal(r.cleared, false);
  });

  it('treats zero invoiced as fully paid ratio', () => {
    const r = evaluateFeeClearance({
      outstanding: 0,
      totalInvoiced: 0,
      totalPaid: 0,
      minPaidRatio: 1,
    });
    assert.equal(r.cleared, true);
    assert.equal(r.paidRatio, 1);
  });

  it('handles floating-point boundary near threshold', () => {
    const r = evaluateFeeClearance({
      outstanding: 1,
      totalInvoiced: 3,
      totalPaid: 2,
      minPaidRatio: 2 / 3,
    });
    assert.equal(r.cleared, true);
  });
});
