-- ============================================================
-- Grade calculation (source of truth) + timetable → session generation
-- 2026-10-22
-- ============================================================

-- 1. Function: resolve grade from grading_scale for a total score
create or replace function public.resolve_grade(p_total numeric)
returns table (grade text, grade_point numeric)
language sql
stable
security invoker
set search_path = public
as $$
  select gs.grade, gs.grade_point
  from public.grading_scale gs
  where p_total >= gs.min_score
    and p_total <= gs.max_score
  order by gs.min_score desc
  limit 1;
$$;

-- 2. Trigger: always keep marks.grade / grade_point in sync with scores
create or replace function public.set_mark_grade_from_total()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_total numeric;
  v_grade text;
  v_gp numeric;
begin
  v_total := coalesce(new.attendance_score, 0)
           + coalesce(new.coursework_score, 0)
           + coalesce(new.exam_score, 0);

  select r.grade, r.grade_point
    into v_grade, v_gp
  from public.resolve_grade(v_total) r;

  if v_grade is null then
    if v_total >= 80 then
      v_grade := 'A'; v_gp := 4.00;
    elsif v_total >= 70 then
      v_grade := 'B'; v_gp := 3.00;
    elsif v_total >= 60 then
      v_grade := 'C'; v_gp := 2.00;
    elsif v_total >= 50 then
      v_grade := 'D'; v_gp := 1.00;
    else
      v_grade := 'F'; v_gp := 0.00;
    end if;
  end if;

  new.grade := v_grade;
  new.grade_point := v_gp;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_marks_set_grade on public.marks;
create trigger trg_marks_set_grade
  before insert or update of attendance_score, coursework_score, exam_score
  on public.marks
  for each row
  execute function public.set_mark_grade_from_total();

-- Backfill existing rows that lack grade
update public.marks m
set grade = r.grade,
    grade_point = r.grade_point,
    updated_at = now()
from public.resolve_grade(
  coalesce(m.attendance_score, 0)
  + coalesce(m.coursework_score, 0)
  + coalesce(m.exam_score, 0)
) r
where m.grade is null or m.grade_point is null;

-- 3. Generate class sessions from timetable slots for a date range
create or replace function public.generate_sessions_from_timetable(
  p_from date,
  p_to date,
  p_batch_course_id uuid default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
  r record;
  d date;
  v_start timestamptz;
  v_end timestamptz;
  v_dow smallint;
begin
  if p_from is null or p_to is null or p_to < p_from then
    raise exception 'Invalid date range: from % to %', p_from, p_to;
  end if;

  if p_to - p_from > 90 then
    raise exception 'Date range too large (max 90 days). Requested % days.', (p_to - p_from);
  end if;

  for r in
    select
      ts.id as slot_id,
      ts.batch_course_id,
      ts.lecturer_id,
      ts.day_of_week,
      ts.start_time,
      ts.end_time,
      ts.room
    from public.timetable_slots ts
    where (p_batch_course_id is null or ts.batch_course_id = p_batch_course_id)
  loop
    d := p_from;
    while d <= p_to loop
      v_dow := extract(dow from d)::smallint;
      if v_dow = r.day_of_week then
        v_start := (d + r.start_time) at time zone 'Africa/Douala';
        v_end   := (d + r.end_time)   at time zone 'Africa/Douala';

        if not exists (
          select 1 from public.class_sessions cs
          where cs.batch_course_id = r.batch_course_id
            and cs.lecturer_id = r.lecturer_id
            and cs.scheduled_start::date = d
            and abs(extract(epoch from (cs.scheduled_start - v_start))) < 300
        ) then
          insert into public.class_sessions (
            batch_course_id, lecturer_id, room,
            scheduled_start, scheduled_end, topic
          ) values (
            r.batch_course_id, r.lecturer_id, r.room,
            v_start, v_end, null
          );
          v_count := v_count + 1;
        end if;
      end if;
      d := d + 1;
    end loop;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.generate_sessions_from_timetable(date, date, uuid)
  from public, anon;
grant execute on function public.generate_sessions_from_timetable(date, date, uuid)
  to authenticated;

revoke all on function public.resolve_grade(numeric) from public, anon;
grant execute on function public.resolve_grade(numeric) to authenticated;
