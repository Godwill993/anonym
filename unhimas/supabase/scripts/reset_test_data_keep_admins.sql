-- DESTRUCTIVE: removes application/test data and all non-admin Auth accounts.
-- Run only on the intended project after taking a backup.
-- Preserves administrator profiles/Auth users and global configuration/catalogue
-- data: settings, system_settings, grading_scale, programmes,
-- programme_progressions, and fee_categories.
--
-- Supabase Storage objects are not deleted by this script.

begin;

do $$
declare
  v_admin_count integer;
  v_table text;
  v_deleted bigint;
begin
  select count(*) into v_admin_count
  from public.profiles
  where role = 'admin';

  if v_admin_count = 0 then
    raise exception 'Reset cancelled: no administrator profile exists to preserve.';
  end if;

  -- Delete child/transaction records before the records they reference.
  foreach v_table in array array[
    'payments',
    'invoice_items',
    'student_invoices',
    'student_course_registrations',
    'attendance',
    'marks',
    'mark_submissions',
    'timetable_slots',
    'class_sessions',
    'lecturer_shifts',
    'student_transfers',
    'student_programme_completions',
    'admission_applications',
    'resources',
    'academic_events',
    'announcements',
    'notifications',
    'push_subscriptions',
    'audit_log',
    'fee_structures',
    'batch_courses',
    'students',
    'lecturers',
    'batches',
    'courses',
    'semesters',
    'academic_years',
    'departments'
  ]
  loop
    if to_regclass(format('public.%I', v_table)) is not null then
      execute format('delete from public.%I', v_table);
      get diagnostics v_deleted = row_count;
      raise notice 'Deleted % rows from public.%', v_deleted, v_table;
    end if;
  end loop;

  -- Keep administrator accounts; remove all other application profiles.
  delete from public.profiles
  where role <> 'admin';
  get diagnostics v_deleted = row_count;
  raise notice 'Deleted % non-admin profiles.', v_deleted;

  -- Remove non-admin Auth identities as well, so test accounts cannot sign in.
  delete from auth.users u
  where not exists (
    select 1
    from public.profiles p
    where p.id = u.id and p.role = 'admin'
  );
  get diagnostics v_deleted = row_count;
  raise notice 'Deleted % non-admin Auth users.', v_deleted;
end;
$$;

commit;
