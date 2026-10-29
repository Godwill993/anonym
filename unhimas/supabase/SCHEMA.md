# Schema policy

| Artifact | Role |
|----------|------|
| `migrations/*.sql` | **Source of truth** — apply all, in order |
| `schema.sql` | Pointer + recovery note only (not live schema) |
| `MIGRATIONS.md` | Ops checklist (secrets, critical migrations) |

## Recover old bootstrap SQL

```bash
git show 26289249ca5bde0eb143db7910a526a72527d2d4:unhimas/supabase/schema.sql > schema.bootstrap.sql
```

Then still run all migrations after that snapshot.
