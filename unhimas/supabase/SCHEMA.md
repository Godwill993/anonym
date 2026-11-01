# Schema Policy

| Artifact | Role |
|----------|------|
| `migrations/*.sql` | **Source of truth** — apply all, in chronological order |
| `schema.sql` | Historical bootstrap snapshot only (not the live schema) |
| `MIGRATIONS.md` | Full ordered list, purpose of each migration, safety notes, secrets, feature flags |

## Important Rules

- Never use `schema.sql` as the production schema.
- Always apply migrations in the order documented in `MIGRATIONS.md`.
- Prefer new corrective migrations over editing already-applied historical migrations.
- Max-3-admins, attendance edit locks, and payment pending-only inserts are enforced in the database.

## Recover old bootstrap SQL

```bash
git show 26289249ca5bde0eb143db7910a526a72527d2d4:unhimas/supabase/schema.sql > schema.bootstrap.sql
```

Then still run all migrations after that snapshot.
