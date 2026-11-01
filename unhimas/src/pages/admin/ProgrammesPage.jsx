import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  MdAdd,
  MdSchool,
  MdEdit,
  MdToggleOn,
  MdToggleOff,
  MdSearch,
  MdRoute,
} from 'react-icons/md';
import AppLayout from '../../components/layout/AppLayout';
import Modal from '../../components/common/Modal';
import RowActionsMenu from '../../components/common/RowActionsMenu';
import { toast } from '../../components/common/Toast';
import { useTranslation } from '../../i18n';
import {
  getProgrammes,
  createProgramme,
  updateProgramme,
  getProgrammeProgressions,
} from '../../services/academicService';

const AWARDS = [
  { value: 'HND', label: 'HND' },
  { value: 'BTECH', label: 'Bachelor of Technology' },
  { value: 'MTECH', label: 'Masters of Technology' },
  { value: 'BSC', label: 'Bachelor of Science' },
  { value: 'MSC', label: 'Masters of Science' },
];

const TRACKS = [
  { value: 'technology', label: 'Technology' },
  { value: 'science', label: 'Science' },
];

const emptyForm = {
  code: '',
  name: '',
  award: 'HND',
  track: 'technology',
  duration_years: 2,
  description: '',
  sort_order: 0,
};

export default function ProgrammesPage() {
  const { translateText: tx } = useTranslation();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState(emptyForm);

  const { data: programmes = [], isLoading } = useQuery({
    queryKey: ['admin-programmes'],
    queryFn: () => getProgrammes(),
  });

  const { data: progressions = [] } = useQuery({
    queryKey: ['admin-programme-progressions'],
    queryFn: getProgrammeProgressions,
  });

  const createMutation = useMutation({
    mutationFn: createProgramme,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-programmes'] });
      toast.success(tx('Programme created'));
      setIsModalOpen(false);
    },
    onError: (err) => toast.error(err.message || tx('Failed to create programme')),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }) => updateProgramme(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-programmes'] });
      toast.success(tx('Programme updated'));
      setIsModalOpen(false);
      setEditing(null);
    },
    onError: (err) => toast.error(err.message || tx('Failed to update programme')),
  });

  const handleOpenAdd = () => {
    setEditing(null);
    setFormData(emptyForm);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (row) => {
    setEditing(row);
    setFormData({
      code: row.code || '',
      name: row.name || '',
      award: row.award || 'HND',
      track: row.track || 'technology',
      duration_years: row.duration_years ?? 2,
      description: row.description || '',
      sort_order: row.sort_order ?? 0,
    });
    setIsModalOpen(true);
  };

  const handleToggle = (row) => {
    updateMutation.mutate({ id: row.id, updates: { is_active: !row.is_active } });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.code.trim() || !formData.name.trim()) {
      toast.error(tx('Code and name are required'));
      return;
    }
    if (!formData.duration_years || Number(formData.duration_years) <= 0) {
      toast.error(tx('Duration must be greater than zero'));
      return;
    }
    if (editing) {
      updateMutation.mutate({ id: editing.id, updates: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const filtered = programmes.filter((p) => {
    const s = search.toLowerCase();
    return (
      p.name?.toLowerCase().includes(s) ||
      p.code?.toLowerCase().includes(s) ||
      p.award?.toLowerCase().includes(s) ||
      p.track?.toLowerCase().includes(s)
    );
  });

  const awardLabel = (a) => AWARDS.find((x) => x.value === a)?.label || a;
  const conditionLabel = (c) =>
    c === 'pass' ? tx('Pass') : c === 'fail_or_exit' ? tx('Fail / exit') : c;

  return (
    <AppLayout pageTitle={tx('Programmes')}>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">{tx('Programmes')}</h1>
          <p className="page-subtitle">
            {tx('HND, B.Tech, M.Tech, B.Sc and M.Sc — Cameroon higher education model')}
          </p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-primary" onClick={handleOpenAdd} type="button">
            <MdAdd /> {tx('Add Programme')}
          </button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '1.25rem' }}>
        <div className="card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <MdRoute />
            <strong>{tx('Progression paths')}</strong>
          </div>
        </div>
        <div style={{ padding: '0.75rem 1rem' }}>
          {progressions.length === 0 ? (
            <p style={{ color: 'var(--color-text-muted)', margin: 0 }}>
              {tx('No progression rules seeded yet. Apply the programmes migration.')}
            </p>
          ) : (
            <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
              {progressions.map((pr) => (
                <li key={pr.id} style={{ marginBottom: '0.35rem' }}>
                  <code>{pr.from_programme?.code}</code>
                  {' → '}
                  <code>{pr.to_programme?.code}</code>
                  {' '}
                  <span className={`badge ${pr.condition === 'pass' ? 'badge-green' : 'badge-amber'}`}>
                    {conditionLabel(pr.condition)}
                  </span>
                  {pr.notes ? (
                    <span style={{ color: 'var(--color-text-muted)', marginLeft: '0.5rem' }}>
                      — {pr.notes}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          <p style={{ marginTop: '0.75rem', fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
            {tx('HND is 2 years by default; Biomedical departments use 3 years. Pass HND → B.Tech (1 yr) → M.Tech. Fail/exit HND → B.Sc → M.Sc.')}
          </p>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div style={{ position: 'relative', minWidth: '240px', flex: '1 1 200px' }}>
            <MdSearch
              style={{
                position: 'absolute',
                left: '0.75rem',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--color-text-muted)',
              }}
            />
            <input
              type="text"
              className="form-input"
              style={{ paddingLeft: '2.25rem' }}
              placeholder={tx('Search programmes...')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>{tx('Code')}</th>
                <th>{tx('Name')}</th>
                <th>{tx('Award')}</th>
                <th>{tx('Track')}</th>
                <th>{tx('Duration (years)')}</th>
                <th>{tx('Status')}</th>
                <th style={{ textAlign: 'right' }}>{tx('Actions')}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '3rem' }}>
                    {tx('Loading...')}
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '3rem' }}>
                    <div className="empty-state">
                      <MdSchool className="empty-state-icon" />
                      <div className="empty-state-title">{tx('No programmes')}</div>
                      <div className="empty-state-text">
                        {tx('Apply the programmes migration or add programmes manually.')}
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <code>{row.code}</code>
                    </td>
                    <td>
                      <strong>{row.name}</strong>
                      {row.description ? (
                        <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                          {row.description}
                        </div>
                      ) : null}
                    </td>
                    <td>{awardLabel(row.award)}</td>
                    <td>
                      <span className={`badge ${row.track === 'technology' ? 'badge-green' : 'badge-amber'}`}>
                        {row.track === 'technology' ? tx('Technology') : tx('Science')}
                      </span>
                    </td>
                    <td>
                      {row.code === 'HND' ? (
                        <span>
                          {row.duration_years}
                          <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>
                            {' '}
                            ({tx('3 yrs Biomedical')})
                          </span>
                        </span>
                      ) : (
                        row.duration_years
                      )}
                    </td>
                    <td>
                      <span className={`badge ${row.is_active !== false ? 'badge-green' : 'badge-gray'}`}>
                        {row.is_active !== false ? tx('Active') : tx('Inactive')}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <RowActionsMenu
                        ariaLabel={tx('Programme actions')}
                        items={[
                          {
                            id: 'edit',
                            label: tx('Edit'),
                            icon: <MdEdit />,
                            onClick: () => handleOpenEdit(row),
                          },
                          {
                            id: 'toggle',
                            label: row.is_active !== false ? tx('Deactivate') : tx('Activate'),
                            icon: row.is_active !== false ? <MdToggleOn /> : <MdToggleOff />,
                            onClick: () => handleToggle(row),
                          },
                        ]}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editing ? tx('Edit Programme') : tx('Add Programme')}
      >
        <form onSubmit={handleSubmit}>
          <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '0.75rem' }}>
            <div className="form-group">
              <label className="form-label">{tx('Code')} *</label>
              <input
                className="form-input"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                required
                disabled={Boolean(editing)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">{tx('Name')} *</label>
              <input
                className="form-input"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
          </div>
          <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
            <div className="form-group">
              <label className="form-label">{tx('Award')} *</label>
              <select
                className="form-input"
                value={formData.award}
                onChange={(e) => setFormData({ ...formData, award: e.target.value })}
                required
              >
                {AWARDS.map((a) => (
                  <option key={a.value} value={a.value}>
                    {a.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">{tx('Track')} *</label>
              <select
                className="form-input"
                value={formData.track}
                onChange={(e) => setFormData({ ...formData, track: e.target.value })}
                required
              >
                {TRACKS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">{tx('Duration (years)')} *</label>
              <input
                type="number"
                min={0.5}
                step={0.5}
                className="form-input"
                value={formData.duration_years}
                onChange={(e) => setFormData({ ...formData, duration_years: e.target.value })}
                required
              />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">{tx('Description')}</label>
            <textarea
              className="form-input"
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label className="form-label">{tx('Sort order')}</label>
            <input
              type="number"
              className="form-input"
              value={formData.sort_order}
              onChange={(e) => setFormData({ ...formData, sort_order: e.target.value })}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
            <button type="button" className="btn btn-outline" onClick={() => setIsModalOpen(false)}>
              {tx('Cancel')}
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {editing ? tx('Save Changes') : tx('Add Programme')}
            </button>
          </div>
        </form>
      </Modal>
    </AppLayout>
  );
}
