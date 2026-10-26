# zoom-meeting — Supabase Edge Function

This Edge Function acts as a secure backend proxy to the Zoom API.
It creates and deletes Zoom meetings on behalf of your app.

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

| Secret Name         | Value                                          |
|---------------------|------------------------------------------------|
| `ZOOM_ACCOUNT_ID`   | Your Account ID from Step 1                   |
| `ZOOM_CLIENT_ID`    | Your Client ID from Step 1                    |
| `ZOOM_CLIENT_SECRET`| Your Client Secret from Step 1                |
| `ZOOM_USER_EMAIL`   | The email of the Zoom account hosting meetings |

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

Run this SQL in your **Supabase Dashboard → SQL Editor** to add Zoom columns
to the `class_sessions` table:

```sql
ALTER TABLE class_sessions
  ADD COLUMN IF NOT EXISTS zoom_meeting_id TEXT,
  ADD COLUMN IF NOT EXISTS zoom_join_url   TEXT,
  ADD COLUMN IF NOT EXISTS zoom_start_url  TEXT,
  ADD COLUMN IF NOT EXISTS zoom_password   TEXT;
```

---

After completing these steps, lecturers can toggle "Online Class" when creating
a session and a Zoom meeting will be created automatically. Students will see
a "Join Meeting" button on their sessions/timetable view.
