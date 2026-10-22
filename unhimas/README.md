# UNHIMAS — School Management System

Universal Higher Institute of Management and Sciences (UNHIMAS) portal.

Live: https://schoolmanagement-two-olive.vercel.app

## Stack

- **Frontend:** React 19, Vite 8, React Router 7, TanStack Query, React Hook Form + Zod, Recharts
- **Backend:** Supabase (Auth, Postgres, Storage, Edge Functions, Vault)
- **i18n:** English / French
- **Push:** Web Push (VAPID) + `send-push-notification` Edge Function

## Roles

| Role | Capabilities |
|------|----------------|
| **Admin** | Academic structure, people, marks approval, results publish, announcements, reports, settings, audit log |
| **Front desk** | Lecturer clock-in / clock-out, shift history |
| **Lecturer** | Courses, sessions, attendance, mark entry & submit |
| **Student** | Courses, attendance, results, transcript, timetable, resources |

Public results verification is available at `/results` without login.

## Local setup

```bash
cd unhimas
cp .env.example .env
# Fill VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY from Supabase → Settings → API
npm install
npm run dev
```

Apply SQL migrations under `supabase/migrations/` (or run `supabase/schema.sql` on a fresh project), then deploy Edge Functions if you use browser push.

### Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Vite dev server |
| `npm run build` | Production build |
| `npm run preview` | Preview production build |
| `npm run lint` | ESLint |
| `npm test` | Transcript + grading unit tests |

## Browser push notifications

Requires HTTPS (localhost is fine for development), Push API support, and user opt-in. On iOS the site must be added to the Home Screen.

1. Generate VAPID keys: `npx web-push generate-vapid-keys`
2. Set `VITE_VAPID_PUBLIC_KEY` in the frontend env.
3. Set Edge Function secrets: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `PUSH_WEBHOOK_SECRET`
4. Deploy: `supabase functions deploy send-push-notification`
5. Apply migration `20261015000000_browser_push_notifications.sql`
6. Store `project_url` and `push_webhook_secret` in Supabase Vault (see migration comments)

Do **not** put private keys or webhook secrets in frontend env or source control.

## Project layout

```
unhimas/
├── public/                 # PWA assets, service worker
├── src/
│   ├── components/         # Shared UI + app shell
│   ├── context/            # Auth, theme
│   ├── hooks/
│   ├── i18n/
│   ├── lib/                # supabase client, permissions, transcript, grading
│   ├── pages/              # admin | frontdesk | lecturer | student | auth | public
│   ├── routes/             # ProtectedRoute
│   ├── services/           # Supabase data access
│   └── styles/
├── supabase/
│   ├── migrations/
│   ├── functions/send-push-notification/
│   └── schema.sql          # Full schema for fresh projects
└── package.json
```

## Security notes

- Never commit `.env` or Supabase service-role keys.
- Account provisioning uses an isolated Auth client so admin sessions are not replaced on signup.
- Role and capability checks on the client are for UX only; enforce access with Supabase RLS and SECURITY DEFINER RPCs.

## Recent implementation notes (2026-10-22)

- **Grade calculation** is now explicit and shared:
  - Client: `src/lib/grading.js` (+ unit tests).
  - Persisted on every mark upsert; DB trigger `trg_marks_set_grade` keeps `marks.grade` / `grade_point` in sync with scores using `grading_scale`.
  - Apply migration `supabase/migrations/20261022000000_grade_calculation_and_session_generation.sql`.
- **Timetable → sessions**: Admin Class Sessions page can generate concrete sessions from weekly timetable slots for a date range (RPC `generate_sessions_from_timetable`, max 90 days, skips existing same-day sessions).

## License

Private / institutional use unless otherwise stated.
