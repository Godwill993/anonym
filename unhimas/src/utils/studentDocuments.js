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

export async function downloadPaymentReceipt(payment, student) {
  if (payment?.status !== 'completed') {
    throw new Error('A receipt is available only after payment is completed.');
  }

  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF();
  const margin = 18;
  const pageWidth = doc.internal.pageSize.getWidth();
  const name = `${student?.first_name || ''} ${student?.last_name || ''}`.trim();
  const programme =
    student?.programmes?.name || student?.batches?.programmes?.name || '—';
  let y = 22;

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('UNHIMAS - Payment receipt', margin, y);
  y += 8;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Official payment acknowledgement', margin, y);
  y += 10;
  doc.setDrawColor(17, 47, 66);
  doc.line(margin, y, pageWidth - margin, y);
  y += 9;

  const details = [
    ['Student', name || '—'],
    ['Matricule', student?.matricule || '—'],
    ['Programme', programme],
    ['Department', student?.batches?.departments?.name || '—'],
    ['Class / batch', student?.batches?.name || '—'],
    ['Email', student?.email || '—'],
    ['Payment ID', payment.id || '—'],
    ['Payment reference', payment.payment_reference || '—'],
    ['Receipt number', payment.receipt_number || '—'],
    ['Invoice', payment.student_invoices?.invoice_number || '—'],
    ['Academic year', payment.student_invoices?.academic_years?.name || '—'],
    ['Semester', payment.student_invoices?.semesters?.name || '—'],
    ['Invoice total', formatXAF(payment.student_invoices?.total_amount)],
    ['Amount paid', formatXAF(payment.amount)],
    ['Payment method', (payment.method || '').replace(/_/g, ' ')],
    ['Provider reference', payment.provider_reference || '—'],
    [
      'Paid at',
      payment.paid_at
        ? new Date(payment.paid_at).toLocaleString()
        : new Date(payment.created_at).toLocaleString(),
    ],
    ['Status', 'Completed'],
  ];

  doc.setFontSize(10);
  for (const [label, value] of details) {
    doc.setFont('helvetica', 'bold');
    doc.text(label, margin, y);
    doc.setFont('helvetica', 'normal');
    const wrapped = doc.splitTextToSize(String(value), pageWidth - margin * 2 - 48);
    doc.text(wrapped, margin + 48, y);
    y += Math.max(7, wrapped.length * 5);
  }

  const items = payment.student_invoices?.invoice_items || [];
  if (items.length) {
    y += 4;
    doc.setFont('helvetica', 'bold');
    doc.text('Invoice details', margin, y);
    y += 7;
    doc.setFont('helvetica', 'normal');
    for (const item of items) {
      const lineTotal = Number(item.quantity || 1) * Number(item.unit_amount || 0);
      const text = `${item.description} - ${formatXAF(lineTotal)}`;
      const wrapped = doc.splitTextToSize(text, pageWidth - margin * 2);
      if (y + wrapped.length * 5 > doc.internal.pageSize.getHeight() - margin) {
        doc.addPage();
        y = margin;
      }
      doc.text(wrapped, margin, y);
      y += wrapped.length * 5 + 2;
    }
  }

  const safeId = String(payment.receipt_number || payment.payment_reference || payment.id)
    .replace(/[^a-zA-Z0-9_-]/g, '-');
  doc.save(`UNHIMAS-receipt-${safeId}.pdf`);
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
