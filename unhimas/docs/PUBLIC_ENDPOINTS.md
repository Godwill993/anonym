# UNHIMAS — Public endpoints security model

Unauthenticated (or weakly authenticated) surfaces require explicit controls.
This note inventories those routes and the protections currently in code.

## Inventory

| Route / entry | Purpose | Primary controls |
|---------------|---------|------------------|
| `/apply` | Online admission application | Honeypot, min form time, validation, optional **Turnstile + server verify** |
| Application status page | Lookup by application number + email | Number/email validation, dual-factor RPC, **8s client throttle** |
| Public results verification | Lookup published grades by matricule | Matricule validation, read-only RPC, **8s client throttle** |
| `/login` | Authenticated access | Supabase Auth; inactive profiles blocked in app |

## Client helpers

- `src/lib/publicFormGuard.js` — honeypot, timing, lookup validation, throttle
- `src/lib/turnstile.js` — site key gate, script loader, **server verify** via Edge Function

## Enabling Turnstile (end-to-end)

1. Create a Cloudflare Turnstile widget.
2. Frontend:

```env
VITE_TURNSTILE_SITE_KEY=your_site_key
```

3. Supabase secrets + deploy:

```bash
npx supabase secrets set TURNSTILE_SECRET_KEY=your_secret_key
npx supabase functions deploy verify-turnstile
```

4. Redeploy the web app.

When the site key is **unset**, `/apply` skips Turnstile entirely (honeypot + timing only).

When the site key is **set**, submit flow:

1. Require a widget token locally
2. `POST` to Edge Function `verify-turnstile` (Cloudflare siteverify)
3. Only then insert the application

## Server expectations

| Mechanism | Expectation |
|-----------|-------------|
| `verify-turnstile` | Secret `TURNSTILE_SECRET_KEY`; public invoke with anon key |
| `lookup_admission_application` RPC | SECURITY DEFINER; number **and** email |
| `public_result_lookup` RPC | Published results only |
| Payments | Students cannot force `completed` from the client in production |

## Residual gaps

1. Live RLS inventory (`supabase/scripts/rls_inventory.sql`)
2. Edge rate limits / WAF under heavy attack
3. Application insert is still a direct client insert after CAPTCHA — acceptable for most campuses; a single “submit application” Edge Function could combine verify + insert later

## Observability

`ErrorBoundary` → `src/lib/observability.js` (`reportError`). Optional Sentry via `VITE_SENTRY_DSN` or `window.__UNHIMAS_REPORT_ERROR__`.
