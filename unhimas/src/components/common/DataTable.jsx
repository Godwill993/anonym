import { useState, useMemo, useId } from 'react';
import {
  MdSearch,
  MdClose,
  MdChevronLeft,
  MdChevronRight,
  MdArrowUpward,
  MdArrowDownward,
  MdFileDownload,
  MdInbox,
} from 'react-icons/md';
import { useTranslation } from '../../i18n';
import { exportToCsv } from '../../utils/exportUtils';

export default function DataTable({
  columns = [],
  data = [],
  searchPlaceholder = 'Search records...',
  searchField = null,
  emptyTitle = 'No records found',
  emptySubtitle = 'There are no items to display yet.',
  pageSize = 10,
  actionButton = null,
  exportable = false,
  exportFileName = 'export',
  enableSorting = true,
}) {
  const { language, translateText } = useTranslation();
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage, setPerPage] = useState(pageSize);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const searchId = useId();
  const regionId = useId();

  const filteredData = useMemo(() => {
    if (!search.trim()) return data;
    const term = search.toLowerCase();
    return data.filter((item) => {
      if (searchField && typeof searchField === 'function') {
        return searchField(item, term);
      }
      return Object.values(item).some((val) => {
        if (val === null || val === undefined) return false;
        if (typeof val === 'string') return val.toLowerCase().includes(term);
        if (typeof val === 'number') return String(val).includes(term);
        if (typeof val === 'object') {
          return Object.values(val).some(
            (nested) =>
              nested &&
              typeof nested === 'string' &&
              nested.toLowerCase().includes(term),
          );
        }
        return false;
      });
    });
  }, [data, search, searchField]);

  const sortedData = useMemo(() => {
    if (!sortConfig.key) return filteredData;
    const { key, direction } = sortConfig;
    const col = columns.find((c) => (c.accessor || c.key) === key);

    return [...filteredData].sort((a, b) => {
      let valA = a[key];
      let valB = b[key];

      if (col && typeof col.sortValue === 'function') {
        valA = col.sortValue(a);
        valB = col.sortValue(b);
      }

      if (valA === valB) return 0;
      if (valA === null || valA === undefined) return 1;
      if (valB === null || valB === undefined) return -1;

      const comparison =
        typeof valA === 'number' && typeof valB === 'number'
          ? valA - valB
          : String(valA).localeCompare(String(valB), undefined, { numeric: true });

      return direction === 'asc' ? comparison : -comparison;
    });
  }, [filteredData, sortConfig, columns]);

  const totalPages = Math.ceil(sortedData.length / perPage) || 1;
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * perPage;
    return sortedData.slice(start, start + perPage);
  }, [sortedData, currentPage, perPage]);

  const handleSearchChange = (e) => {
    setSearch(e.target.value);
    setCurrentPage(1);
  };

  const handleClearSearch = () => {
    setSearch('');
    setCurrentPage(1);
  };

  const handleHeaderClick = (col) => {
    if (!enableSorting || col.sortable === false) return;
    const colKey = col.accessor || col.key;
    if (!colKey) return;

    setSortConfig((prev) => {
      if (prev.key === colKey) {
        if (prev.direction === 'asc') return { key: colKey, direction: 'desc' };
        return { key: null, direction: 'asc' };
      }
      return { key: colKey, direction: 'asc' };
    });
    setCurrentPage(1);
  };

  const handleExportCsv = () => {
    if (!sortedData.length) return;
    const exportHeaders = columns
      .filter((c) => c.header && (c.accessor || c.exportKey))
      .map((c) => ({
        label: translateText(c.header),
        key: c.exportKey || c.accessor,
      }));
    exportToCsv(exportFileName, exportHeaders, sortedData);
  };

  return (
    <div className="card">
      <div className="card-header" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ position: 'relative', minWidth: '240px', flex: '1 1 220px' }}>
          <label htmlFor={searchId} className="sr-only">
            {translateText(searchPlaceholder)}
          </label>
          <MdSearch
            aria-hidden="true"
            style={{
              position: 'absolute',
              left: '0.75rem',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--color-text-muted)',
              fontSize: '1.15rem',
              pointerEvents: 'none',
            }}
          />
          <input
            id={searchId}
            type="search"
            className="form-input"
            style={{
              paddingLeft: '2.25rem',
              paddingRight: search ? '2rem' : '0.875rem',
              height: '38px',
            }}
            placeholder={translateText(searchPlaceholder)}
            value={search}
            onChange={handleSearchChange}
            aria-label={translateText(searchPlaceholder)}
          />
          {search && (
            <button
              type="button"
              onClick={handleClearSearch}
              style={{
                position: 'absolute',
                right: '0.6rem',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                color: 'var(--color-text-muted)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                padding: '2px',
                borderRadius: '50%',
              }}
              title={translateText('Clear search')}
              aria-label={translateText('Clear search')}
            >
              <MdClose size={16} aria-hidden="true" />
            </button>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          {exportable && (
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={handleExportCsv}
              disabled={sortedData.length === 0}
              title={translateText('Export table to CSV')}
            >
              <MdFileDownload aria-hidden="true" /> {translateText('Export CSV')}
            </button>
          )}
          {actionButton && <div>{actionButton}</div>}
        </div>
      </div>

      <div
        className="table-wrapper"
        role="region"
        aria-labelledby={regionId}
        id={regionId}
      >
        <table className="data-table">
          <caption className="sr-only">{translateText('Data table')}</caption>
          <thead>
            <tr>
              {columns.map((col, idx) => {
                const colKey = col.accessor || col.key;
                const isSortable = enableSorting && col.sortable !== false && Boolean(colKey);
                const isSorted = sortConfig.key === colKey;
                const ariaSort = isSorted
                  ? sortConfig.direction === 'asc'
                    ? 'ascending'
                    : 'descending'
                  : isSortable
                    ? 'none'
                    : undefined;

                return (
                  <th
                    key={col.key || col.accessor || idx}
                    style={col.style}
                    aria-sort={ariaSort}
                    scope="col"
                  >
                    {isSortable ? (
                      <button
                        type="button"
                        className="table-sort-btn"
                        onClick={() => handleHeaderClick(col)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          background: 'none',
                          border: 'none',
                          padding: 0,
                          font: 'inherit',
                          fontWeight: 700,
                          color: 'inherit',
                          cursor: 'pointer',
                          textTransform: 'inherit',
                          letterSpacing: 'inherit',
                        }}
                      >
                        <span>{translateText(col.header)}</span>
                        <span
                          aria-hidden="true"
                          style={{
                            fontSize: '0.85rem',
                            color: isSorted
                              ? 'var(--color-secondary)'
                              : 'var(--color-text-muted)',
                          }}
                        >
                          {isSorted ? (
                            sortConfig.direction === 'asc' ? (
                              <MdArrowUpward />
                            ) : (
                              <MdArrowDownward />
                            )
                          ) : (
                            <span style={{ opacity: 0.35 }}>↕</span>
                          )}
                        </span>
                      </button>
                    ) : (
                      <span>{translateText(col.header)}</span>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {paginatedData.length === 0 ? (
              <tr>
                <td colSpan={columns.length} style={{ textAlign: 'center', padding: '3.5rem 1.5rem' }}>
                  <div className="empty-state" style={{ padding: '0.5rem' }}>
                    <MdInbox
                      className="empty-state-icon"
                      style={{ fontSize: '2.5rem', opacity: 0.45 }}
                      aria-hidden="true"
                    />
                    <div className="empty-state-title" style={{ marginTop: '0.5rem' }}>
                      {translateText(search ? 'No matching records found' : emptyTitle)}
                    </div>
                    <div className="empty-state-text">
                      {translateText(
                        search
                          ? 'Try adjusting your search criteria or clearing filters.'
                          : emptySubtitle,
                      )}
                    </div>
                    {search && (
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={handleClearSearch}
                        style={{ marginTop: '0.75rem' }}
                      >
                        {translateText('Clear search')}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              paginatedData.map((row, rowIdx) => (
                <tr key={row.id || rowIdx}>
                  {columns.map((col, colIdx) => (
                    <td key={col.key || col.accessor || colIdx} style={col.style || {}}>
                      {col.render ? col.render(row, rowIdx) : row[col.accessor]}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {sortedData.length > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.875rem 1.25rem',
            borderTop: '1px solid var(--color-border)',
            fontSize: '0.8125rem',
            color: 'var(--color-text-muted)',
            flexWrap: 'wrap',
            gap: '0.75rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <div aria-live="polite">
              {language === 'fr'
                ? `Affichage de ${(currentPage - 1) * perPage + 1} à ${Math.min(
                    currentPage * perPage,
                    sortedData.length,
                  )} sur ${sortedData.length} enregistrements`
                : `Showing ${(currentPage - 1) * perPage + 1} to ${Math.min(
                    currentPage * perPage,
                    sortedData.length,
                  )} of ${sortedData.length} records`}
            </div>

            {sortedData.length > 10 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <label htmlFor={`${searchId}-perpage`} style={{ fontSize: '0.75rem' }}>
                  {translateText('Rows per page:')}
                </label>
                <select
                  id={`${searchId}-perpage`}
                  className="form-input"
                  style={{
                    height: '30px',
                    padding: '0.1rem 0.5rem',
                    width: 'auto',
                    fontSize: '0.75rem',
                  }}
                  value={perPage}
                  onChange={(e) => {
                    setPerPage(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            )}
          </div>

          {totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                aria-label={translateText('Previous page')}
              >
                <MdChevronLeft aria-hidden="true" /> {translateText('Prev')}
              </button>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '0 0.5rem',
                  fontWeight: 600,
                  color: 'var(--color-text)',
                  fontSize: '0.8125rem',
                }}
                aria-current="page"
              >
                {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                aria-label={translateText('Next page')}
              >
                {translateText('Next')} <MdChevronRight aria-hidden="true" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
