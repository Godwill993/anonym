/**
 * Safe CSV export utility for reports and data tables.
 */

export function exportToCsv(filename, headers, rows) {
  if (!rows || rows.length === 0) return;

  const escapeCell = (cell) => {
    if (cell === null || cell === undefined) return '""';
    const str = String(cell).replace(/"/g, '""');
    return `"${str}"`;
  };

  const headerLine = headers.map((h) => escapeCell(h.label || h.title || h)).join(',');
  const rowLines = rows.map((row) => {
    if (Array.isArray(row)) {
      return row.map(escapeCell).join(',');
    }
    return headers
      .map((h) => {
        const key = h.key || h.id || h;
        return escapeCell(row[key]);
      })
      .join(',');
  });

  const csvContent = [headerLine, ...rowLines].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename.replace(/\.csv$/, '')}_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
