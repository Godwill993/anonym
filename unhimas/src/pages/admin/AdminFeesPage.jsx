import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  MdPayments,
  MdAdd,
  MdRefresh,
  MdCategory,
} from 'react-icons/md';
import AppLayout from '../../components/layout/AppLayout';
import Modal from '../../components/common/Modal';
import { useTranslation } from '../../i18n';
import { useToast } from '../../hooks/useToast';
import {
  listFeeCategories,
  listFeeStructures,
  listInvoices,
  upsertFeeCategory,
  upsertFeeStructure,
  formatXAF,
} from '../../services/feesService';

export default function AdminFeesPage() {
  const { translateText } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [showCatModal, setShowCatModal] = useState(false);
  const [showStructModal, setShowStructModal] = useState(false);
  const [catForm, setCatForm] = useState({ code: '', name: '', description: '', sort_order: 50 });
  const [structForm, setStructForm] = useState({
    fee_category_id: '',
    amount: '',
    description: '',
    is_mandatory: true,
  });

  const { data: categories = [], isLoading: catLoading } = useQuery({
    queryKey: ['fee-categories'],
    queryFn: () => listFeeCategories(),
  });

  const { data: structures = [], isLoading: structLoading } = useQuery({
    queryKey: ['fee-structures'],
    queryFn: () => listFeeStructures({ activeOnly: false }),
  });

  const { data: invoices = [], isLoading: invLoading } = useQuery({
    queryKey: ['admin-invoices'],
    queryFn: () => listInvoices({ limit: 40 }),
  });

  const catMutation = useMutation({
    mutationFn: upsertFeeCategory,
    onSuccess: () => {
      toast.success(translateText('Category saved'));
      setShowCatModal(false);
      setCatForm({ code: '', name: '', description: '', sort_order: 50 });
      queryClient.invalidateQueries({ queryKey: ['fee-categories'] });
    },
    onError: (e) => toast.error(e.message),
  });

  const structMutation = useMutation({
    mutationFn: upsertFeeStructure,
    onSuccess: () => {
      toast.success(translateText('Fee structure saved'));
      setShowStructModal(false);
      setStructForm({ fee_category_id: '', amount: '', description: '', is_mandatory: true });
      queryClient.invalidateQueries({ queryKey: ['fee-structures'] });
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <AppLayout pageTitle="Fees & Invoices">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">{translateText('Fees & Invoices')}</h1>
          <p className="page-subtitle">
            {translateText('Manage fee categories, structures, and student invoices')}
          </p>
        </div>
        <div className="page-header-actions" style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => setShowCatModal(true)}>
            <MdCategory /> {translateText('Category')}
          </button>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowStructModal(true)}>
            <MdAdd /> {translateText('Fee structure')}
          </button>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: ['fee-categories'] });
              queryClient.invalidateQueries({ queryKey: ['fee-structures'] });
              queryClient.invalidateQueries({ queryKey: ['admin-invoices'] });
            }}
          >
            <MdRefresh /> {translateText('Refresh')}
          </button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '1.35rem' }}>
        <div className="card-header">
          <span className="card-title">{translateText('Fee structures')}</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          {structLoading ? (
            <div className="empty-state">{translateText('Loading…')}</div>
          ) : structures.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-title">{translateText('No fee structures yet')}</div>
              <p className="empty-state-text">
                {translateText('Create a category, then add amount structures for tuition, registration, etc.')}
              </p>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>{translateText('Category')}</th>
                  <th>{translateText('Amount')}</th>
                  <th>{translateText('Scope')}</th>
                  <th>{translateText('Mandatory')}</th>
                  <th>{translateText('Active')}</th>
                </tr>
              </thead>
              <tbody>
                {structures.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>
                        {s.fee_categories?.name || '—'}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                        {s.fee_categories?.code}
                      </div>
                    </td>
                    <td style={{ fontWeight: 700 }}>{formatXAF(s.amount)}</td>
                    <td style={{ fontSize: '0.85rem' }}>
                      {s.batches?.name || s.departments?.name || s.academic_years?.name || translateText('Global')}
                    </td>
                    <td>{s.is_mandatory ? translateText('Yes') : translateText('No')}</td>
                    <td>{s.is_active ? '✓' : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <MdPayments /> {translateText('Recent invoices')}
          </span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          {invLoading ? (
            <div className="empty-state">{translateText('Loading…')}</div>
          ) : invoices.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-title">{translateText('No invoices')}</div>
              <p className="empty-state-text">
                {translateText('Issue invoices to students from the student record or bulk tools (coming next).')}
              </p>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>{translateText('Invoice')}</th>
                  <th>{translateText('Student')}</th>
                  <th>{translateText('Status')}</th>
                  <th>{translateText('Total')}</th>
                  <th>{translateText('Paid')}</th>
                  <th>{translateText('Balance')}</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id}>
                    <td style={{ fontWeight: 600 }}>{inv.invoice_number}</td>
                    <td>
                      {inv.students
                        ? `${inv.students.first_name} ${inv.students.last_name}`
                        : '—'}
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                        {inv.students?.matricule}
                      </div>
                    </td>
                    <td>{inv.status}</td>
                    <td>{formatXAF(inv.total_amount)}</td>
                    <td>{formatXAF(inv.amount_paid)}</td>
                    <td style={{ fontWeight: 700 }}>{formatXAF(inv.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showCatModal && (
        <Modal title={translateText('New fee category')} onClose={() => setShowCatModal(false)}>
          <form
            className="form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              catMutation.mutate({
                code: catForm.code.trim().toUpperCase(),
                name: catForm.name.trim(),
                description: catForm.description || null,
                sort_order: Number(catForm.sort_order) || 50,
              });
            }}
          >
            <div className="form-group">
              <label>Code</label>
              <input
                className="form-control"
                value={catForm.code}
                onChange={(e) => setCatForm((f) => ({ ...f, code: e.target.value }))}
                required
                placeholder="TUITION"
              />
            </div>
            <div className="form-group">
              <label>{translateText('Name')}</label>
              <input
                className="form-control"
                value={catForm.name}
                onChange={(e) => setCatForm((f) => ({ ...f, name: e.target.value }))}
                required
              />
            </div>
            <div className="form-group">
              <label>{translateText('Description')}</label>
              <textarea
                className="form-control"
                value={catForm.description}
                onChange={(e) => setCatForm((f) => ({ ...f, description: e.target.value }))}
                rows={2}
              />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-outline" onClick={() => setShowCatModal(false)}>
                {translateText('Cancel')}
              </button>
              <button type="submit" className="btn btn-primary" disabled={catMutation.isPending}>
                {translateText('Save')}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {showStructModal && (
        <Modal title={translateText('New fee structure')} onClose={() => setShowStructModal(false)}>
          <form
            className="form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              structMutation.mutate({
                fee_category_id: structForm.fee_category_id,
                amount: Number(structForm.amount),
                description: structForm.description || null,
                is_mandatory: !!structForm.is_mandatory,
                is_active: true,
              });
            }}
          >
            <div className="form-group">
              <label>{translateText('Category')}</label>
              <select
                className="form-control"
                value={structForm.fee_category_id}
                onChange={(e) => setStructForm((f) => ({ ...f, fee_category_id: e.target.value }))}
                required
              >
                <option value="">{translateText('Select…')}</option>
                {(categories.length ? categories : []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </select>
              {catLoading && (
                <small style={{ color: 'var(--color-text-muted)' }}>{translateText('Loading categories…')}</small>
              )}
            </div>
            <div className="form-group">
              <label>{translateText('Amount (XAF)')}</label>
              <input
                type="number"
                min="0"
                step="1"
                className="form-control"
                value={structForm.amount}
                onChange={(e) => setStructForm((f) => ({ ...f, amount: e.target.value }))}
                required
              />
            </div>
            <div className="form-group">
              <label>{translateText('Description')}</label>
              <input
                className="form-control"
                value={structForm.description}
                onChange={(e) => setStructForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="checkbox"
                checked={structForm.is_mandatory}
                onChange={(e) => setStructForm((f) => ({ ...f, is_mandatory: e.target.checked }))}
              />
              {translateText('Mandatory')}
            </label>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-outline" onClick={() => setShowStructModal(false)}>
                {translateText('Cancel')}
              </button>
              <button type="submit" className="btn btn-primary" disabled={structMutation.isPending}>
                {translateText('Save')}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </AppLayout>
  );
}
