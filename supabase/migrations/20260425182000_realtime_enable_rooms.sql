-- postgres_changes on `public.rooms` only works if the table is in the
-- `supabase_realtime` publication (Database → Replication, or run this SQL).
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'rooms'
  ) then
    alter publication supabase_realtime add table public.rooms;
  end if;
end $$;

