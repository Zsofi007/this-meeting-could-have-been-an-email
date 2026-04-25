-- Rooms the user "left" are hidden from the dashboard until they post again.
create table if not exists public.user_room_dismissals (
  user_id uuid not null references auth.users (id) on delete cascade,
  room_id text not null references public.rooms (id) on delete cascade,
  dismissed_at timestamptz not null default now(),
  primary key (user_id, room_id)
);

create index if not exists user_room_dismissals_user_idx
  on public.user_room_dismissals (user_id);

alter table public.user_room_dismissals enable row level security;

drop policy if exists "dismissals_select_own" on public.user_room_dismissals;
create policy "dismissals_select_own"
on public.user_room_dismissals for select
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "dismissals_insert_own" on public.user_room_dismissals;
create policy "dismissals_insert_own"
on public.user_room_dismissals for insert
to authenticated
with check (user_id = (select auth.uid()));

drop policy if exists "dismissals_delete_own" on public.user_room_dismissals;
create policy "dismissals_delete_own"
on public.user_room_dismissals for delete
to authenticated
using (user_id = (select auth.uid()));

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
    not exists (
      select 1
      from public.user_room_dismissals d
      where d.user_id = (select auth.uid())
        and d.room_id = r.id
    )
    and (
      r.created_by = (select auth.uid())
      or exists (
        select 1
        from public.messages m2
        where m2.room_id = r.id
          and m2.user_id = (select auth.uid())
          and m2.deleted_at is null
      )
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
