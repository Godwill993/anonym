import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MdPayments, MdRefresh, MdCheckCircle } from 'react-icons/md';
import AppLayout from '../../components/layout/AppLayout';
import { useTranslation } from '../../i18n';
import { useToast } from '../../hooks/useToast';
import { useAuth } from '../../context/AuthContext';
import {
  listPayments,
  markPaymentCompleted,
  formatXAF,
  PAYMENT_METHODS,
} from '../../services/feesService';

function statusClass(status) {
  const map = {
    pending: 'badge-warning',
    completed: 'badge-success',
    failed: 'badge-danger',
    refunded: 'badge-muted',
  };
  return map[status] || 'badge-muted';
}

export default function AdminPaymentsPage() {
  const { translateText } = useTranslation();
  const { profile } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');

  const { data: payments = [], isLoading } = useQuery({
    queryKey: ['admin-payments', statusFilter],
    queryFn: async () => {
      const rows = await listPayments({ limit: 100 });
      if (!statusFilter) return rows;
      return rows.filter((p) => p.status === statusFilter);
    },
  });

  const completeMutation = useMutation({
    mutationFn: (id) =>
      markPaymentCompleted(id, { recordedBy: profile?.id }),
    onSuccess: () => {
      toast.success(translateText('Payment marked completed'));
      queryClient.invalidateQueries({ queryKey: ['admin-payments'] });
      queryClient.invalidateQueries({ queryKey: ['admin-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['student-fee-balance'] });
    },
    onError: (e) => toast.error(e.message),
  });

  const methodLabel = (value) =>
    PAYMENT_METHODS.find((m) => m.value === value)?.label || value;

  return (
    <AppLayout pageTitle="Payments">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">{translateText('Payments')}</h1>
          <p className="page-subtitle">
            {translateText('Track Mobile Money, bank and cash payments; confirm pending ones')}
          </p>
        </div>
        <div className="page-header-actions" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select
            className="form-control"
            style={{ width: 'auto', minWidth: 140 }}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">{translateText('All statuses')}</option>
            <option value="pending">{translateText('Pending')}</option>
            <option value="completed">{translateText('Completed')}</option>
            <option value="failed">{translateText('Failed')}</option>
            <option value="refunded">{translateText('Refunded')}</option>
          </select>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => queryClient.invalidateQueries({ queryKey: ['admin-payments'] })}
          >
            <MdRefresh /> {translateText('Refresh')}
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <MdPayments /> {translateText('Payment ledger')}
          </span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          {isLoading ? (
            <div className="empty-state">{translateText('Loading…')}</div>
          ) : payments.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon"><MdPayments /></div>
              <div className="empty-state-title">{translateText('No payments found')}</div>
              <p className="empty-state-text">
                {translateText('Student payments will appear here after they pay an invoice.')}
              </p>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>{translateText('Reference')}</th>
                  <th>{translateText('Invoice')}</th>
                  <th>{translateText('Amount')}</th>
                  <th>{translateText('Method')}</th>
                  <th>{translateText('Status')}</th>
                  <th>{translateText('Date')}</th>
                  <th>{translateText('Actions')}</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{p.payment_reference}</div>
                      {p.receipt_number && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                          {p.receipt_number}
                        </div>
                      )}
                      {p.phone_number && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                          {p.phone_number}
                        </div>
                      )}
                    </td>
                    <td>{p.student_invoices?.invoice_number || '—'}</td>
                    <td style={{ fontWeight: 700 }}>{formatXAF(p.amount)}</td>
                    <td>{methodLabel(p.method)}</td>
                    <td>
                      <span className={`badge ${statusClass(p.status)}`}>{p.status}</span>
                    </td>
                    <td style={{ fontSize: '0.85rem' }}>
                      {p.paid_at
                        ? new Date(p.paid_at).toLocaleString()
                        : new Date(p.created_at).toLocaleString()}
                    </td>
                    <td>
                      {p.status === 'pending' && (
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          disabled={completeMutation.isPending}
                          onClick={() => completeMutation.mutate(p.id)}
                        >
                          <MdCheckCircle size={14} /> {translateText('Mark completed')}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
