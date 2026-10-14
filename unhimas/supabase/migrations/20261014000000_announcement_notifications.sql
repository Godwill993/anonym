create or replace function public.notify_announcement_recipients()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not new.is_published then
    return new;
  end if;

  if tg_op = 'UPDATE' and old.is_published then
    return new;
  end if;

  insert into public.notifications (
    recipient_id,
    title,
    message,
    notification_type,
    related_table,
    related_id
  )
  select recipients.profile_id,
    new.title,
    new.body,
    'announcement',
    'announcements',
    new.id
  from (
    select p.id as profile_id
    from public.students s
    join public.profiles p on p.id = s.profile_id
    join public.batches b on b.id = s.batch_id
    where s.is_active
      and p.is_active
      and p.role = 'student'
      and (new.batch_id is null or s.batch_id = new.batch_id)
      and (new.department_id is null or b.department_id = new.department_id)

    union

    select p.id as profile_id
    from public.lecturers l
    join public.profiles p on p.id = l.profile_id
    where l.is_active
      and p.is_active
      and p.role = 'lecturer'
      and (new.department_id is null or l.department_id = new.department_id)
      and (
        new.batch_id is null
        or exists (
          select 1
          from public.batch_courses bc
          where bc.batch_id = new.batch_id
            and bc.lecturer_id = l.id
        )
      )
  ) recipients
  where not exists (
    select 1
    from public.notifications n
    where n.recipient_id = recipients.profile_id
      and n.notification_type = 'announcement'
      and n.related_table = 'announcements'
      and n.related_id = new.id
  );

  return new;
end;
$$;

drop trigger if exists trg_notify_announcement_recipients on public.announcements;
create trigger trg_notify_announcement_recipients
after insert or update of is_published on public.announcements
for each row
execute function public.notify_announcement_recipients();
