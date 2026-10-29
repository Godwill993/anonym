# UNHIMAS database migrations

## Source of truth

**Apply every file in `supabase/migrations/` in filename order** on your Supabase project.

`supabase/schema.sql` is a **historical bootstrap snapshot** only. It may still mention legacy roles (e.g. `frontdesk`) and will **not** include later columns such as:

- Zoom fields on `class_sessions`
- Attendance submission workflow (`attendance_status`, …)
- Marks/results publish RPCs, soft-archive, max-3-admins, etc.

Do **not** treat `schema.sql` as the live production schema.

## Fresh project setup

1. Create a Supabase project.
2. Run migrations in order (SQL editor or `supabase db push` / `supabase migration up`).
3. Configure Auth redirect URLs for your Vercel domain.
4. Create Storage bucket `resources` (private) if resources uploads are used.
5. Deploy Edge Functions and set secrets (see below).

## Critical recent migrations (class attendance)

| File | Purpose |
|------|---------|
| `20261029000000_attendance_submission_workflow.sql` | Session-level `attendance_status` for submit/approve |
| `20261029000001_attendance_edit_lock.sql` | Trigger: block attendance edits when submitted/approved |

Without these, lecturer **Submit to admin** and admin **Class Attendance** will fail.

## Edge Function secrets

### Zoom (`zoom-meeting`)

- `ZOOM_ACCOUNT_ID`
- `ZOOM_CLIENT_ID`
- `ZOOM_CLIENT_SECRET`
- `ZOOM_USER_EMAIL`

### Browser push (`send-push-notification`)

- VAPID private key (server-side secret)
- Frontend: `VITE_VAPID_PUBLIC_KEY`

## Roles

Application roles: **admin**, **lecturer**, **student**.  
Front desk was removed; campus clock-in is admin-only. Max **3** active admins (DB-enforced).
