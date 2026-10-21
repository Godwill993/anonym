const pad2 = (n) => String(n).padStart(2, '0');

/** Split an ISO timestamp into local date + time for form inputs. */
export function splitLocalDateTime(iso) {
  if (!iso) return { date: '', time: '' };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: '', time: '' };
  return {
    date: `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`,
    time: `${pad2(d.getHours())}:${pad2(d.getMinutes())}`,
  };
}

/**
 * Build a local Date from separate date (YYYY-MM-DD) and time (HH:mm) fields.
 * Avoids browser quirks with datetime-local / Date.parse of timezone-less strings.
 */
export function combineLocalDateTime(date, time) {
  if (!date || !time) return null;
  const dm = String(date).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const tm = String(time).match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!dm || !tm) return null;
  const d = new Date(
    Number(dm[1]),
    Number(dm[2]) - 1,
    Number(dm[3]),
    Number(tm[1]),
    Number(tm[2]),
    Number(tm[3] || 0),
    0,
  );
  return Number.isNaN(d.getTime()) ? null : d;
}
