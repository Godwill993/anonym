# UNHIMAS — School Management Portal

React 19 + Vite frontend with Supabase backend.

## Local development

```bash
cp .env.example .env   # add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm install
npm run dev
```

## Production build

```bash
npm run build
npm run preview
```

## Production readiness

Before institutional go-live, follow:

| Document | Purpose |
|----------|---------|
| **[PRODUCTION_READINESS.md](./PRODUCTION_READINESS.md)** | Audit summary, stage map, go-live checklist |
| **[PRODUCTION.md](./PRODUCTION.md)** | Operational checklist (DB, secrets, Edge Functions) |
| **[docs/PUBLIC_ENDPOINTS.md](./docs/PUBLIC_ENDPOINTS.md)** | Public route security model |
| **[docs/PAYMENT_WEBHOOK.md](./docs/PAYMENT_WEBHOOK.md)** | MoMo / automation payment completion |

```bash
npm test   # pure unit tests (fee clearance, permissions, public forms, payments, …)
```

## Vercel deployment

| Setting | Value |
|---------|--------|
| **Root Directory** | `unhimas` |
| **Framework** | Vite |
| **Build Command** | `npm run build` |
| **Output Directory** | `dist` |
| **Install Command** | `npm install` |

SPA routing is configured in `vercel.json` (all paths rewrite to `index.html`).

### Environment variables (Production)

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Optional: `VITE_VAPID_PUBLIC_KEY`, `VITE_NOTIFY_WEBHOOK_URL`, `VITE_TURNSTILE_SITE_KEY`, `VITE_SENTRY_DSN`.

Never set the Supabase **service role** key in frontend env vars.

### Supabase Edge Functions

```bash
npx supabase functions deploy zoom-meeting
npx supabase functions deploy send-push-notification
npx supabase functions deploy verify-turnstile   # if using Turnstile
npx supabase functions deploy payment-webhook   # if automating MoMo completion
```

Secrets (examples): Zoom credentials, `PUSH_WEBHOOK_SECRET`, `TURNSTILE_SECRET_KEY`, `PAYMENT_WEBHOOK_SECRET`.

### Database migrations (required)

Apply **all** files under `supabase/migrations/` in order on your Supabase project.
Do **not** rely on `supabase/schema.sql` alone — it is not the full live schema.

**Class attendance submit / approve (required for production):**

Easiest: open Supabase → **SQL Editor** → paste and run the entire file:

`supabase/APPLY_ATTENDANCE_WORKFLOW.sql`

That installs status columns + edit-lock trigger in one go (safe to re-run).

Equivalent separate migrations:

1. `20261029000000_attendance_submission_workflow.sql`
2. `20261029000001_attendance_edit_lock.sql`

Admin UI: **Class Attendance** at `/admin/attendance` (sidebar → Academic Operations).

Before go-live, also run the read-only RLS diagnostic:

`supabase/scripts/rls_inventory.sql`

## Tests

```bash
npm test
```

## i18n

English / French via `src/i18n`. Toggle with the **FR/EN** control in the header. UI labels are translated; user data (names, codes, scores) is not. Coverage is still partial on some lecturer screens.
