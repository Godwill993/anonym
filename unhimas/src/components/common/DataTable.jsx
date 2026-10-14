import { useState, useMemo } from 'react';
import { MdSearch, MdChevronLeft, MdChevronRight } from 'react-icons/md';
import { useTranslation } from '../../i18n';

export default function DataTable({
  columns = [],
  data = [],
  searchPlaceholder = 'Search records...',
  searchField = null,
  emptyTitle = 'No records found',
  emptySubtitle = 'There are no items to display yet.',
  pageSize = 10,
  actionButton = null,
}) {
  const { language, translateText } = useTranslation();
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // Filter
  const filteredData = useMemo(() => {
    if (!search.trim()) return data;
    const term = search.toLowerCase();
    return data.filter((item) => {
      if (searchField && typeof searchField === 'function') {
        return searchField(item, term);
      }
      return Object.values(item).some((val) => {
        if (typeof val === 'string') return val.toLowerCase().includes(term);
        if (typeof val === 'number') return String(val).includes(term);
        return false;
      });
    });
  }, [data, search, searchField]);

  // Pagination
  const totalPages = Math.ceil(filteredData.length / pageSize) || 1;
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredData.slice(start, start + pageSize);
  }, [filteredData, currentPage, pageSize]);

  const handleSearchChange = (e) => {
    setSearch(e.target.value);
    setCurrentPage(1);
  };

  return (
    <div className="card">
      <div className="card-header" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ position: 'relative', minWidth: '240px', flex: '1 1 200px' }}>
          <MdSearch
            style={{
              position: 'absolute',
              left: '0.75rem',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--color-text-muted)',
              fontSize: '1.1rem',
            }}
          />
          <input
            type="text"
            className="form-input"
            style={{ paddingLeft: '2.25rem', height: '38px' }}
            placeholder={translateText(searchPlaceholder)}
            value={search}
            onChange={handleSearchChange}
          />
        </div>
        {actionButton && <div>{actionButton}</div>}
      </div>

      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              {columns.map((col, idx) => (
                <th key={col.key || idx} style={col.style || {}}>
                  {translateText(col.header)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginatedData.length === 0 ? (
              <tr>
                <td colSpan={columns.length} style={{ textAlign: 'center', padding: '3rem 1.5rem' }}>
                  <div className="empty-state" style={{ padding: '1rem' }}>
                    <div className="empty-state-title">{translateText(emptyTitle)}</div>
                    <div className="empty-state-text">{translateText(emptySubtitle)}</div>
                  </div>
                </td>
              </tr>
            ) : (
              paginatedData.map((row, rowIdx) => (
                <tr key={row.id || rowIdx}>
                  {columns.map((col, colIdx) => (
                    <td key={col.key || colIdx} style={col.style || {}}>
                      {col.render ? col.render(row, rowIdx) : row[col.accessor]}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {filteredData.length > pageSize && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.75rem 1.25rem',
            borderTop: '1px solid var(--color-border)',
            fontSize: '0.8125rem',
            color: 'var(--color-text-muted)',
          }}
        >
          <div>
            {language === 'fr'
              ? `Affichage de ${(currentPage - 1) * pageSize + 1} à ${Math.min(currentPage * pageSize, filteredData.length)} sur ${filteredData.length} enregistrements`
              : `Showing ${(currentPage - 1) * pageSize + 1} to ${Math.min(currentPage * pageSize, filteredData.length)} of ${filteredData.length} records`}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              className="btn btn-outline btn-sm"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            >
              <MdChevronLeft /> {translateText('Prev')}
            </button>
            <span style={{ display: 'flex', alignItems: 'center', padding: '0 0.5rem', fontWeight: 600 }}>
              {currentPage} / {totalPages}
            </span>
            <button
              className="btn btn-outline btn-sm"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            >
              {translateText('Next')} <MdChevronRight />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
