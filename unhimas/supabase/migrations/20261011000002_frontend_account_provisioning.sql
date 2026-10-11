-- Allow the authenticated admin frontend to link a newly signed-up Auth user.
-- Auth user creation still uses Supabase's public sign-up API; never expose a
-- service-role key to the browser.

create or replace function public.provision_school_account_direct(
  p_user_id     uuid,
  p_record_type text,
  p_record_id   uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
      from public.profiles
     where id = auth.uid()
       and role = 'admin'
       and is_active = true
  ) then
    raise exception 'Only an active administrator may link a school account.';
  end if;

  if not exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'Auth profile row has not been created for this user.';
  end if;

  if p_record_type = 'student' then
    update public.students
       set profile_id = p_user_id,
           must_reset_password = true
     where id = p_record_id
       and profile_id is null
       and is_active = true;

    if not found then
      raise exception 'Student record not found, is inactive, or already linked to an account.';
    end if;

    update public.profiles
       set role = 'student'
     where id = p_user_id;

  elsif p_record_type = 'lecturer' then
    update public.lecturers
       set profile_id = p_user_id,
           must_reset_password = true
     where id = p_record_id
       and profile_id is null
       and is_active = true;

    if not found then
      raise exception 'Lecturer record not found, is inactive, or already linked to an account.';
    end if;

    update public.profiles
       set role = 'lecturer'
     where id = p_user_id;

  else
    raise exception 'Unsupported record type: %. Expected ''student'' or ''lecturer''.', p_record_type;
  end if;
end;
$$;

revoke all on function public.provision_school_account_direct(uuid, text, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.provision_school_account_direct(uuid, text, uuid)
  to authenticated;
