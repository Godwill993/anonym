-- Batch results: optional force publish when not every course is ready.
-- Normal path unchanged: all courses must be approved (or already published).
-- Force path: admin publishes only approved courses; incomplete courses stay unpublished.

-- Drop old 2-arg overload if present, then create 3-arg with default.
drop function if exists public.publish_batch_results(uuid, uuid);

create or replace function public.publish_batch_results(
  p_batch_id uuid,
  p_semester_id uuid,
  p_force boolean default false
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total integer;
  v_ready integer;
  v_approved integer;
  v_published integer := 0;
  v_batch_name text;
  v_sem_name text;
begin
  if not public.is_admin() then
    raise exception 'Only an administrator may publish batch results.';
  end if;

  select b.name, sem.name
    into v_batch_name, v_sem_name
  from public.batches b
  cross join public.semesters sem
  where b.id = p_batch_id
    and sem.id = p_semester_id;

  if v_batch_name is null or v_sem_name is null then
    raise exception 'Batch or semester not found.';
  end if;

  select count(*)::integer,
         count(*) filter (where ms.status in ('approved', 'published'))::integer,
         count(*) filter (where ms.status = 'approved')::integer
    into v_total, v_ready, v_approved
  from public.batch_courses bc
  left join public.mark_submissions ms on ms.batch_course_id = bc.id
  where bc.batch_id = p_batch_id
    and bc.semester_id = p_semester_id;

  if v_total = 0 then
    raise exception 'No courses are assigned to this batch for the selected semester.';
  end if;

  if not p_force then
    if v_ready < v_total then
      raise exception
        'Cannot publish results for % (%) — % of % courses still lack approved marks. Approve all courses, or use Force publish to release only the approved ones.',
        v_batch_name, v_sem_name, (v_total - v_ready), v_total;
    end if;
  else
    if v_approved = 0 and v_ready = 0 then
      raise exception
        'Force publish requires at least one approved marksheet for % (%).',
        v_batch_name, v_sem_name;
    end if;
    if v_approved = 0 then
      -- Everything ready is already published
      return 0;
    end if;
    -- Allow trigger to skip full-batch gate for this transaction only
    perform set_config('unhimas.force_batch_publish', 'on', true);
  end if;

  update public.mark_submissions ms
     set status = 'published',
         published_at = coalesce(ms.published_at, now()),
         admin_comment = case
           when p_force then coalesce(ms.admin_comment, 'Force-published (batch incomplete)')
           else coalesce(ms.admin_comment, 'Published with full batch results')
         end,
         reviewed_at = coalesce(ms.reviewed_at, now()),
         reviewed_by = coalesce(ms.reviewed_by, auth.uid()),
         updated_at = now()
    from public.batch_courses bc
   where ms.batch_course_id = bc.id
     and bc.batch_id = p_batch_id
     and bc.semester_id = p_semester_id
     and ms.status = 'approved';

  get diagnostics v_published = row_count;
  return v_published;
end;
$$;

revoke all on function public.publish_batch_results(uuid, uuid, boolean) from public, anon;
grant execute on function public.publish_batch_results(uuid, uuid, boolean) to authenticated;

-- Trigger: allow approved → published when force flag is set for this transaction
create or replace function public.guard_submission_workflow()
returns trigger
language plpgsql
as $$
declare
  v_batch_id uuid;
  v_semester_id uuid;
  v_total integer;
  v_ready integer;
  v_force text;
begin
  if old.status = 'published' and new.status <> 'published' and not public.is_admin() then
    raise exception 'Published submissions can only be changed by an administrator';
  end if;

  if new.status = 'submitted' and old.status not in ('draft','returned') then
    raise exception 'Only draft or returned submissions can be submitted';
  end if;

  if new.status = 'approved' and old.status <> 'submitted' then
    raise exception 'Only submitted marks can be approved';
  end if;

  if new.status = 'published' and old.status <> 'approved' then
    raise exception 'Only approved marks can be published';
  end if;

  if new.status = 'returned' and old.status <> 'submitted' then
    raise exception 'Only submitted marks can be returned';
  end if;

  -- Batch completeness gate (skipped only for admin force-publish transaction)
  if new.status = 'published' and old.status is distinct from 'published' then
    v_force := current_setting('unhimas.force_batch_publish', true);
    if v_force is distinct from 'on' then
      select bc.batch_id, bc.semester_id
        into v_batch_id, v_semester_id
      from public.batch_courses bc
      where bc.id = new.batch_course_id;

      select count(*)::integer,
             count(*) filter (
               where (
                 case
                   when bc.id = new.batch_course_id then 'published'
                   else coalesce(ms.status::text, 'draft')
                 end
               ) in ('approved', 'published')
             )::integer
        into v_total, v_ready
      from public.batch_courses bc
      left join public.mark_submissions ms on ms.batch_course_id = bc.id
      where bc.batch_id = v_batch_id
        and bc.semester_id = v_semester_id;

      if v_ready < v_total then
        raise exception
          'Cannot publish a single course until every course in this batch and semester has approved marks (% of % ready). Use Publish batch results, or Force publish to release only approved courses.',
          v_ready, v_total;
      end if;
    end if;

    new.published_at := coalesce(new.published_at, now());
  end if;

  return new;
end;
$$;
