# anonym

Repository for the **UNHIMAS** school management system.

The application lives in the [`unhimas/`](./unhimas) directory.

- **Live app:** https://schoolmanagement-two-olive.vercel.app
- **Setup & docs:** see [unhimas/README.md](./unhimas/README.md)

## Deploy

On Vercel set **Root Directory** to `unhimas` (recommended), or use the root `vercel.json`.

Required env vars:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Optional: `VITE_VAPID_PUBLIC_KEY` for browser push.

Zoom (Supabase Edge Function secrets): `ZOOM_ACCOUNT_ID`, `ZOOM_CLIENT_ID`, `ZOOM_CLIENT_SECRET`, `ZOOM_USER_EMAIL`.
