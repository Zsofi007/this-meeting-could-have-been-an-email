-- Anonymous identity support: user_profiles + link codes

create extension if not exists pgcrypto;

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

-- Cross-device link codes
create table if not exists public.identity_link_codes (
  code text primary key,
  from_user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz,
  used_by uuid references auth.users (id)
);

create index if not exists identity_link_codes_from_idx on public.identity_link_codes (from_user_id, created_at desc);

alter table public.identity_link_codes enable row level security;

-- No direct access; only RPCs.
revoke all on table public.identity_link_codes from authenticated;

create or replace function public.create_identity_link_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  c text;
  has_active boolean;
begin
  select exists (
    select 1
    from public.identity_link_codes lc
    where lc.from_user_id = (select auth.uid())
      and lc.used_at is null
      and lc.expires_at > now()
  ) into has_active;

  if coalesce(has_active, false) then
    raise exception 'link code already active';
  end if;

  -- No extensions required: use md5(random + time) and take 10 chars.
  -- Not cryptographically strong, but fine for short-lived linking codes.
  c := substring(md5(random()::text || clock_timestamp()::text || (select auth.uid())::text) from 1 for 10);

  insert into public.identity_link_codes (code, from_user_id, expires_at)
  values (c, (select auth.uid()), now() + interval '10 minutes');

  return c;
end;
$$;

grant execute on function public.create_identity_link_code() to authenticated;

create or replace function public.consume_identity_link_code(p_code text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  from_id uuid;
  desired_username text;
  final_username text;
begin
  select lc.from_user_id
  into from_id
  from public.identity_link_codes lc
  where lc.code = trim(p_code)
    and lc.used_at is null
    and lc.expires_at > now();

  if from_id is null then
    raise exception 'invalid or expired code';
  end if;

  update public.identity_link_codes
    set used_at = now(),
        used_by = (select auth.uid())
  where code = trim(p_code);

  -- Copy username
  select up.username into desired_username
  from public.user_profiles up
  where up.user_id = from_id;

  final_username := desired_username;
  if final_username is not null then
    begin
      insert into public.user_profiles (user_id, username, updated_at)
      values ((select auth.uid()), final_username, now())
      on conflict (user_id) do update
        set username = excluded.username,
            updated_at = excluded.updated_at;
    exception
      when unique_violation then
        -- Auto-resolve collisions during linking.
        final_username := substring(final_username from 1 for 24) || '-' || substring(md5((select auth.uid())::text) from 1 for 4);
        insert into public.user_profiles (user_id, username, updated_at)
        values ((select auth.uid()), final_username, now())
        on conflict (user_id) do update
          set username = excluded.username,
              updated_at = excluded.updated_at;
    end;
  end if;

  -- Copy room memberships (downgrade owner->member to avoid multiple owners)
  insert into public.room_members (room_id, user_id, role)
  select rm.room_id, (select auth.uid()),
         case when rm.role = 'owner' then 'member' else rm.role end
  from public.room_members rm
  where rm.user_id = from_id
  on conflict (room_id, user_id) do nothing;
end;
$$;

grant execute on function public.consume_identity_link_code(text) to authenticated;

