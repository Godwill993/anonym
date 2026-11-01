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
```

Never expose the service-role key in the frontend.

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

## 6. Edge Functions

Redeploy after pulling security updates:

```bash
npx supabase functions deploy zoom-meeting
npx supabase functions deploy send-push-notification
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

## 7. Backups

- Enable Supabase daily backups (Pro) or `pg_dump` schedule.
- Quarterly restore drill documented by IT.

## 8. Security

- Maximum of **3** active administrators (database-enforced via triggers).
- Admin count is visible on the Staff / Administrators page.
- Public `/apply` uses honeypot field `website`.
- Add Cloudflare Turnstile/CAPTCHA when traffic warrants it.
- Restrict Supabase dashboard access; rotate keys after staff changes.
- Global React Error Boundary is in place (prevents blank-page crashes).
- Zoom Edge Function enforces role + session ownership (redeploy required).

## 9. Monitoring

- Uptime on `/login` and `/apply`.
- Optional Sentry: add `@sentry/react` and `VITE_SENTRY_DSN`.
