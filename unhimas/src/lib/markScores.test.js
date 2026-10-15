import test from 'node:test';
import assert from 'node:assert/strict';
import { hasInvalidMarkScore, mergeMarkScores } from './markScores.js';

test('merging a changed score preserves the other saved scores', () => {
  const merged = mergeMarkScores(
    { attendance_score: 4, coursework_score: 20, exam_score: 63 },
    { coursework_score: '22' },
  );

  assert.deepEqual(merged, {
    attendance_score: 4,
    coursework_score: '22',
    exam_score: 63,
    lecturer_comment: '',
  });
});

test('score validation accepts configured boundaries and rejects invalid values', () => {
  const limits = [5, 25, 70];
  assert.equal(hasInvalidMarkScore({
    attendance_score: 0,
    coursework_score: 25,
    exam_score: 70,
  }, ...limits), false);
  assert.equal(hasInvalidMarkScore({
    attendance_score: 'not a score',
    coursework_score: 25,
    exam_score: 70,
  }, ...limits), true);
  assert.equal(hasInvalidMarkScore({
    attendance_score: 5.01,
    coursework_score: 25,
    exam_score: 70,
  }, ...limits), true);
});
