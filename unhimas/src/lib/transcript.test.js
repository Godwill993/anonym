import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTranscriptSummary } from './transcript.js';

const results = [
  {
    id: 'm1',
    total_score: 80,
    grade: 'A',
    grade_point: 4,
    attendance_score: 20,
    coursework_score: 30,
    exam_score: 30,
    mark_submissions: {
      batch_courses: {
        courses: { id: 'c1', code: 'CS 101', name: 'Programming', credit_units: 3 },
        semesters: {
          id: 's1', name: 'First Semester', number: 1,
          academic_years: { id: 'y1', name: '2025/2026' },
        },
      },
    },
  },
  {
    id: 'm2',
    total_score: 60,
    grade: 'C',
    grade_point: 2,
    attendance_score: 15,
    coursework_score: 20,
    exam_score: 25,
    mark_submissions: {
      batch_courses: {
        courses: { id: 'c2', code: 'CS 102', name: 'Data Structures', credit_units: 4 },
        semesters: {
          id: 's2', name: 'Second Semester', number: 2,
          academic_years: { id: 'y1', name: '2025/2026' },
        },
      },
    },
  },
  {
    id: 'm3',
    total_score: 45,
    grade: 'F',
    grade_point: 0,
    attendance_score: 10,
    coursework_score: 15,
    exam_score: 20,
    mark_submissions: {
      batch_courses: {
        courses: { id: 'c3', code: 'CS 103', name: 'Systems', credit_units: 3 },
        semesters: {
          id: 's2', name: 'Second Semester', number: 2,
          academic_years: { id: 'y1', name: '2025/2026' },
        },
      },
    },
  },
];

test('builds a complete transcript summary from published results', () => {
  const summary = buildTranscriptSummary(results);

  assert.equal(summary.totalCredits, 10);
  assert.equal(summary.overallGpa, 2);
  assert.equal(summary.completedCourses, 2);
  assert.equal(summary.failedCourses, 1);
  assert.equal(summary.semesters.length, 2);
  assert.equal(summary.semesters[1].semesterGpa, 1.14);
  assert.equal(summary.semesters[1].attemptedCredits, 7);
});

test('returns an empty summary when no published results exist', () => {
  const summary = buildTranscriptSummary([]);

  assert.deepEqual(summary, {
    totalCredits: 0,
    overallGpa: null,
    completedCourses: 0,
    failedCourses: 0,
    semesters: [],
  });
});
