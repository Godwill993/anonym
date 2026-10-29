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

Optional: Web Push VAPID keys if notifications are enabled.

### Supabase Edge Function secrets (Zoom)

- `ZOOM_ACCOUNT_ID`, `ZOOM_CLIENT_ID`, `ZOOM_CLIENT_SECRET`, `ZOOM_USER_EMAIL`

### Database migrations (required)

Apply **all** files under `supabase/migrations/` in order on your Supabase project.
Do **not** rely on `supabase/schema.sql` alone — it is a historical bootstrap snapshot.
Later migrations remove `frontdesk`, add Zoom columns, marks/results RPCs, and attendance approval fields.

**Must apply for class attendance submit/approve:**

1. `20261029000000_attendance_submission_workflow.sql` — columns on `class_sessions`
2. `20261029000001_attendance_edit_lock.sql` — DB lock when status is submitted/approved

Admin UI: **Class Attendance** at `/admin/attendance` (sidebar → Academic Operations).

## Tests

```bash
npm test
```

## i18n

English / French via `src/i18n`. Toggle with the **FR/EN** control in the header. UI labels are translated; user data (names, codes, scores) is not. Coverage is still partial on some lecturer screens.
