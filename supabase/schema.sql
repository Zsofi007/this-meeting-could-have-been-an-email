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

-- Prevent updates from changing immutable message identity fields.
-- RLS policies cannot compare OLD vs NEW, so this trigger closes that gap.
create or replace function public.enforce_message_immutable_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.room_id <> old.room_id then
    raise exception 'room_id is immutable' using errcode = '22000';
  end if;
  if new.user_id <> old.user_id then
    raise exception 'user_id is immutable' using errcode = '22000';
  end if;
  if new.created_at <> old.created_at then
    raise exception 'created_at is immutable' using errcode = '22000';
  end if;
  if new.client_id is distinct from old.client_id then
    raise exception 'client_id is immutable' using errcode = '22000';
  end if;
  if new.username <> old.username then
    raise exception 'username is immutable' using errcode = '22000';
  end if;
  return new;
end;
$$;

drop trigger if exists messages_enforce_immutable on public.messages;
create trigger messages_enforce_immutable
before update on public.messages
for each row execute function public.enforce_message_immutable_fields();

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

-- Room membership + join requests
create table if not exists public.room_members (
  room_id text not null references public.rooms (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member' check (role in ('owner','member')),
  created_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

create index if not exists room_members_user_idx on public.room_members (user_id);

create table if not exists public.room_join_requests (
  room_id text not null references public.rooms (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  requested_username text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  requested_at timestamptz not null default now(),
  decided_by uuid references auth.users (id),
  decided_at timestamptz,
  primary key (room_id, user_id)
);

create index if not exists room_join_requests_room_status_idx
  on public.room_join_requests (room_id, status, requested_at desc);

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

-- Helper: membership check
create or replace function public.is_room_member(p_room_id text, p_user_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1
    from public.room_members rm
    where rm.room_id = p_room_id
      and rm.user_id = p_user_id
  );
$$;

-- Auto-add creator as owner member
create or replace function public.add_creator_as_member()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.room_members (room_id, user_id, role)
  values (new.id, new.created_by, 'owner')
  on conflict (room_id, user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists rooms_add_creator_member on public.rooms;
create trigger rooms_add_creator_member
after insert on public.rooms
for each row execute function public.add_creator_as_member();

-- Backfill existing rooms: creator becomes owner member
insert into public.room_members (room_id, user_id, role)
select r.id, r.created_by, 'owner'
from public.rooms r
on conflict (room_id, user_id) do nothing;

-- Request join (current user)
create or replace function public.request_join_room(p_room_id text, p_username text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select public.is_room_member(p_room_id, (select auth.uid()))) then
    return;
  end if;

  insert into public.room_join_requests (room_id, user_id, requested_username, status)
  values (p_room_id, (select auth.uid()), nullif(trim(p_username), ''), 'pending')
  on conflict (room_id, user_id) do update
    set requested_username = excluded.requested_username,
        status = case
          when public.room_join_requests.status = 'rejected' then 'pending'
          else public.room_join_requests.status
        end,
        requested_at = now(),
        decided_by = null,
        decided_at = null;
end;
$$;

grant execute on function public.request_join_room(text, text) to authenticated;

-- Approve/reject (any existing member may decide)
create or replace function public.decide_room_join_request(p_room_id text, p_user_id uuid, p_decision text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_decision not in ('approved','rejected') then
    raise exception 'invalid decision';
  end if;

  if not public.is_room_member(p_room_id, (select auth.uid())) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if p_decision = 'approved' then
    insert into public.room_members (room_id, user_id, role)
    values (p_room_id, p_user_id, 'member')
    on conflict (room_id, user_id) do nothing;
  end if;

  insert into public.room_join_requests (room_id, user_id, status, decided_by, decided_at)
  values (p_room_id, p_user_id, p_decision, (select auth.uid()), now())
  on conflict (room_id, user_id) do update
    set status = excluded.status,
        decided_by = excluded.decided_by,
        decided_at = excluded.decided_at;
end;
$$;

grant execute on function public.decide_room_join_request(text, uuid, text) to authenticated;

-- Leave room (removes membership so re-join requires approval again)
create or replace function public.leave_room(p_room_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  is_owner boolean;
begin
  select exists (
    select 1
    from public.room_members rm
    where rm.room_id = p_room_id
      and rm.user_id = (select auth.uid())
      and rm.role = 'owner'
  ) into is_owner;

  if coalesce(is_owner, false) then
    raise exception 'owner cannot leave room' using errcode = '42501';
  end if;

  delete from public.room_members
  where room_id = p_room_id
    and user_id = (select auth.uid());

  -- Clear any prior decision so re-joining requires a fresh request + approval.
  delete from public.room_join_requests
  where room_id = p_room_id
    and user_id = (select auth.uid());

  -- also hide from dashboard immediately (defensive; membership delete already removes it from list)
  insert into public.user_room_dismissals (user_id, room_id, dismissed_at)
  values ((select auth.uid()), p_room_id, now())
  on conflict (user_id, room_id) do update set dismissed_at = excluded.dismissed_at;
end;
$$;

grant execute on function public.leave_room(text) to authenticated;

-- RLS
alter table public.rooms enable row level security;
alter table public.messages enable row level security;
alter table public.message_reactions enable row level security;
alter table public.user_room_dismissals enable row level security;
alter table public.room_members enable row level security;
alter table public.room_join_requests enable row level security;

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
drop policy if exists "messages_select_members" on public.messages;
create policy "messages_select_members"
on public.messages for select
to authenticated
using (public.is_room_member(room_id, (select auth.uid())));

drop policy if exists "messages_insert_self" on public.messages;
drop policy if exists "messages_insert_self_member" on public.messages;
create policy "messages_insert_self_member"
on public.messages for insert
to authenticated
with check (user_id = (select auth.uid()) and public.is_room_member(room_id, (select auth.uid())));

drop policy if exists "messages_update_owner" on public.messages;
create policy "messages_update_owner"
on public.messages for update
to authenticated
using (user_id = auth.uid() and public.is_room_member(room_id, (select auth.uid())))
with check (user_id = auth.uid() and public.is_room_member(room_id, (select auth.uid())));

-- Reactions policies
drop policy if exists "message_reactions_select_authenticated" on public.message_reactions;
drop policy if exists "message_reactions_select_members" on public.message_reactions;
create policy "message_reactions_select_members"
on public.message_reactions for select
to authenticated
using (
  public.is_room_member(
    (select m.room_id from public.messages m where m.id = message_id),
    (select auth.uid())
  )
);

drop policy if exists "message_reactions_insert_self" on public.message_reactions;
create policy "message_reactions_insert_self"
on public.message_reactions for insert
to authenticated
with check (
  user_id = auth.uid()
  and public.is_room_member(
    (select m.room_id from public.messages m where m.id = message_id),
    auth.uid()
  )
);

drop policy if exists "message_reactions_delete_self" on public.message_reactions;
create policy "message_reactions_delete_self"
on public.message_reactions for delete
to authenticated
using (
  user_id = auth.uid()
  and public.is_room_member(
    (select m.room_id from public.messages m where m.id = message_id),
    auth.uid()
  )
);

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

-- Room members + join requests policies
drop policy if exists "room_members_select_members" on public.room_members;
create policy "room_members_select_members"
on public.room_members for select
to authenticated
using (
  user_id = (select auth.uid())
  or public.is_room_member(room_id, (select auth.uid()))
);

drop policy if exists "room_join_requests_select_requestor_or_members" on public.room_join_requests;
create policy "room_join_requests_select_requestor_or_members"
on public.room_join_requests for select
to authenticated
using (
  user_id = (select auth.uid())
  or public.is_room_member(room_id, (select auth.uid()))
);

-- No direct insert/update/delete from clients; use RPCs.
revoke all on table public.room_members from authenticated;
revoke all on table public.room_join_requests from authenticated;
grant select on table public.room_members to authenticated;
grant select on table public.room_join_requests to authenticated;

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
    exists (
      select 1
      from public.room_members rm
      where rm.room_id = r.id
        and rm.user_id = (select auth.uid())
    )
    and not exists (
      select 1
      from public.user_room_dismissals d
      where d.user_id = (select auth.uid())
        and d.room_id = r.id
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

  select public.is_room_member(r.id, (select auth.uid()))
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

-- User profiles (username)
create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  username text not null check (char_length(username) between 2 and 32),
  updated_at timestamptz not null default now()
);

create unique index if not exists user_profiles_username_uniq on public.user_profiles (lower(username));

alter table public.user_profiles enable row level security;

drop policy if exists "profiles_select_self" on public.user_profiles;
create policy "profiles_select_self"
on public.user_profiles for select
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "profiles_upsert_self" on public.user_profiles;
create policy "profiles_upsert_self"
on public.user_profiles for insert
to authenticated
with check (user_id = (select auth.uid()));

drop policy if exists "profiles_update_self" on public.user_profiles;
create policy "profiles_update_self"
on public.user_profiles for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create or replace function public.set_my_username(p_username text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  u text;
begin
  u := trim(p_username);
  if char_length(u) < 2 or char_length(u) > 32 then
    raise exception 'invalid username length';
  end if;
  if u !~ '^[a-zA-Z0-9._-]+$' then
    raise exception 'invalid username';
  end if;

  begin
    insert into public.user_profiles (user_id, username, updated_at)
    values ((select auth.uid()), u, now())
    on conflict (user_id) do update
      set username = excluded.username,
          updated_at = excluded.updated_at;
  exception
    when unique_violation then
      raise exception 'username taken';
  end;
end;
$$;

grant execute on function public.set_my_username(text) to authenticated;

-- Remove cross-device identity linking (link codes) (kept for compatibility if schema.sql is re-run)
drop function if exists public.consume_identity_link_code(text);
drop function if exists public.create_identity_link_code();
drop table if exists public.identity_link_codes;

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
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'rooms'
  ) then
    execute 'alter publication supabase_realtime add table public.rooms';
  end if;
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'room_join_requests'
  ) then
    execute 'alter publication supabase_realtime add table public.room_join_requests';
  end if;
end
$realtime$;

