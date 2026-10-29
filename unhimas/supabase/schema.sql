-- UNHIMAS SCHOOL MANAGEMENT SYSTEM
-- Supabase / PostgreSQL
--
-- !! IMPORTANT !!
-- This file is a HISTORICAL BOOTSTRAP SNAPSHOT for a fresh project.
-- It is NOT the full production schema.
-- Always apply ALL files in supabase/migrations/ in order after (or instead of)
-- running this snapshot. See supabase/MIGRATIONS.md.
-- Later migrations remove frontdesk, add Zoom columns, attendance submit workflow,
-- marks publish RPCs, max-3-admins, etc.
--
-- Do NOT put the Supabase service-role key in the frontend.

create extension if not exists pgcrypto;
create extension if not exists pg_net;

-- ============================================================
-- 1. ENUMS
-- ============================================================

do $$ begin
  create type public.user_role as enum ('admin','frontdesk','lecturer','student');
exception when duplicate_object then null; end $$;

-- NOTE: frontdesk is legacy. Migration 20261023000000 removes front desk and caps admins at 3.
-- Application code only uses: admin | lecturer | student.
