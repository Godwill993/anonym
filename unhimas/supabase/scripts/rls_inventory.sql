-- ============================================================
-- UNHIMAS — RLS Inventory Diagnostic (READ-ONLY)
-- ============================================================
-- Run this in the Supabase SQL Editor (or any Postgres client).
-- It does NOT modify data, schemas, or policies.
--
-- Purpose:
--   1. List every table that has RLS enabled / disabled
--   2. Dump all current policies with their definitions
--   3. Show current administrator count (max 3 is enforced by trigger)
--   4. Highlight tables that are missing RLS (potential risk)
-- ============================================================

-- 1. Administrator count (database-enforced max = 3)
SELECT
  'admin_count' AS check_name,
  count(*) FILTER (WHERE role = 'admin' AND is_active = true) AS active_admins,
  count(*) FILTER (WHERE role = 'admin') AS total_admin_profiles,
  CASE
    WHEN count(*) FILTER (WHERE role = 'admin' AND is_active = true) > 3
      THEN 'VIOLATION — more than 3 active admins'
    WHEN count(*) FILTER (WHERE role = 'admin' AND is_active = true) = 3
      THEN 'AT LIMIT'
    ELSE 'OK'
  END AS status
FROM public.profiles;

-- 2. Tables and RLS status
SELECT
  n.nspname AS schema,
  c.relname AS table_name,
  CASE WHEN c.relrowsecurity THEN 'ENABLED' ELSE 'DISABLED' END AS rls_status,
  CASE WHEN c.relforcerowsecurity THEN 'YES' ELSE 'NO' END AS force_rls
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind = 'r'
  AND n.nspname = 'public'
ORDER BY
  CASE WHEN c.relrowsecurity THEN 0 ELSE 1 END,
  c.relname;

-- 3. Full policy inventory
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual AS using_expression,
  with_check AS with_check_expression
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- 4. Tables that have RLS disabled (highest risk)
SELECT
  c.relname AS table_without_rls
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind = 'r'
  AND n.nspname = 'public'
  AND NOT c.relrowsecurity
ORDER BY c.relname;

-- 5. Quick counts of key sensitive tables (existence check)
SELECT
  (SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') AS has_profiles,
  (SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'students') AS has_students,
  (SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'lecturers') AS has_lecturers,
  (SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'marks') AS has_marks,
  (SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'mark_submissions') AS has_mark_submissions,
  (SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'attendance') AS has_attendance,
  (SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'payments') AS has_payments,
  (SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'resources') AS has_resources;
