export function mergeMarkScores(savedScores, localScores) {
  return {
    attendance_score: 0,
    coursework_score: 0,
    exam_score: 0,
    lecturer_comment: '',
    ...savedScores,
    ...localScores,
  };
}

export function hasInvalidMarkScore(scores, attendanceMax, courseworkMax, examMax) {
  return [
    [scores.attendance_score, attendanceMax],
    [scores.coursework_score, courseworkMax],
    [scores.exam_score, examMax],
  ].some(([value, max]) => {
    const score = Number(value);
    return !Number.isFinite(score) || score < 0 || score > max;
  });
}
