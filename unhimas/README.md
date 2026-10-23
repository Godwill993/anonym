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

## Tests

```bash
npm test
```

## i18n

English / French via `src/i18n`. Toggle with the **FR/EN** control in the header. UI labels are translated; user data (names, codes, scores) is not.
