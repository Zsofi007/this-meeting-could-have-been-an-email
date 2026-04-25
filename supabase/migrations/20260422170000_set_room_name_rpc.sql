-- Any room "member" (creator or has posted) may rename; only `name` is updated in app via this RPC.
create or replace function public.set_room_name(p_room_id text, p_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  ok boolean;
begin
  p_name := trim(p_name);
  if length(p_name) < 1 or length(p_name) > 120 then
    raise exception 'invalid name length';
  end if;

  select
    r.created_by = (select auth.uid())
    or exists (
      select 1
      from public.messages m
      where m.room_id = r.id
        and m.user_id = (select auth.uid())
        and m.deleted_at is null
    )
  into ok
  from public.rooms r
  where r.id = p_room_id;

  if not coalesce(ok, false) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  update public.rooms
  set name = p_name
  where id = p_room_id;
end;
$$;

grant execute on function public.set_room_name(text, text) to authenticated;
