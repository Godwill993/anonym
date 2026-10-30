import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  MdPayments,
  MdAdd,
  MdRefresh,
  MdCategory,
  MdReceiptLong,
  MdGroups,
} from 'react-icons/md';
import AppLayout from '../../components/layout/AppLayout';
import Modal from '../../components/common/Modal';
import { useTranslation } from '../../i18n';
import { useToast } from '../../hooks/useToast';
import { getStudents } from '../../services/peopleService';
import { getBatches } from '../../services/academicService';
import {
  listFeeCategories,
  listFeeStructures,
  listInvoices,
  upsertFeeCategory,
  upsertFeeStructure,
  createInvoice,
  bulkCreateInvoices,
  formatXAF,
} from '../../services/feesService';

function statusBadgeClass(status) {
  const map = {
    draft: 'badge-muted',
    issued: 'badge-info',
    partially_paid: 'badge-warning',
    paid: 'badge-success',
    cancelled: 'badge-danger',
    waived: 'badge-muted',
  };
  return map[status] || 'badge-muted';
}

export default function AdminFeesPage() {
  const { translateText } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [showCatModal, setShowCatModal] = useState(false);
  const [showStructModal, setShowStructModal] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [catForm, setCatForm] = useState({ code: '', name: '', description: '', sort_order: 50 });
  const [structForm, setStructForm] = useState({
    fee_category_id: '',
    amount: '',
    description: '',
    is_mandatory: true,
  });
  const [invoiceForm, setInvoiceForm] = useState({
    student_id: '',
    structure_ids: [],
    notes: '',
    due_date: '',
  });
  const [bulkForm, setBulkForm] = useState({
    batch_id: '',
    structure_ids: [],
    notes: '',
    due_date: '',
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

  const { data: students = [] } = useQuery({
    queryKey: ['students-for-invoice'],
    queryFn: () => getStudents({}),
    enabled: showInvoiceModal,
  });

  const { data: batches = [] } = useQuery({
    queryKey: ['batches-for-bulk'],
    queryFn: () => getBatches(),
    enabled: showBulkModal,
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

  const invoiceMutation = useMutation({
    mutationFn: createInvoice,
    onSuccess: (inv) => {
      toast.success(
        translateText('Invoice issued') +
          (inv?.invoice_number ? `: ${inv.invoice_number}` : ''),
      );
      setShowInvoiceModal(false);
      setInvoiceForm({ student_id: '', structure_ids: [], notes: '', due_date: '' });
      queryClient.invalidateQueries({ queryKey: ['admin-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['student-fee-balance'] });
      queryClient.invalidateQueries({ queryKey: ['student-invoices'] });
    },
    onError: (e) => toast.error(e.message),
  });

  const bulkMutation = useMutation({
    mutationFn: bulkCreateInvoices,
    onSuccess: (summary) => {
      toast.success(
        `${translateText('Bulk complete')}: ${summary.created}/${summary.totalStudents} ${translateText('invoices created')}` +
          (summary.failed ? ` (${summary.failed} ${translateText('failed')})` : ''),
      );
      setShowBulkModal(false);
      setBulkForm({ batch_id: '', structure_ids: [], notes: '', due_date: '' });
      queryClient.invalidateQueries({ queryKey: ['admin-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['student-fee-balance'] });
    },
    onError: (e) => toast.error(e.message),
  });

  const activeStructures = structures.filter((s) => s.is_active);

  const toggleStructure = (id, formSetter) => {
    formSetter((f) => {
      const set = new Set(f.structure_ids);
      if (set.has(id)) set.delete(id);
      else set.add(id);
      return { ...f, structure_ids: [...set] };
    });
  };

  const submitInvoice = (e) => {
    e.preventDefault();
    if (!invoiceForm.student_id) {
      toast.error(translateText('Select a student'));
      return;
    }
    if (!invoiceForm.structure_ids.length) {
      toast.error(translateText('Select at least one fee structure'));
      return;
    }
    const items = activeStructures
      .filter((s) => invoiceForm.structure_ids.includes(s.id))
      .map((s) => ({
        fee_structure_id: s.id,
        fee_category_id: s.fee_category_id,
        description: s.description || s.fee_categories?.name || 'Fee',
        quantity: 1,
        unit_amount: Number(s.amount),
      }));
    invoiceMutation.mutate({
      studentId: invoiceForm.student_id,
      items,
      notes: invoiceForm.notes || null,
      dueDate: invoiceForm.due_date || null,
    });
  };

  const submitBulk = (e) => {
    e.preventDefault();
    if (!bulkForm.batch_id) {
      toast.error(translateText('Select a batch'));
      return;
    }
    if (!bulkForm.structure_ids.length) {
      toast.error(translateText('Select at least one fee structure'));
      return;
    }
    bulkMutation.mutate({
      batchId: bulkForm.batch_id,
      structureIds: bulkForm.structure_ids,
      notes: bulkForm.notes || null,
      dueDate: bulkForm.due_date || null,
    });
  };

  const structureChecklist = (selectedIds, onToggle) => (
    <div
      style={{
        maxHeight: 200,
        overflowY: 'auto',
        border: '1px solid rgba(15, 23, 42, 0.08)',
        borderRadius: 12,
        padding: 8,
        background: 'var(--color-bg)',
      }}
    >
      {activeStructures.length === 0 ? (
        <p className="entity-card-meta" style={{ padding: 8 }}>
          {translateText('No active fee structures. Create one first.')}
        </p>
      ) : (
        activeStructures.map((s) => (
          <label
            key={s.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 10px',
              cursor: 'pointer',
              borderRadius: 8,
            }}
          >
            <input
              type="checkbox"
              checked={selectedIds.includes(s.id)}
              onChange={() => onToggle(s.id)}
            />
            <span style={{ flex: 1, fontSize: '0.875rem' }}>
              {s.fee_categories?.name || s.description || 'Fee'}
            </span>
            <span style={{ fontWeight: 700, fontSize: '0.875rem' }}>{formatXAF(s.amount)}</span>
          </label>
        ))
      )}
    </div>
  );

  return (
    <AppLayout pageTitle="Fees & Invoices">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">{translateText('Fees & Invoices')}</h1>
          <p className="page-subtitle">
            {translateText('Manage fee categories, structures, and student invoices')}
          </p>
        </div>
        <div className="page-header-actions">
          <button type="button" className="btn btn-outline btn-sm" onClick={() => setShowCatModal(true)}>
            <MdCategory /> {translateText('Category')}
          </button>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => setShowStructModal(true)}>
            <MdAdd /> {translateText('Fee structure')}
          </button>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowInvoiceModal(true)}>
            <MdReceiptLong /> {translateText('Issue invoice')}
          </button>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowBulkModal(true)}>
            <MdGroups /> {translateText('Bulk by batch')}
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

      <div className="section-heading">
        <h2>{translateText('Fee structures')}</h2>
        <span className="section-meta">{structures.length}</span>
      </div>

      {structLoading ? (
        <div className="entity-grid">
          {[1, 2, 3].map((i) => (
            <div key={i} className="entity-card">
              <div className="skeleton skeleton-title" style={{ width: '60%', marginBottom: 8 }} />
              <div className="skeleton skeleton-text" style={{ width: '40%' }} />
            </div>
          ))}
        </div>
      ) : structures.length === 0 ? (
        <div className="empty-state card">
          <div className="empty-state-title">{translateText('No fee structures yet')}</div>
          <p className="empty-state-text">
            {translateText('Create a category, then add amount structures for tuition, registration, etc.')}
          </p>
          <button type="button" className="btn btn-primary btn-sm" style={{ marginTop: 12 }} onClick={() => setShowStructModal(true)}>
            <MdAdd /> {translateText('Fee structure')}
          </button>
        </div>
      ) : (
        <div className="entity-grid animate-stagger">
          {structures.map((s) => (
            <article key={s.id} className="entity-card">
              <div className="entity-card-top">
                <span className="badge badge-blue">{s.fee_categories?.code || '—'}</span>
                <div className="entity-card-badges">
                  {s.is_mandatory ? (
                    <span className="badge badge-amber">{translateText('Mandatory')}</span>
                  ) : (
                    <span className="badge badge-muted">{translateText('Optional')}</span>
                  )}
                  {s.is_active ? (
                    <span className="badge badge-green">{translateText('Active')}</span>
                  ) : (
                    <span className="badge badge-muted">{translateText('Inactive')}</span>
                  )}
                </div>
              </div>
              <div className="entity-card-title">
                {s.fee_categories?.name || s.description || translateText('Fee')}
              </div>
              <div className="stat-card-value" style={{ fontSize: '1.15rem', marginTop: 2 }}>
                {formatXAF(s.amount)}
              </div>
              {s.description && s.fee_categories?.name && (
                <div className="entity-card-meta">{s.description}</div>
              )}
              <div className="entity-card-meta">
                {translateText('Scope')}:{' '}
                {s.batches?.name ||
                  s.departments?.name ||
                  s.academic_years?.name ||
                  translateText('Global')}
              </div>
            </article>
          ))}
        </div>
      )}

      <div className="section-heading">
        <h2>{translateText('Recent invoices')}</h2>
        <span className="section-meta">{invoices.length}</span>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <MdPayments color="var(--color-primary)" aria-hidden="true" />{' '}
            {translateText('Ledger')}
          </span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          {invLoading ? (
            <div className="empty-state">{translateText('Loading…')}</div>
          ) : invoices.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-title">{translateText('No invoices')}</div>
              <p className="empty-state-text">
                {translateText('Use “Issue invoice” or “Bulk by batch” to bill students.')}
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
                    <td style={{ fontWeight: 650 }}>{inv.invoice_number}</td>
                    <td>
                      {inv.students
                        ? `${inv.students.first_name} ${inv.students.last_name}`
                        : '—'}
                      <div className="entity-card-meta">{inv.students?.matricule}</div>
                    </td>
                    <td>
                      <span className={`badge ${statusBadgeClass(inv.status)}`}>
                        {(inv.status || '').replace(/_/g, ' ')}
                      </span>
                    </td>
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
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </select>
              {catLoading && (
                <small className="entity-card-meta">{translateText('Loading categories…')}</small>
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
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.875rem' }}>
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

      {showInvoiceModal && (
        <Modal title={translateText('Issue invoice')} onClose={() => setShowInvoiceModal(false)}>
          <form className="form-stack" onSubmit={submitInvoice}>
            <div className="form-group">
              <label>{translateText('Student')}</label>
              <select
                className="form-control"
                value={invoiceForm.student_id}
                onChange={(e) => setInvoiceForm((f) => ({ ...f, student_id: e.target.value }))}
                required
              >
                <option value="">{translateText('Select student…')}</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.first_name} {s.last_name} ({s.matricule})
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>{translateText('Fee structures')}</label>
              {structureChecklist(invoiceForm.structure_ids, (id) =>
                toggleStructure(id, setInvoiceForm),
              )}
            </div>
            <div className="form-group">
              <label>{translateText('Due date')}</label>
              <input
                type="date"
                className="form-control"
                value={invoiceForm.due_date}
                onChange={(e) => setInvoiceForm((f) => ({ ...f, due_date: e.target.value }))}
              />
            </div>
            <div className="form-group">
              <label>{translateText('Notes')}</label>
              <textarea
                className="form-control"
                rows={2}
                value={invoiceForm.notes}
                onChange={(e) => setInvoiceForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-outline" onClick={() => setShowInvoiceModal(false)}>
                {translateText('Cancel')}
              </button>
              <button type="submit" className="btn btn-primary" disabled={invoiceMutation.isPending}>
                {translateText('Issue')}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {showBulkModal && (
        <Modal title={translateText('Bulk invoices by batch')} onClose={() => setShowBulkModal(false)}>
          <form className="form-stack" onSubmit={submitBulk}>
            <div className="form-group">
              <label>{translateText('Batch')}</label>
              <select
                className="form-control"
                value={bulkForm.batch_id}
                onChange={(e) => setBulkForm((f) => ({ ...f, batch_id: e.target.value }))}
                required
              >
                <option value="">{translateText('Select batch…')}</option>
                {batches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} {b.code ? `(${b.code})` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>{translateText('Fee structures')}</label>
              {structureChecklist(bulkForm.structure_ids, (id) => toggleStructure(id, setBulkForm))}
            </div>
            <div className="form-group">
              <label>{translateText('Due date')}</label>
              <input
                type="date"
                className="form-control"
                value={bulkForm.due_date}
                onChange={(e) => setBulkForm((f) => ({ ...f, due_date: e.target.value }))}
              />
            </div>
            <div className="form-group">
              <label>{translateText('Notes')}</label>
              <textarea
                className="form-control"
                rows={2}
                value={bulkForm.notes}
                onChange={(e) => setBulkForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-outline" onClick={() => setShowBulkModal(false)}>
                {translateText('Cancel')}
              </button>
              <button type="submit" className="btn btn-primary" disabled={bulkMutation.isPending}>
                {bulkMutation.isPending
                  ? translateText('Creating…')
                  : translateText('Create bulk invoices')}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </AppLayout>
  );
}
