/**
 * Outbound notifications.
 *
 * Production: set VITE_NOTIFY_WEBHOOK_URL to a serverless function or Zapier/Make
 * endpoint that sends email/SMS. Payload is JSON { type, to, subject, body, meta }.
 *
 * Without the env var, notifications are logged to the console only (safe default).
 */

const WEBHOOK = import.meta.env.VITE_NOTIFY_WEBHOOK_URL || '';

export async function sendNotification({ type, to, subject, body, meta = {} }) {
  const payload = {
    type,
    to,
    subject,
    body,
    meta,
    sentAt: new Date().toISOString(),
  };

  if (!WEBHOOK) {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.info('[notify:dev]', payload);
    }
    return { delivered: false, reason: 'no_webhook' };
  }

  try {
    const res = await fetch(WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      return { delivered: false, reason: `http_${res.status}` };
    }
    return { delivered: true };
  } catch (err) {
    return { delivered: false, reason: err?.message || 'network_error' };
  }
}

export function notifyApplicationSubmitted(app) {
  return sendNotification({
    type: 'admission.submitted',
    to: app.email,
    subject: `Application received — ${app.application_number}`,
    body: `Dear ${app.first_name},\n\nWe received your application (${app.application_number}). The admissions office will contact you.\n\n— UNHIMAS`,
    meta: { application_number: app.application_number, id: app.id },
  });
}

export function notifyAdmissionDecision(app) {
  return sendNotification({
    type: 'admission.decision',
    to: app.email,
    subject: `Application ${app.status} — ${app.application_number}`,
    body: `Dear ${app.first_name},\n\nYour application ${app.application_number} status is now: ${app.status}.\n\n— UNHIMAS`,
    meta: { application_number: app.application_number, status: app.status },
  });
}

export function notifyInvoiceIssued({ email, invoiceNumber, amountLabel, studentName }) {
  if (!email) return Promise.resolve({ delivered: false, reason: 'no_email' });
  return sendNotification({
    type: 'fees.invoice',
    to: email,
    subject: `Invoice ${invoiceNumber}`,
    body: `Dear ${studentName || 'Student'},\n\nInvoice ${invoiceNumber} for ${amountLabel} has been issued. Pay via the student portal (Fees & Payments).\n\n— UNHIMAS`,
    meta: { invoiceNumber, amountLabel },
  });
}

export function notifyPaymentReceived({ email, paymentReference, amountLabel, receiptNumber }) {
  if (!email) return Promise.resolve({ delivered: false, reason: 'no_email' });
  return sendNotification({
    type: 'fees.payment',
    to: email,
    subject: `Payment received — ${paymentReference}`,
    body: `Dear Student,\n\nWe recorded your payment ${paymentReference} (${amountLabel}). Receipt: ${receiptNumber || 'pending'}.\n\n— UNHIMAS`,
    meta: { paymentReference, receiptNumber, amountLabel },
  });
}
