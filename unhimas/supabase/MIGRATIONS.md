# UNHIMAS Database Migrations

## Source of Truth

**Apply every file in `supabase/migrations/` in chronological filename order** on your Supabase project.

`supabase/schema.sql` is a **historical bootstrap snapshot only**. It may still mention legacy roles (e.g. `frontdesk`) and does **not** contain later columns such as:

- Zoom fields on `class_sessions`
- Attendance submission workflow (`attendance_status`, …)
- Marks/results publish RPCs, soft-archive, max-3-admins, fees, admissions, etc.

**Never treat `schema.sql` as the live production schema.**

---

## Fresh Project Setup

1. Create a Supabase project.
2. Run **all** migrations in the order listed below (SQL Editor or `supabase db push` / `supabase migration up`).
3. Configure Auth redirect URLs for your Vercel domain.
4. Create Storage bucket `resources` (private) if resource uploads are used.
5. Deploy Edge Functions and set secrets (see below).

---

## Migration Execution Order (Authoritative)

| Order | File | Purpose | Safe to re-run? | Notes |
|------:|------|---------|-----------------|-------|
| 1 | `20261005000000_secure_account_provisioning.sql` | Secure account creation foundations | Mostly | |
| 2 | `20261011000001_direct_account_creation.sql` | Direct account creation support | Mostly | |
| 3 | `20261011000002_frontend_account_provisioning.sql` | Frontend-driven provisioning | Mostly | |
| 4 | `20261013000000_admin_delete_school_accounts.sql` | Admin ability to delete school accounts | Mostly | |
| 5 | `20261014000000_announcement_notifications.sql` | Announcement → notification triggers | Mostly | |
| 6 | `20261015000000_browser_push_notifications.sql` | Push subscriptions + RLS | Yes | |
| 7 | `20261020000000_schema_improvements.sql` | Results views, GPA, mark seeding, transfers, notifications | Careful | Drops/recreates views |
| 8 | `20261020000001_transfer_audit_soft_archive.sql` | Soft-archive + transfer audit | Mostly | |
| 9 | `20261021000000_batch_results_publish.sql` | Batch results publish RPCs | Mostly | |
| 10 | `20261021000001_class_session_improvements.sql` | Class session improvements | Mostly | |
| 11 | `20261021000002_return_comment_in_notification.sql` | Return comments in notifications | Mostly | |
| 12 | `20261022000000_grade_calculation_and_session_generation.sql` | Grade calc + session generation | Mostly | |
| 13 | `20261023000000_remove_frontdesk_max_three_admins.sql` | **Max 3 admins** + remove frontdesk role | Yes | Critical security |
| 14 | `20261024000000_notifications_delete_own.sql` | Users can delete own notifications | Yes | |
| 15 | `20261026_add_zoom_to_class_sessions.sql` | Zoom columns on class_sessions | Yes | |
| 16 | `20261029000000_attendance_submission_workflow.sql` | Attendance status machine (draft → submitted → …) | Yes | Required for Class Attendance |
| 17 | `20261029000001_attendance_edit_lock.sql` | Trigger: block attendance edits when submitted/approved | Yes | Required for Class Attendance |
| 18 | `20261029000002_force_batch_publish.sql` | Force batch publish support | Mostly | |
| 19 | `20261029000003_batch_publish_can_force.sql` | Permission helper for force publish | Mostly | |
| 20 | `20261030000000_fees_and_payments.sql` | Full fees, invoices, payments schema + RLS | Yes | Large, well-written |
| 21 | `20261030100000_admissions.sql` | Admission applications + RLS | Yes | |
| 22 | `20261030200000_production_hardening.sql` | Public catalog read + system_settings feature flags | Yes | |
| 23 | `20261030300000_admission_lookup.sql` | Admission status lookup | Yes | |
| 24 | `20261030400000_course_registration.sql` | Student course registration + RLS | Yes | |

### Critical helper scripts (run manually if needed)

| File | Purpose |
|------|---------|
| `APPLY_ATTENDANCE_WORKFLOW.sql` | One-shot install of attendance status + edit-lock (safe to re-run) |
| `APPLY_BATCH_PUBLISH.sql` | Batch publish helpers |

---

## Security Highlights Already Enforced in Database

- **Maximum of three administrator accounts** — enforced by triggers on `profiles` (`guard_profile_security_fields` + insert guard). Cannot be bypassed from the frontend.
- Students may only insert **pending** payments.
- Attendance rows are locked once the parent session is `submitted` or `approved`.
- Many SECURITY DEFINER functions set `search_path = public`.

---

## Edge Function Secrets

### Zoom (`zoom-meeting`)
- `ZOOM_ACCOUNT_ID`
- `ZOOM_CLIENT_ID`
- `ZOOM_CLIENT_SECRET`
- `ZOOM_USER_EMAIL`

### Browser push (`send-push-notification`)
- VAPID private key (server-side secret)
- Frontend: `VITE_VAPID_PUBLIC_KEY`

---

## Roles

Application roles: **admin**, **lecturer**, **student**.  
Front desk role was removed. Campus clock-in is admin-only.  
Maximum **3** active administrators (database-enforced).

---

## Feature Flags (`system_settings`)

| Key | Default | Meaning |
|-----|---------|--------|
| `fee_clearance_required` | `{ "enabled": true }` | Block results/transcript when outstanding fees exist |
| `payments_auto_complete` | `{ "enabled": false }` | If false, student payments stay `pending` until admin confirms |

---

## Recovery Notes

If you ever need the original bootstrap SQL:

```bash
git show 26289249ca5bde0eb143db7910a526a72527d2d4:unhimas/supabase/schema.sql > schema.bootstrap.sql
```

Then still run **all** migrations after that snapshot.
