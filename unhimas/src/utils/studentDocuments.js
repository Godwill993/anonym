import { formatXAF } from '../services/feesService';

function openPrintWindow(title, bodyHtml) {
  const w = window.open('', '_blank', 'noopener,noreferrer');
  if (!w) return;
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${title}</title>
    <style>
      body { font-family: system-ui, -apple-system, sans-serif; padding: 2rem; max-width: 640px; margin: 0 auto; color: #111; }
      h1 { font-size: 1.2rem; margin: 0 0 0.25rem; }
      h2 { font-size: 1rem; margin: 1.25rem 0 0.5rem; }
      .muted { color: #555; font-size: 0.85rem; }
      .brand { border-bottom: 2px solid #112f42; padding-bottom: 0.75rem; margin-bottom: 1rem; }
      table { width: 100%; margin-top: 1rem; border-collapse: collapse; font-size: 0.9rem; }
      th, td { padding: 0.4rem 0.25rem; border-bottom: 1px solid #e5e7eb; text-align: left; }
      td:last-child, th:last-child { text-align: right; }
      .stamp { margin-top: 2rem; font-size: 0.8rem; color: #333; border-top: 1px dashed #ccc; padding-top: 0.75rem; }
      .ok { color: #047857; font-weight: 700; }
      .warn { color: #b45309; font-weight: 700; }
    </style></head><body>${bodyHtml}
    <script>window.onload=function(){window.print();}</script>
    </body></html>`);
  w.document.close();
}

export function printPaymentQuitus(payment, student) {
  const name = student
    ? `${student.first_name || ''} ${student.last_name || ''}`.trim()
    : '';
  const title = `Quitus ${payment.receipt_number || payment.payment_reference}`;
  openPrintWindow(
    title,
    `<div class="brand">
      <h1>UNHIMAS — Payment receipt (Quitus)</h1>
      <p class="muted">Official fee payment acknowledgement</p>
    </div>
    <table>
      <tr><td>Student</td><td>${name || '—'} ${student?.matricule ? '(' + student.matricule + ')' : ''}</td></tr>
      <tr><td>Reference</td><td>${payment.payment_reference || '—'}</td></tr>
      <tr><td>Receipt</td><td>${payment.receipt_number || '—'}</td></tr>
      <tr><td>Amount</td><td>${formatXAF(payment.amount)}</td></tr>
      <tr><td>Method</td><td>${(payment.method || '').replace(/_/g, ' ')}</td></tr>
      <tr><td>Status</td><td>${payment.status}</td></tr>
      <tr><td>Date</td><td>${payment.paid_at ? new Date(payment.paid_at).toLocaleString() : new Date(payment.created_at).toLocaleString()}</td></tr>
    </table>
    <p class="stamp">Generated from the student portal. Present this with your matricule when required.</p>`,
  );
}

export function printEnrollmentAttestation(student) {
  const name = `${student?.first_name || ''} ${student?.last_name || ''}`.trim();
  const dept = student?.batches?.departments?.name || student?.departments?.name || '—';
  const batch = student?.batches?.name || '—';
  const produced = new Date().toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  openPrintWindow(
    `Enrollment attestation — ${student?.matricule || ''}`,
    `<div class="brand">
      <h1>UNHIMAS — Attestation of enrollment</h1>
      <p class="muted">Certificat de scolarité / Enrollment certificate</p>
    </div>
    <p>This is to certify that the student named below is enrolled at UNHIMAS.</p>
    <table>
      <tr><td>Full name</td><td>${name || '—'}</td></tr>
      <tr><td>Matricule</td><td>${student?.matricule || '—'}</td></tr>
      <tr><td>Department</td><td>${dept}</td></tr>
      <tr><td>Batch / Class</td><td>${batch}</td></tr>
      <tr><td>Status</td><td>${student?.is_active === false ? 'Inactive' : 'Active'}</td></tr>
      <tr><td>Issued</td><td>${produced}</td></tr>
    </table>
    <p class="stamp">This document is generated from the student information system for administrative use. Verify against the student record if required.</p>`,
  );
}

export function printFeeStatement({ student, balance, invoices = [], payments = [] }) {
  const name = `${student?.first_name || ''} ${student?.last_name || ''}`.trim();
  const outstanding = Number(balance?.outstanding_balance ?? 0);
  const invRows = invoices
    .slice(0, 20)
    .map(
      (inv) =>
        `<tr><td>${inv.invoice_number}</td><td>${inv.status}</td><td>${formatXAF(inv.total_amount)}</td><td>${formatXAF(inv.balance ?? inv.total_amount - inv.amount_paid)}</td></tr>`,
    )
    .join('');
  const payRows = payments
    .filter((p) => p.status === 'completed')
    .slice(0, 20)
    .map(
      (p) =>
        `<tr><td>${p.payment_reference}</td><td>${p.receipt_number || '—'}</td><td>${(p.method || '').replace(/_/g, ' ')}</td><td>${formatXAF(p.amount)}</td></tr>`,
    )
    .join('');

  openPrintWindow(
    `Fee statement — ${student?.matricule || ''}`,
    `<div class="brand">
      <h1>UNHIMAS — Fee statement</h1>
      <p class="muted">Relevé de scolarité / Account summary</p>
    </div>
    <table>
      <tr><td>Student</td><td>${name || '—'} (${student?.matricule || '—'})</td></tr>
      <tr><td>Total invoiced</td><td>${formatXAF(balance?.total_invoiced)}</td></tr>
      <tr><td>Total paid</td><td>${formatXAF(balance?.total_paid)}</td></tr>
      <tr><td>Outstanding</td><td class="${outstanding > 0 ? 'warn' : 'ok'}">${formatXAF(outstanding)}</td></tr>
    </table>
    <h2>Invoices</h2>
    <table>
      <thead><tr><th>Invoice</th><th>Status</th><th>Total</th><th>Balance</th></tr></thead>
      <tbody>${invRows || '<tr><td colspan="4">None</td></tr>'}</tbody>
    </table>
    <h2>Completed payments</h2>
    <table>
      <thead><tr><th>Reference</th><th>Receipt</th><th>Method</th><th>Amount</th></tr></thead>
      <tbody>${payRows || '<tr><td colspan="4">None</td></tr>'}</tbody>
    </table>
    <p class="stamp">Generated ${new Date().toLocaleString()}. Not a bank receipt — use individual quitus for each payment.</p>`,
  );
}
