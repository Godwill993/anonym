# zoom-meeting — Supabase Edge Function

This Edge Function acts as a secure backend proxy to the Zoom API.
It creates and deletes Zoom meetings on behalf of your app.

The frontend is fully wired:

- **Lecturer → Class Sessions**: checkbox “Create Zoom meeting”, Add/Remove Zoom, Start Meeting
- **Admin → Class Sessions**: same controls + ONLINE badge in the table
- **Student dashboard**: Join Meeting button (with password when present) on upcoming online sessions

---

## 🔑 Step 1 — Create a Zoom Server-to-Server OAuth App

1. Go to **https://marketplace.zoom.us/**
2. Click **Develop → Build App**
3. Choose **Server-to-Server OAuth** → click **Create**
4. Give it a name (e.g. `Unhimas LMS`)
5. Under **App Credentials**, copy:
   - **Account ID**
   - **Client ID**
   - **Client Secret**
6. Under **Scopes**, add: `meeting:write:meeting` and `meeting:delete:meeting`
7. **Activate** the app

---

## 🔐 Step 2 — Set Secrets in Supabase

Go to your **Supabase Dashboard → Edge Functions → zoom-meeting → Secrets**
and add the following secrets:

| Secret Name          | Value                                           |
|----------------------|-------------------------------------------------|
| `ZOOM_ACCOUNT_ID`    | Your Account ID from Step 1                     |
| `ZOOM_CLIENT_ID`     | Your Client ID from Step 1                      |
| `ZOOM_CLIENT_SECRET` | Your Client Secret from Step 1                  |
| `ZOOM_USER_EMAIL`    | The email of the Zoom account hosting meetings  |

**OR** use the Supabase CLI:

```bash
npx supabase secrets set ZOOM_ACCOUNT_ID=your_account_id
npx supabase secrets set ZOOM_CLIENT_ID=your_client_id
npx supabase secrets set ZOOM_CLIENT_SECRET=your_client_secret
npx supabase secrets set ZOOM_USER_EMAIL=your@email.com
```

---

## 🚀 Step 3 — Deploy the Function

```bash
npx supabase functions deploy zoom-meeting
```

---

## 🗄️ Step 4 — Run the SQL Migration

Run this SQL in your **Supabase Dashboard → SQL Editor** (or apply migration `20261026_add_zoom_to_class_sessions.sql`):

```sql
ALTER TABLE class_sessions
  ADD COLUMN IF NOT EXISTS zoom_meeting_id TEXT,
  ADD COLUMN IF NOT EXISTS zoom_join_url   TEXT,
  ADD COLUMN IF NOT EXISTS zoom_start_url  TEXT,
  ADD COLUMN IF NOT EXISTS zoom_password   TEXT;

CREATE INDEX IF NOT EXISTS idx_class_sessions_zoom_meeting_id
  ON class_sessions (zoom_meeting_id)
  WHERE zoom_meeting_id IS NOT NULL;
```

---

After completing these steps, lecturers and admins can create online sessions and Zoom meetings will be created automatically. Students will see a **Join Meeting** button on their dashboard for online classes.
