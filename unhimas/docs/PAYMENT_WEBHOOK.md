# Payment webhook (Mobile Money confirmation)

Edge Function: `supabase/functions/payment-webhook`

Students create payments as **`pending`**. Admins can mark them completed in the UI. This webhook lets a **trusted provider callback or automation** do the same without exposing the service role to the browser.

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

- **MTN / Orange**: map their callback fields to `payment_reference` or store the UNHIMAS reference when initiating the collection request.
- **Make / Zapier**: HTTP module with the secret header is enough for a manual-ops bridge until a full PSP integration exists.
- **RLS**: the function uses the **service role** and never runs in the browser.
- Invoice balance updates remain whatever triggers/RLS already apply when payment status becomes `completed` (same as admin UI path).

## Security

- Rotate `PAYMENT_WEBHOOK_SECRET` after staff changes.
- Do not put the secret in frontend env vars.
- Prefer IP allowlists at the edge (Cloudflare) if the provider publishes static egress IPs.
