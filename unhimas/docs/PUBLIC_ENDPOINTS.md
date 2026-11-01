# UNHIMAS — Public endpoints security model

Unauthenticated (or weakly authenticated) surfaces require explicit controls.
This note inventories those routes and the protections currently in code.

## Inventory

| Route / entry | Purpose | Primary controls |
|---------------|---------|------------------|
| `/apply` | Online admission application | Honeypot (`website`), min form time (~2.5s), field validation + sanitize, silent bot response |
| Application status page | Lookup by application number + email | Number/email validation & normalize, dual-factor RPC, **8s client throttle** |
| Public results verification | Lookup published grades by matricule | Matricule validation & normalize, read-only RPC, **8s client throttle** |
| `/login` | Authenticated access | Supabase Auth; inactive profiles blocked in app |

## Client helpers

Implemented in `src/lib/publicFormGuard.js` (unit-tested):

- Honeypot / timing / admission payload validate+sanitize
- Application lookup validate/normalize
- Results matricule validate/normalize
- Public lookup throttle (`sessionStorage`, default 8s)

## Server expectations

| Mechanism | Expectation |
|-----------|-------------|
| `lookup_admission_application` RPC | SECURITY DEFINER; requires number **and** email; minimal columns |
| `public_result_lookup` RPC | SECURITY DEFINER; **published** results only; no private contact data |
| `admission_applications` insert | RLS allows controlled public insert of applications only |
| Payments | Students cannot force `completed` from the client in production |

## Residual gaps (not replaced by client code)

1. **Live RLS inventory** — run `supabase/scripts/rls_inventory.sql` on production.
2. **Edge rate limits / WAF** — client throttle is bypassable; use Cloudflare or Supabase limits under load.
3. **CAPTCHA** — recommended for `/apply` when spam increases (Turnstile/hCaptcha).
4. **CAPTCHA/env** — reserve `VITE_TURNSTILE_SITE_KEY` (optional; not wired yet).

## Observability

Render crashes flow through `ErrorBoundary` → `reportError` in `src/lib/observability.js`.
To attach Sentry later without rewriting call sites, set:

```js
window.__UNHIMAS_REPORT_ERROR__ = (error, context) => {
  // Sentry.captureException(error, { extra: context })
};
```

Or install `@sentry/react` and initialize in `main.jsx` when `VITE_SENTRY_DSN` is present.
