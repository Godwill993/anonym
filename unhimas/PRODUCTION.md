# UNHIMAS production checklist

## 1. Database

Apply **all** migrations in chronological order (see `supabase/MIGRATIONS.md`).

At minimum confirm the presence of:

- `fee_categories`, `student_invoices`, `payments`
- `admission_applications`
- `system_settings`
- attendance workflow columns + edit-lock trigger

### 1.1 RLS verification (required before go-live)

Run the read-only diagnostic script in the Supabase SQL Editor:

```sql
-- File: supabase/scripts/rls_inventory.sql
```

Review the output for:

- Any public table with RLS **DISABLED**
- Unexpected open SELECT policies on `students`, `lecturers`, `marks`, `payments`, `resources`
- Active administrator count (must be ≤ 3)

Do **not** apply corrective policy migrations until this inventory has been reviewed against the live project.

## 2. Environment

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
# Optional: POST endpoint for email/SMS (Resend, SendGrid, Make, Edge Function)
VITE_NOTIFY_WEBHOOK_URL=
# Optional CAPTCHA: VITE_TURNSTILE_SITE_KEY=
# Optional monitoring: VITE_SENTRY_DSN=
```

Never expose the service-role key in the frontend. See `.env.example`.

## 3. Feature flags (`system_settings`)

| Key | Default | Meaning |
|-----|---------|--------|
| `fee_clearance_required` | `{ "enabled": true }` | Block results/transcript if outstanding fees |
| `payments_auto_complete` | `{ "enabled": false }` | If false, student payments stay `pending` until admin confirms |

## 4. Payments (Mobile Money)

- Student portal records payment as **pending** by default.
- Admin **Payments** page: Mark completed after MoMo confirmation.
- **Automated path:** Edge Function `payment-webhook` (see `docs/PAYMENT_WEBHOOK.md`).

```bash
npx supabase secrets set PAYMENT_WEBHOOK_SECRET='long-random-secret'
npx supabase functions deploy payment-webhook
```

Call with header `x-payment-hook-secret` and body `{ "payment_reference": "...", "provider_reference": "..." }`.

## 5. Email

Set `VITE_NOTIFY_WEBHOOK_URL` to a function that accepts JSON and sends mail. Events: `admission.submitted`, `admission.decision`, `fees.invoice`, `fees.payment`.

## 6. Edge Functions

Redeploy after pulling security updates:

```bash
npx supabase functions deploy zoom-meeting
npx supabase functions deploy send-push-notification
npx supabase functions deploy verify-turnstile   # only if using Turnstile
npx supabase functions deploy payment-webhook   # MoMo / automation callbacks
```

### `zoom-meeting`

| Check | Requirement |
|-------|-------------|
| Auth | Valid Supabase JWT |
| Authorization | Active **admin** or **lecturer** only; lecturers may only manage **their own** sessions |
| Secrets | `ZOOM_ACCOUNT_ID`, `ZOOM_CLIENT_ID`, `ZOOM_CLIENT_SECRET`, `ZOOM_USER_EMAIL` |
| Optional | `ALLOWED_ORIGINS` (comma-separated browser origins) |

### `send-push-notification`

| Check | Requirement |
|-------|-------------|
| Auth | Header `x-push-hook-secret` must match `PUSH_WEBHOOK_SECRET` |
| Secrets | `PUSH_WEBHOOK_SECRET`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` |
| Caller | Database trigger / `pg_net` only — not browser clients |

### `verify-turnstile`

| Check | Requirement |
|-------|-------------|
| Auth | Invokable with anon key (public apply form) |
| Secret | `TURNSTILE_SECRET_KEY` (Cloudflare) |
| Frontend | `VITE_TURNSTILE_SITE_KEY` must match the same widget |

### `payment-webhook`

| Check | Requirement |
|-------|-------------|
| Auth | Header `x-payment-hook-secret` = `PAYMENT_WEBHOOK_SECRET` |
| Effect | `pending` → `completed` only; optional amount check |
| Docs | `docs/PAYMENT_WEBHOOK.md` |

## 7. Public endpoints

See **`docs/PUBLIC_ENDPOINTS.md`** for the full control matrix.

Summary:

- Honeypot + min form time on applications
- Optional Turnstile widget + **server-side** verification
- Validated dual-factor status lookup + client throttle
- Validated matricule results lookup + client throttle

## 8. Backups

- Enable Supabase daily backups (Pro) or `pg_dump` schedule.
- Quarterly restore drill documented by IT.

## 9. Security

- Maximum of **3** active administrators (database-enforced via triggers).
- Admin count is visible on the Staff / Administrators page.
- Public `/apply` uses honeypot field `website`.
- Optional Cloudflare Turnstile (`VITE_TURNSTILE_SITE_KEY` + `verify-turnstile`).
- Payment completion via webhook requires shared secret (not in frontend).
- Restrict Supabase dashboard access; rotate keys after staff changes.
- Global React Error Boundary is in place (prevents blank-page crashes).
- Zoom Edge Function enforces role + session ownership (redeploy required).

## 10. Monitoring

- Uptime on `/login`, `/apply`, and the public results portal.
- Render errors: `ErrorBoundary` → `src/lib/observability.js` (`reportError`).
- Optional Sentry: install `@sentry/react`, set `VITE_SENTRY_DSN`, or assign `window.__UNHIMAS_REPORT_ERROR__`.
