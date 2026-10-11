/**
 * Formatting helpers for UNHIMAS School Management System
 * Anglophone Cameroonian Academic System
 */

/**
 * Formats a Date or timestamp string to Cameroon local display
 * @param {string|Date} date
 * @param {boolean} [includeTime=false]
 * @returns {string}
 */
export function formatDate(date, includeTime = false) {
  if (!date) return '—';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '—';

  const dateStr = d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  if (!includeTime) return dateStr;

  const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return `${dateStr} at ${timeStr}`;
}

/**
 * Formats a GPA value between 0.00 and 4.00
 * @param {number|string} gpa
 * @returns {string}
 */
export function formatGpa(gpa) {
  if (gpa === null || gpa === undefined || isNaN(Number(gpa))) return '0.00';
  return Number(gpa).toFixed(2);
}

/**
 * Formats hours into rounded duration string (e.g. "3.50 hrs")
 * @param {number|string} hours
 * @returns {string}
 */
export function formatHours(hours) {
  if (hours === null || hours === undefined || isNaN(Number(hours))) return '0.00 hrs';
  return `${Number(hours).toFixed(2)} hrs`;
}

/**
 * Returns letter grade badge CSS class name
 * @param {string} grade
 * @returns {string}
 */
export function getGradeBadgeClass(grade) {
  switch (grade?.toUpperCase()) {
    case 'A':
      return 'badge-green';
    case 'B':
      return 'badge-blue';
    case 'C':
      return 'badge-amber';
    case 'D':
      return 'badge-amber';
    case 'F':
      return 'badge-red';
    default:
      return 'badge-gray';
  }
}
