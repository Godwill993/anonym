-- Allow users to permanently clear their own notification inbox
-- (admin may also delete; UI always scopes wipe to the current profile)

drop policy if exists notifications_delete_own on public.notifications;

create policy notifications_delete_own on public.notifications
for delete to authenticated
using (recipient_id = auth.uid() or public.is_admin());
