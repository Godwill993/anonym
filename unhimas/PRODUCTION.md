# UNHIMAS production checklist

## 1. Database

Apply migrations in order on the Supabase project:

1. Existing core migrations
2. `20261030000000_fees_and_payments.sql`
3. `20261030100000_admissions.sql`
4. `20261030200000_production_hardening.sql`

Verify: tables `fee_categories`, `student_invoices`, `payments`, `admission_applications`, `system_settings` exist.

## 2. Environment

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
# Optional: POST endpoint for email/SMS (Resend, SendGrid, Make, Edge Function)
VITE_NOTIFY_WEBHOOK_URL=
```

## 3. Feature flags (`system_settings`)

| Key | Default | Meaning |
|-----|---------|--------|
| `fee_clearance_required` | `{ "enabled": true }` | Block results/transcript if outstanding fees |
| `payments_auto_complete` | `{ "enabled": false }` | If false, student payments stay `pending` until admin confirms |

## 4. Payments (Mobile Money)

- Student portal records payment as **pending** by default.
- Admin **Payments** page: Mark completed after MoMo confirmation.
- Wire a real MTN/Orange webhook later to call the same status update.

## 5. Email

Set `VITE_NOTIFY_WEBHOOK_URL` to a function that accepts JSON and sends mail. Events: `admission.submitted`, `admission.decision`, `fees.invoice`, `fees.payment`.

## 6. Backups

- Enable Supabase daily backups (Pro) or `pg_dump` schedule.
- Quarterly restore drill documented by IT.

## 7. Security

- Max 3 admins (enforced).
- Public `/apply` uses honeypot field `website`.
- Add Cloudflare Turnstile/CAPTCHA when traffic warrants it.
- Restrict Supabase dashboard access; rotate keys after staff changes.

## 8. Monitoring

- Uptime on `/login` and `/apply`.
- Optional Sentry: add `@sentry/react` and `VITE_SENTRY_DSN`.
