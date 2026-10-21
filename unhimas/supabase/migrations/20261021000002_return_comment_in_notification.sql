-- ============================================================
-- When marks are returned, put the admin complaint in the notification
-- ============================================================

create or replace function public.notify_mark_submission()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recipient uuid;
  course_name text;
  batch_uuid uuid;
  return_msg text;
begin
  select c.name, bc.batch_id
    into course_name, batch_uuid
  from public.batch_courses bc
  join public.courses c on c.id = bc.course_id
  where bc.id = new.batch_course_id;

  select p.id into recipient
  from public.lecturers l
  join public.profiles p on p.id = l.profile_id
  where l.id = new.lecturer_id;

  if recipient is not null and new.status = 'returned' and old.status is distinct from 'returned' then
    return_msg := coalesce(nullif(trim(new.admin_comment), ''), 'Please review and correct the marksheet.');
    insert into public.notifications(recipient_id, title, message, notification_type, related_table, related_id)
    values (
      recipient,
      'Marks returned',
      'Your marks for ' || coalesce(course_name, 'the course') || ' were returned for correction. Admin note: ' || return_msg,
      'marks_returned',
      'mark_submissions',
      new.id
    );
  elsif recipient is not null and new.status = 'approved' and old.status is distinct from 'approved' then
    insert into public.notifications(recipient_id, title, message, notification_type, related_table, related_id)
    values (
      recipient,
      'Marks approved',
      'Your marks for ' || coalesce(course_name, 'the course') || ' were approved.',
      'marks_approved',
      'mark_submissions',
      new.id
    );
  end if;

  if new.status = 'published' and old.status is distinct from 'published' then
    insert into public.notifications (
      recipient_id, title, message, notification_type, related_table, related_id
    )
    select
      p.id,
      'Results published',
      'Results for ' || coalesce(course_name, 'a course') || ' have been published.',
      'results_published',
      'mark_submissions',
      new.id
    from public.students s
    join public.profiles p on p.id = s.profile_id
    where s.batch_id = batch_uuid
      and s.is_active = true
      and p.is_active = true
      and p.role = 'student';
  end if;

  return new;
end;
$$;
