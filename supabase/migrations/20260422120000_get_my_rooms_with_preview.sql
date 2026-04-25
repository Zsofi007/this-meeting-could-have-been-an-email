-- Rooms the user has created or posted in, with the latest public message in each (for dashboard).
create or replace function public.get_my_rooms_with_preview()
returns table (
  room_id text,
  name text,
  last_activity_at timestamptz,
  is_archived boolean,
  last_message_text text,
  last_message_at timestamptz,
  last_message_username text
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    r.id,
    r.name,
    r.last_activity_at,
    r.is_archived,
    (select m.text
     from public.messages m
     where m.room_id = r.id
       and m.deleted_at is null
     order by m.created_at desc
     limit 1),
    (select m.created_at
     from public.messages m
     where m.room_id = r.id
       and m.deleted_at is null
     order by m.created_at desc
     limit 1),
    (select m.username
     from public.messages m
     where m.room_id = r.id
       and m.deleted_at is null
     order by m.created_at desc
     limit 1)
  from public.rooms r
  where
    r.created_by = (select auth.uid())
    or exists (
      select 1
      from public.messages m2
      where m2.room_id = r.id
        and m2.user_id = (select auth.uid())
        and m2.deleted_at is null
    )
  order by
    coalesce(
      (select max(m3.created_at)
       from public.messages m3
       where m3.room_id = r.id
         and m3.deleted_at is null),
      r.last_activity_at
    ) desc
    nulls last;
$$;

grant execute on function public.get_my_rooms_with_preview() to authenticated;
