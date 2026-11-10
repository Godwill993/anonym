import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  MdPayments,
  MdAdd,
  MdRefresh,
  MdCategory,
  MdReceiptLong,
  MdGroups,
  MdSearch,
  MdPolicy,
  MdCancel,
  MdInfo,
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
  cancelInvoice,
  bulkCreateInvoices,
  formatXAF,
  getFeeClearanceSetting,
  updateFeeClearanceSetting,
  INVOICE_STATUSES,
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
  const [showPolicyModal, setShowPolicyModal] = useState(false);
  const [inspectInvoice, setInspectInvoice] = useState(null);

  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState('');
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Lock refs for double-action prevention
  const isSubmittingCatRef = useRef(false);
  const isSubmittingStructRef = useRef(false);
  const isSubmittingInvoiceRef = useRef(false);
  const isSubmittingBulkRef = useRef(false);
  const isSubmittingPolicyRef = useRef(false);
  const isCancellingInvoiceRef = useRef(false);

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

  const [policyForm, setPolicyForm] = useState({
    enabled: true,
    minPaidRatio: 1,
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
    queryFn: () => listInvoices({ limit: 100 }),
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

  const { data: clearancePolicy } = useQuery({
    queryKey: ['fee-clearance-policy'],
    queryFn: async () => {
      const pol = await getFeeClearanceSetting();
      setPolicyForm({ enabled: pol.enabled, minPaidRatio: pol.minPaidRatio });
      return pol;
    },
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
    onSettled: () => {
      isSubmittingCatRef.current = false;
    },
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
    onSettled: () => {
      isSubmittingStructRef.current = false;
    },
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
    onSettled: () => {
      isSubmittingInvoiceRef.current = false;
    },
  });

  const cancelInvoiceMutation = useMutation({
    mutationFn: (id) => cancelInvoice(id),
    onSuccess: () => {
      toast.success(translateText('Invoice cancelled'));
      setInspectInvoice(null);
      queryClient.invalidateQueries({ queryKey: ['admin-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['student-fee-balance'] });
    },
    onError: (e) => toast.error(e.message),
    onSettled: () => {
      isCancellingInvoiceRef.current = false;
    },
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
    onSettled: () => {
      isSubmittingBulkRef.current = false;
    },
  });

  const policyMutation = useMutation({
    mutationFn: updateFeeClearanceSetting,
    onSuccess: () => {
      toast.success(translateText('Fee clearance policy updated'));
      setShowPolicyModal(false);
      queryClient.invalidateQueries({ queryKey: ['fee-clearance-policy'] });
      queryClient.invalidateQueries({ queryKey: ['fee-clearance-policy-settings'] });
    },
    onError: (e) => toast.error(e.message),
    onSettled: () => {
      isSubmittingPolicyRef.current = false;
    },
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
    if (isSubmittingInvoiceRef.current || invoiceMutation.isPending) return;

    if (!invoiceForm.student_id) {
      toast.error(translateText('Select a student'));
      return;
    }
    if (!invoiceForm.structure_ids.length) {
      toast.error(translateText('Select at least one fee structure'));
      return;
    }

    isSubmittingInvoiceRef.current = true;
    toast.info(translateText('Issuing invoice…'));

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
    if (isSubmittingBulkRef.current || bulkMutation.isPending) return;

    if (!bulkForm.batch_id) {
      toast.error(translateText('Select a batch'));
      return;
    }
    if (!bulkForm.structure_ids.length) {
      toast.error(translateText('Select at least one fee structure'));
      return;
    }

    isSubmittingBulkRef.current = true;
    toast.info(translateText('Generating batch invoices…'));

    bulkMutation.mutate({
      batchId: bulkForm.batch_id,
      structureIds: bulkForm.structure_ids,
      notes: bulkForm.notes || null,
      dueDate: bulkForm.due_date || null,
    });
  };

  const submitCategory = (e) => {
    e.preventDefault();
    if (isSubmittingCatRef.current || catMutation.isPending) return;
    isSubmittingCatRef.current = true;
    toast.info(translateText('Saving category…'));
    catMutation.mutate({
      code: catForm.code.trim().toUpperCase(),
      name: catForm.name.trim(),
      description: catForm.description || null,
      sort_order: Number(catForm.sort_order) || 50,
    });
  };

  const submitStructure = (e) => {
    e.preventDefault();
    if (isSubmittingStructRef.current || structMutation.isPending) return;
    isSubmittingStructRef.current = true;
    toast.info(translateText('Saving fee structure…'));
    structMutation.mutate({
      fee_category_id: structForm.fee_category_id,
      amount: Number(structForm.amount),
      description: structForm.description || null,
      is_mandatory: !!structForm.is_mandatory,
      is_active: true,
    });
  };

  const submitPolicy = (e) => {
    e.preventDefault();
    if (isSubmittingPolicyRef.current || policyMutation.isPending) return;
    isSubmittingPolicyRef.current = true;
    toast.info(translateText('Updating fee policy…'));
    policyMutation.mutate(policyForm);
  };

  const handleCancelInvoiceAction = (id) => {
    if (isCancellingInvoiceRef.current || cancelInvoiceMutation.isPending) return;
    if (
      !window.confirm(
        translateText('Are you sure you want to cancel this unpaid invoice?'),
      )
    ) {
      return;
    }
    isCancellingInvoiceRef.current = true;
    toast.info(translateText('Cancelling invoice…'));
    cancelInvoiceMutation.mutate(id);
  };

  const handleRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    toast.info(translateText('Refreshing fees & invoices…'));
    try {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['fee-categories'] }),
        queryClient.invalidateQueries({ queryKey: ['fee-structures'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-invoices'] }),
      ]);
      toast.success(translateText('Fees & invoices refreshed'));
    } finally {
      setTimeout(() => {
        setIsRefreshing(false);
      }, 600);
    }
  };

  const filteredInvoices = invoices.filter((inv) => {
    if (invoiceStatusFilter && inv.status !== invoiceStatusFilter) return false;
    if (invoiceSearch.trim()) {
      const q = invoiceSearch.toLowerCase();
      const s = inv.students;
      const sName = `${s?.first_name || ''} ${s?.last_name || ''}`.toLowerCase();
      const sMat = (s?.matricule || '').toLowerCase();
      const iNum = (inv.invoice_number || '').toLowerCase();
      if (!sName.includes(q) && !sMat.includes(q) && !iNum.includes(q)) {
        return false;
      }
    }
    return true;
  });

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
            {translateText('Manage fee categories, structures, student billing, and clearance policies')}
          </p>
        </div>
        <div className="page-header-actions" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => setShowPolicyModal(true)}>
            <MdPolicy /> {translateText('Clearance policy')}
          </button>
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
            disabled={isRefreshing}
            onClick={handleRefresh}
          >
            <MdRefresh /> {isRefreshing ? translateText('Refreshing…') : translateText('Refresh')}
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

      <div className="section-heading" style={{ marginTop: '2rem' }}>
        <h2>{translateText('Recent invoices')}</h2>
        <span className="section-meta">{filteredInvoices.length}</span>
      </div>

      <div className="card">
        <div className="card-header" style={{ flexWrap: 'wrap', gap: 12 }}>
          <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <MdPayments color="var(--color-primary)" aria-hidden="true" />{' '}
            {translateText('Ledger')}
          </span>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ position: 'relative' }}>
              <MdSearch
                size={18}
                style={{
                  position: 'absolute',
                  left: 10,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--color-text-muted)',
                }}
              />
              <input
                type="text"
                className="form-control"
                style={{ paddingLeft: 32, width: 220, height: 36 }}
                placeholder={translateText('Search invoice or student…')}
                value={invoiceSearch}
                onChange={(e) => setInvoiceSearch(e.target.value)}
              />
            </div>

            <select
              className="form-control"
              style={{ width: 'auto', minWidth: 140, height: 36 }}
              value={invoiceStatusFilter}
              onChange={(e) => setInvoiceStatusFilter(e.target.value)}
            >
              <option value="">{translateText('All statuses')}</option>
              {INVOICE_STATUSES.map((st) => (
                <option key={st} value={st}>
                  {st.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          {invLoading ? (
            <div className="empty-state">{translateText('Loading…')}</div>
          ) : filteredInvoices.length === 0 ? (
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
                  <th>{translateText('Actions')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.map((inv) => (
                  <tr key={inv.id}>
                    <td>
                      <button
                        type="button"
                        style={{
                          background: 'none',
                          border: 0,
                          padding: 0,
                          cursor: 'pointer',
                          fontWeight: 650,
                          color: 'var(--color-primary)',
                        }}
                        onClick={() => setInspectInvoice(inv)}
                      >
                        {inv.invoice_number}
                      </button>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                        {inv.issue_date}
                      </div>
                    </td>
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
                    <td>
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() => setInspectInvoice(inv)}
                        title={translateText('View details')}
                      >
                        <MdInfo size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Inspect Invoice Modal */}
      {inspectInvoice && (
        <Modal
          title={`${translateText('Invoice')} ${inspectInvoice.invoice_number}`}
          onClose={() => setInspectInvoice(null)}
        >
          <div className="form-stack">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <span className="entity-card-meta">{translateText('Student')}</span>
                <div style={{ fontWeight: 650 }}>
                  {inspectInvoice.students
                    ? `${inspectInvoice.students.first_name} ${inspectInvoice.students.last_name}`
                    : '—'}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                  {inspectInvoice.students?.matricule}
                </div>
              </div>
              <div>
                <span className="entity-card-meta">{translateText('Status')}</span>
                <div>
                  <span className={`badge ${statusBadgeClass(inspectInvoice.status)}`}>
                    {inspectInvoice.status}
                  </span>
                </div>
              </div>
              <div>
                <span className="entity-card-meta">{translateText('Issue date')}</span>
                <div>{inspectInvoice.issue_date || '—'}</div>
              </div>
              <div>
                <span className="entity-card-meta">{translateText('Due date')}</span>
                <div>{inspectInvoice.due_date || '—'}</div>
              </div>
              <div>
                <span className="entity-card-meta">{translateText('Total amount')}</span>
                <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>
                  {formatXAF(inspectInvoice.total_amount)}
                </div>
              </div>
              <div>
                <span className="entity-card-meta">{translateText('Remaining balance')}</span>
                <div style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--color-danger)' }}>
                  {formatXAF(inspectInvoice.balance)}
                </div>
              </div>
            </div>

            <div style={{ marginTop: 12 }}>
              <span className="entity-card-meta">{translateText('Line items')}</span>
              <table className="data-table" style={{ marginTop: 6 }}>
                <thead>
                  <tr>
                    <th>{translateText('Description')}</th>
                    <th>{translateText('Qty')}</th>
                    <th>{translateText('Unit Amount')}</th>
                    <th>{translateText('Total')}</th>
                  </tr>
                </thead>
                <tbody>
                  {(inspectInvoice.invoice_items || []).map((it, idx) => (
                    <tr key={idx}>
                      <td>{it.description}</td>
                      <td>{it.quantity}</td>
                      <td>{formatXAF(it.unit_amount)}</td>
                      <td style={{ fontWeight: 600 }}>
                        {formatXAF(Number(it.quantity || 1) * Number(it.unit_amount || 0))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {inspectInvoice.notes && (
              <div style={{ marginTop: 8 }}>
                <span className="entity-card-meta">{translateText('Notes')}</span>
                <div
                  style={{
                    background: 'var(--color-bg)',
                    padding: 8,
                    borderRadius: 6,
                    fontSize: '0.85rem',
                    marginTop: 4,
                  }}
                >
                  {inspectInvoice.notes}
                </div>
              </div>
            )}

            <div
              style={{
                display: 'flex',
                gap: 8,
                justifyContent: 'flex-end',
                marginTop: 16,
                borderTop: '1px solid var(--color-border)',
                paddingTop: 12,
              }}
            >
              {inspectInvoice.status !== 'cancelled' &&
                Number(inspectInvoice.amount_paid || 0) === 0 && (
                  <button
                    type="button"
                    className="btn btn-outline"
                    style={{ color: 'var(--color-danger)' }}
                    disabled={cancelInvoiceMutation.isPending}
                    onClick={() => handleCancelInvoiceAction(inspectInvoice.id)}
                  >
                    <MdCancel /> {cancelInvoiceMutation.isPending ? translateText('Cancelling…') : translateText('Cancel invoice')}
                  </button>
                )}
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setInspectInvoice(null)}
              >
                {translateText('Close')}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Fee Clearance Policy Modal */}
      {showPolicyModal && (
        <Modal
          title={translateText('Fee clearance & financial policy')}
          onClose={() => {
            if (!policyMutation.isPending) setShowPolicyModal(false);
          }}
        >
          <form className="form-stack" onSubmit={submitPolicy}>
            <div className="alert-banner" style={{ marginBottom: 12 }}>
              <MdInfo size={18} style={{ flexShrink: 0 }} />
              <span>
                {translateText(
                  'Fee clearance controls whether students can view official exam results, generate transcripts, or register for courses based on their fee balances.',
                )}
              </span>
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={policyForm.enabled}
                disabled={policyMutation.isPending}
                onChange={(e) =>
                  setPolicyForm((f) => ({ ...f, enabled: e.target.checked }))
                }
              />
              <div>
                <strong>{translateText('Enforce fee clearance')}</strong>
                <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                  {translateText('Block results and transcripts if student has unpaid fees.')}
                </div>
              </div>
            </label>

            {policyForm.enabled && (
              <div className="form-group" style={{ marginTop: 12 }}>
                <label>{translateText('Minimum required paid ratio')}</label>
                <select
                  className="form-control"
                  value={policyForm.minPaidRatio}
                  disabled={policyMutation.isPending}
                  onChange={(e) =>
                    setPolicyForm((f) => ({ ...f, minPaidRatio: Number(e.target.value) }))
                  }
                >
                  <option value={1}>100% — {translateText('Full balance cleared')}</option>
                  <option value={0.75}>75% — {translateText('At least 75% of fees paid')}</option>
                  <option value={0.5}>50% — {translateText('At least 50% of fees paid')}</option>
                  <option value={0.25}>25% — {translateText('At least 25% of fees paid')}</option>
                </select>
                <p className="form-hint">
                  {translateText(
                    'Students who have paid at or above this proportion of their invoiced fees will be permitted to access results.',
                  )}
                </p>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <button
                type="button"
                className="btn btn-outline"
                disabled={policyMutation.isPending}
                onClick={() => setShowPolicyModal(false)}
              >
                {translateText('Cancel')}
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={policyMutation.isPending}
              >
                {policyMutation.isPending
                  ? translateText('Saving…')
                  : translateText('Save policy')}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* New Fee Category Modal */}
      {showCatModal && (
        <Modal
          title={translateText('New fee category')}
          onClose={() => {
            if (!catMutation.isPending) setShowCatModal(false);
          }}
        >
          <form className="form-stack" onSubmit={submitCategory}>
            <div className="form-group">
              <label>Code</label>
              <input
                className="form-control"
                value={catForm.code}
                disabled={catMutation.isPending}
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
                disabled={catMutation.isPending}
                onChange={(e) => setCatForm((f) => ({ ...f, name: e.target.value }))}
                required
              />
            </div>
            <div className="form-group">
              <label>{translateText('Description')}</label>
              <textarea
                className="form-control"
                value={catForm.description}
                disabled={catMutation.isPending}
                onChange={(e) => setCatForm((f) => ({ ...f, description: e.target.value }))}
                rows={2}
              />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-outline"
                disabled={catMutation.isPending}
                onClick={() => setShowCatModal(false)}
              >
                {translateText('Cancel')}
              </button>
              <button type="submit" className="btn btn-primary" disabled={catMutation.isPending}>
                {catMutation.isPending ? translateText('Saving…') : translateText('Save')}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* New Fee Structure Modal */}
      {showStructModal && (
        <Modal
          title={translateText('New fee structure')}
          onClose={() => {
            if (!structMutation.isPending) setShowStructModal(false);
          }}
        >
          <form className="form-stack" onSubmit={submitStructure}>
            <div className="form-group">
              <label>{translateText('Category')}</label>
              <select
                className="form-control"
                value={structForm.fee_category_id}
                disabled={structMutation.isPending}
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
                disabled={structMutation.isPending}
                onChange={(e) => setStructForm((f) => ({ ...f, amount: e.target.value }))}
                required
              />
            </div>
            <div className="form-group">
              <label>{translateText('Description')}</label>
              <input
                className="form-control"
                value={structForm.description}
                disabled={structMutation.isPending}
                onChange={(e) => setStructForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.875rem' }}>
              <input
                type="checkbox"
                checked={structForm.is_mandatory}
                disabled={structMutation.isPending}
                onChange={(e) => setStructForm((f) => ({ ...f, is_mandatory: e.target.checked }))}
              />
              {translateText('Mandatory')}
            </label>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-outline"
                disabled={structMutation.isPending}
                onClick={() => setShowStructModal(false)}
              >
                {translateText('Cancel')}
              </button>
              <button type="submit" className="btn btn-primary" disabled={structMutation.isPending}>
                {structMutation.isPending ? translateText('Saving…') : translateText('Save')}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Single Invoice Issue Modal */}
      {showInvoiceModal && (
        <Modal
          title={translateText('Issue invoice')}
          onClose={() => {
            if (!invoiceMutation.isPending) setShowInvoiceModal(false);
          }}
        >
          <form className="form-stack" onSubmit={submitInvoice}>
            <div className="form-group">
              <label>{translateText('Student')}</label>
              <select
                className="form-control"
                value={invoiceForm.student_id}
                disabled={invoiceMutation.isPending}
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
                disabled={invoiceMutation.isPending}
                onChange={(e) => setInvoiceForm((f) => ({ ...f, due_date: e.target.value }))}
              />
            </div>
            <div className="form-group">
              <label>{translateText('Notes')}</label>
              <textarea
                className="form-control"
                rows={2}
                value={invoiceForm.notes}
                disabled={invoiceMutation.isPending}
                onChange={(e) => setInvoiceForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-outline"
                disabled={invoiceMutation.isPending}
                onClick={() => setShowInvoiceModal(false)}
              >
                {translateText('Cancel')}
              </button>
              <button type="submit" className="btn btn-primary" disabled={invoiceMutation.isPending}>
                {invoiceMutation.isPending ? translateText('Issuing…') : translateText('Issue')}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Bulk Invoices Modal */}
      {showBulkModal && (
        <Modal
          title={translateText('Bulk invoices by batch')}
          onClose={() => {
            if (!bulkMutation.isPending) setShowBulkModal(false);
          }}
        >
          <form className="form-stack" onSubmit={submitBulk}>
            <div className="form-group">
              <label>{translateText('Batch')}</label>
              <select
                className="form-control"
                value={bulkForm.batch_id}
                disabled={bulkMutation.isPending}
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
                disabled={bulkMutation.isPending}
                onChange={(e) => setBulkForm((f) => ({ ...f, due_date: e.target.value }))}
              />
            </div>
            <div className="form-group">
              <label>{translateText('Notes')}</label>
              <textarea
                className="form-control"
                rows={2}
                value={bulkForm.notes}
                disabled={bulkMutation.isPending}
                onChange={(e) => setBulkForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-outline"
                disabled={bulkMutation.isPending}
                onClick={() => setShowBulkModal(false)}
              >
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
