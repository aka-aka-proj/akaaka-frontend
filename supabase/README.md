# Supabase Migrations

This directory contains the SQL migration files for the AkaAka Supabase backend.

## Migration files

| File | Description |
|------|-------------|
| `20260717000001_initial_schema.sql` | All core tables, constraints, and indexes |
| `20260717000002_rls_policies.sql` | Row Level Security enabled on every table + all policies (Issue #4) |
| `20260717000003_audit_triggers.sql` | Reputation score trigger + audit log triggers for role/moderation changes (Issue #2) |

## Applying migrations

### Option A — Supabase CLI (`supabase db push`)

> Requires the [Supabase CLI](https://supabase.com/docs/guides/cli) and a linked project.

```bash
# 1. Install CLI (if you haven't already)
npm install -g supabase

# 2. Log in
supabase login

# 3. Link to your project (one-time)
supabase link --project-ref <YOUR_PROJECT_REF>

# 4. Push all pending migrations
supabase db push
```

All files in `supabase/migrations/` are applied in timestamp order and tracked in `supabase_migrations.schema_migrations`.

### Option B — Supabase Dashboard SQL Editor

1. Open your project at <https://app.supabase.com>.
2. Navigate to **Database → SQL Editor**.
3. Open each migration file in order and click **Run**:
   1. `20260717000001_initial_schema.sql`
   2. `20260717000002_rls_policies.sql`
   3. `20260717000003_audit_triggers.sql`

### Option C — `psql` direct connection

```bash
psql "$DATABASE_URL" \
  -f supabase/migrations/20260717000001_initial_schema.sql \
  -f supabase/migrations/20260717000002_rls_policies.sql \
  -f supabase/migrations/20260717000003_audit_triggers.sql
```

`DATABASE_URL` can be found in your Supabase project settings under **Settings → Database → Connection string**.

## RLS overview

Row Level Security is **enabled on every table** (deny-by-default). The key rules are:

| Table | Rule summary |
|-------|-------------|
| `profiles` | All authenticated users can read; users update only their own row |
| `events` | All authenticated users can read; owners insert/update; venue-hosted events require `venue_approved` role |
| `event_threads` | All authenticated users can read; owners insert/update their own posts |
| `recommendations` | All authenticated users can read; users send from their own profile only |
| `blocks` | Users see/manage only their own blocks |
| `reports` | Owners read their own reports; admins read all; anyone authenticated can file |
| `moderation_actions` | Admins only (read + write) |
| `audit_logs` | Admins read; inserts restricted to admins / `SECURITY DEFINER` triggers |

## Audit log triggers

Two `SECURITY DEFINER` triggers automatically populate `audit_logs`:

- **`trg_log_role_status_change`** — fires after any `UPDATE` on `profiles` where `role_status` changes.
- **`trg_log_moderation_action`** — fires after every `INSERT` into `moderation_actions`.

Because the functions are `SECURITY DEFINER`, they bypass RLS on `audit_logs` and can insert even without an admin JWT, ensuring no audit event is silently dropped.
