import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { computeGrade, gradeBadgeClass, DEFAULT_SCALE } from './grading.js';

describe('computeGrade', () => {
  it('maps boundary scores to correct letter grades', () => {
    assert.equal(computeGrade(100).grade, 'A');
    assert.equal(computeGrade(80).grade, 'A');
    assert.equal(computeGrade(79.99).grade, 'B');
    assert.equal(computeGrade(70).grade, 'B');
    assert.equal(computeGrade(69.99).grade, 'C');
    assert.equal(computeGrade(60).grade, 'C');
    assert.equal(computeGrade(59.99).grade, 'D');
    assert.equal(computeGrade(50).grade, 'D');
    assert.equal(computeGrade(49.99).grade, 'F');
    assert.equal(computeGrade(0).grade, 'F');
  });

  it('returns correct grade points', () => {
    assert.equal(computeGrade(85).grade_point, 4.0);
    assert.equal(computeGrade(75).grade_point, 3.0);
    assert.equal(computeGrade(65).grade_point, 2.0);
    assert.equal(computeGrade(55).grade_point, 1.0);
    assert.equal(computeGrade(40).grade_point, 0.0);
  });

  it('handles invalid / negative totals as Fail', () => {
    assert.equal(computeGrade(-5).grade, 'F');
    assert.equal(computeGrade(Number.NaN).grade, 'F');
  });

  it('clamps above 100 to A', () => {
    assert.equal(computeGrade(105).grade, 'A');
  });

  it('respects a custom scale', () => {
    const custom = [
      { min_score: 90, max_score: 100, grade: 'A+', grade_point: 4.0 },
      { min_score: 0, max_score: 89.99, grade: 'P', grade_point: 1.0 },
    ];
    assert.equal(computeGrade(92, custom).grade, 'A+');
    assert.equal(computeGrade(50, custom).grade, 'P');
  });
});

describe('gradeBadgeClass', () => {
  it('returns expected badge classes', () => {
    assert.equal(gradeBadgeClass('A'), 'badge-green');
    assert.equal(gradeBadgeClass('B'), 'badge-blue');
    assert.equal(gradeBadgeClass('C'), 'badge-amber');
    assert.equal(gradeBadgeClass('F'), 'badge-red');
  });
});

describe('DEFAULT_SCALE', () => {
  it('covers 0–100 without gaps at integer boundaries', () => {
    for (let s = 0; s <= 100; s += 1) {
      const { grade } = computeGrade(s, DEFAULT_SCALE);
      assert.ok(grade, `missing grade for score ${s}`);
    }
  });
});
