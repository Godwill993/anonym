/**
 * payment-webhook — Supabase Edge Function
 *
 * Securely marks a pending payment as completed after Mobile Money (or
 * intermediary) confirmation. Intended for MTN/Orange callbacks or a
 * trusted automation (Make/Zapier) that holds PAYMENT_WEBHOOK_SECRET.
 *
 * Auth: header `x-payment-hook-secret` must match secret PAYMENT_WEBHOOK_SECRET.
 *
 * Body (JSON) — identify the payment with ONE of:
 *   { "payment_id": "<uuid>" }
 *   { "payment_reference": "PAY-..." }
 * Optional:
 *   { "provider_reference": "...", "amount": 50000, "status": "completed" }
 *
 * Only transitions pending → completed. Amount mismatch (when provided)
 * is rejected. Already-completed payments return 200 with no change.
 *
 * Deploy:
 *   npx supabase secrets set PAYMENT_WEBHOOK_SECRET=...
 *   npx supabase functions deploy payment-webhook
 */

import { createClient } from 'npm:@supabase/supabase-js@2';

function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') {
    return json({ ok: false, error: 'Method not allowed' }, 405);
  }

  let supabaseUrl: string;
  let serviceRoleKey: string;
  let webhookSecret: string;

  try {
    supabaseUrl = requireEnv('SUPABASE_URL');
    serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
    webhookSecret = requireEnv('PAYMENT_WEBHOOK_SECRET');
  } catch (err) {
    console.error('[payment-webhook]', err instanceof Error ? err.message : err);
    return json({ ok: false, error: 'Server misconfigured' }, 500);
  }

  if (request.headers.get('x-payment-hook-secret') !== webhookSecret) {
    return json({ ok: false, error: 'Unauthorized' }, 401);
  }

  let body: {
    payment_id?: string;
    payment_reference?: string;
    provider_reference?: string;
    amount?: number;
    status?: string;
  };

  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'Invalid JSON body' }, 400);
  }

  const paymentId = typeof body.payment_id === 'string' ? body.payment_id.trim() : '';
  const paymentReference =
    typeof body.payment_reference === 'string' ? body.payment_reference.trim() : '';

  if (!paymentId && !paymentReference) {
    return json(
      { ok: false, error: 'Provide payment_id or payment_reference' },
      400,
    );
  }

  // Only completion is supported for now (providers may send other statuses later)
  const requestedStatus = (body.status || 'completed').toLowerCase();
  if (requestedStatus !== 'completed' && requestedStatus !== 'success') {
    return json(
      { ok: false, error: `Unsupported status: ${requestedStatus}` },
      400,
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let query = supabase.from('payments').select('id, status, amount, payment_reference');
  if (paymentId) {
    query = query.eq('id', paymentId);
  } else {
    query = query.eq('payment_reference', paymentReference);
  }

  const { data: payment, error: findErr } = await query.maybeSingle();
  if (findErr) {
    console.error('[payment-webhook] lookup', findErr.message);
    return json({ ok: false, error: 'Lookup failed' }, 500);
  }
  if (!payment) {
    return json({ ok: false, error: 'Payment not found' }, 404);
  }

  if (payment.status === 'completed') {
    return json({
      ok: true,
      payment_id: payment.id,
      status: 'completed',
      already_completed: true,
    });
  }

  if (payment.status !== 'pending') {
    return json(
      {
        ok: false,
        error: `Cannot complete payment in status '${payment.status}'`,
        payment_id: payment.id,
      },
      409,
    );
  }

  if (body.amount != null && Number.isFinite(Number(body.amount))) {
    const expected = Number(payment.amount);
    const reported = Number(body.amount);
    // Allow 1 XAF float tolerance
    if (Math.abs(expected - reported) > 1) {
      return json(
        {
          ok: false,
          error: 'Amount mismatch',
          expected,
          reported,
        },
        409,
      );
    }
  }

  const providerReference =
    typeof body.provider_reference === 'string' && body.provider_reference.trim()
      ? body.provider_reference.trim()
      : null;

  const { data: updated, error: updErr } = await supabase
    .from('payments')
    .update({
      status: 'completed',
      provider_reference: providerReference,
      paid_at: new Date().toISOString(),
      notes: providerReference
        ? `Completed via payment-webhook (${providerReference})`
        : 'Completed via payment-webhook',
    })
    .eq('id', payment.id)
    .eq('status', 'pending') // optimistic concurrency
    .select('id, status, payment_reference, amount, paid_at')
    .maybeSingle();

  if (updErr) {
    console.error('[payment-webhook] update', updErr.message);
    return json({ ok: false, error: 'Update failed' }, 500);
  }

  if (!updated) {
    return json(
      { ok: false, error: 'Payment status changed concurrently; retry' },
      409,
    );
  }

  return json({
    ok: true,
    payment_id: updated.id,
    payment_reference: updated.payment_reference,
    status: updated.status,
    amount: updated.amount,
    paid_at: updated.paid_at,
  });
});
