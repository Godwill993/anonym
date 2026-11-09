# Payment webhook (Mobile Money confirmation)

Edge Function: `supabase/functions/payment-webhook`

The webhook marks an existing **`pending`** payment completed. Admins can also mark payments completed in the UI. The student MTN MoMo / Orange Money checkout is currently disabled until provider sandbox accounts and callback integrations are configured; this webhook alone does not initiate a payment.

## Deploy

```bash
npx supabase secrets set PAYMENT_WEBHOOK_SECRET='generate-a-long-random-string'
npx supabase functions deploy payment-webhook
```

URL shape:

```
https://<project-ref>.supabase.co/functions/v1/payment-webhook
```

## Request

```http
POST /functions/v1/payment-webhook
Content-Type: application/json
x-payment-hook-secret: <PAYMENT_WEBHOOK_SECRET>
```

```json
{
  "payment_reference": "PAY-20261101-123456",
  "provider_reference": "MTN-TX-ABC",
  "amount": 50000,
  "status": "completed"
}
```

or

```json
{
  "payment_id": "uuid-of-payment-row",
  "provider_reference": "OM-98765"
}
```

## Behaviour

| Case | HTTP | Result |
|------|------|--------|
| Bad/missing secret | 401 | Unauthorized |
| Unknown payment | 404 | Not found |
| Already completed | 200 | `{ already_completed: true }` |
| Status not `pending` | 409 | Rejected |
| Amount provided but mismatches | 409 | Rejected |
| Success | 200 | `{ ok: true, status: "completed", ... }` |

Only **`pending` → `completed`** is supported. Failed/refunded statuses can be added later when a provider contract is fixed.

## Integration notes

- **MTN / Orange**: a provider callback must be authenticated and verified against the provider before calling this webhook. Do not expose `PAYMENT_WEBHOOK_SECRET` to the browser.
- **Make / Zapier**: HTTP module with the secret header is enough for a manual-ops bridge until a full PSP integration exists.
- **RLS**: the function uses the **service role** and never runs in the browser.
- Invoice balance updates remain whatever triggers/RLS already apply when payment status becomes `completed` (same as admin UI path).
- The database assigns the unique receipt number when the payment transitions to `completed`; students can then download a PDF receipt from payment history.

## Security

- Rotate `PAYMENT_WEBHOOK_SECRET` after staff changes.
- Do not put the secret in frontend env vars.
- Prefer IP allowlists at the edge (Cloudflare) if the provider publishes static egress IPs.
