-- Realtime Supabase Room Chat schema + RLS
-- Apply in Supabase SQL editor (or via migrations tooling later).

create extension if not exists pgcrypto;

-- Rooms
create table if not exists public.rooms (
  id text primary key,
  name text not null,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now(),
  is_archived boolean not null default false
);

create index if not exists rooms_last_activity_at_idx on public.rooms (last_activity_at desc);

-- Messages
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  room_id text not null references public.rooms (id) on delete cascade,
  user_id uuid not null references auth.users (id),
  username text not null,
  text text not null check (char_length(text) between 1 and 4000),
  client_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  deleted_at timestamptz
);

create index if not exists messages_room_created_at_idx on public.messages (room_id, created_at asc);
create index if not exists messages_user_id_idx on public.messages (user_id);
create unique index if not exists messages_room_client_id_uniq
  on public.messages (room_id, client_id)
  where client_id is not null;

-- Reactions
create table if not exists public.message_reactions (
  message_id uuid not null references public.messages (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  primary key (message_id, user_id, emoji)
);

create index if not exists message_reactions_message_id_idx on public.message_reactions (message_id);

-- User hid a room from their dashboard ("Leave room"); posting again clears this (app deletes row on send).
create table if not exists public.user_room_dismissals (
  user_id uuid not null references auth.users (id) on delete cascade,
  room_id text not null references public.rooms (id) on delete cascade,
  dismissed_at timestamptz not null default now(),
  primary key (user_id, room_id)
);

create index if not exists user_room_dismissals_user_idx
  on public.user_room_dismissals (user_id);

-- Activity trigger
create or replace function public.touch_room_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.rooms
    set last_activity_at = now(),
        is_archived = false
  where id = new.room_id;
  return new;
end;
$$;

drop trigger if exists messages_touch_room_activity on public.messages;
create trigger messages_touch_room_activity
after insert on public.messages
for each row execute function public.touch_room_activity();

-- RLS
alter table public.rooms enable row level security;
alter table public.messages enable row level security;
alter table public.message_reactions enable row level security;
alter table public.user_room_dismissals enable row level security;

-- Rooms policies
drop policy if exists "rooms_select_authenticated" on public.rooms;
create policy "rooms_select_authenticated"
on public.rooms for select
to authenticated
using (true);

drop policy if exists "rooms_insert_owner" on public.rooms;
create policy "rooms_insert_owner"
on public.rooms for insert
to authenticated
with check (created_by = auth.uid());

drop policy if exists "rooms_update_owner" on public.rooms;
create policy "rooms_update_owner"
on public.rooms for update
to authenticated
using (created_by = auth.uid())
with check (created_by = auth.uid());

-- Messages policies
drop policy if exists "messages_select_authenticated" on public.messages;
create policy "messages_select_authenticated"
on public.messages for select
to authenticated
using (true);

drop policy if exists "messages_insert_self" on public.messages;
create policy "messages_insert_self"
on public.messages for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "messages_update_owner" on public.messages;
create policy "messages_update_owner"
on public.messages for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- Reactions policies
drop policy if exists "message_reactions_select_authenticated" on public.message_reactions;
create policy "message_reactions_select_authenticated"
on public.message_reactions for select
to authenticated
using (true);

drop policy if exists "message_reactions_insert_self" on public.message_reactions;
create policy "message_reactions_insert_self"
on public.message_reactions for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "message_reactions_delete_self" on public.message_reactions;
create policy "message_reactions_delete_self"
on public.message_reactions for delete
to authenticated
using (user_id = auth.uid());

drop policy if exists "dismissals_select_own" on public.user_room_dismissals;
create policy "dismissals_select_own"
on public.user_room_dismissals for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "dismissals_insert_own" on public.user_room_dismissals;
create policy "dismissals_insert_own"
on public.user_room_dismissals for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "dismissals_delete_own" on public.user_room_dismissals;
create policy "dismissals_delete_own"
on public.user_room_dismissals for delete
to authenticated
using (user_id = auth.uid());

-- Dashboard room list (see migration + grant execute in migration file)
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

create or replace function public.set_room_name(p_room_id text, p_name text)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
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
$fn$;

grant execute on function public.set_room_name(text, text) to authenticated;

-- Realtime: tables must be in `supabase_realtime` for `postgres_changes` (live updates)
do $realtime$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'messages'
  ) then
    execute 'alter publication supabase_realtime add table public.messages';
  end if;
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'message_reactions'
  ) then
    execute 'alter publication supabase_realtime add table public.message_reactions';
  end if;
end
$realtime$;

