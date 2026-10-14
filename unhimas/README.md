# React + TypeScript + Vite

## Browser push notifications

Push notifications require HTTPS (localhost is supported for development), a browser
that supports the Push API, and a one-time opt-in on each device. On iOS, users
must first add the site to their Home Screen. The in-app notification list continues
to work when browser push is unavailable or disabled.

1. Generate a VAPID key pair, for example with `npx web-push generate-vapid-keys`.
   Add the public key to the frontend environment as `VITE_VAPID_PUBLIC_KEY`.
2. Generate a separate random webhook secret. Keep it private and set the same
   value as `PUSH_WEBHOOK_SECRET` for the Edge Function and in Supabase Vault as
   `push_webhook_secret`. Add the Supabase project URL to Vault as `project_url`.
   Do not put either secret in frontend environment variables or source control.
3. Set `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, and
   `PUSH_WEBHOOK_SECRET` as Supabase Edge Function secrets using
   `supabase secrets set VAPID_PUBLIC_KEY=<public-key>
   VAPID_PRIVATE_KEY=<private-key> VAPID_SUBJECT=mailto:lendzelegoodwill@gmail.com
   PUSH_WEBHOOK_SECRET=<random-secret>`. Deploy `send-push-notification` with
   `supabase functions deploy send-push-notification`.
4. Apply `20261015000000_browser_push_notifications.sql` to the Supabase project,
   then rebuild and deploy the frontend with its public VAPID key.

The migration creates per-user push subscriptions and a database trigger that
dispatches every newly inserted notification to the Edge Function. Users enable
or disable push on each device using the notification bell controls.

Vault setup (run in the Supabase SQL editor, replacing placeholders with the
project URL and the same random webhook secret used for the Edge Function):

```sql
select vault.create_secret('https://<project-ref>.supabase.co', 'project_url');
select vault.create_secret('<random-webhook-secret>', 'push_webhook_secret');
```

The database migration requires Supabase's `pg_net` and Vault extensions.

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])

```

You can also install [eslint-plugin-react-x](https://npmx.dev/package/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://npmx.dev/package/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])

```
