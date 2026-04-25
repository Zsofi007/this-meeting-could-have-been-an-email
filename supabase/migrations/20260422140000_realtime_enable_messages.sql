-- postgres_changes on `public.messages` only works if the table is in the
-- `supabase_realtime` publication (see Database → Replication, or run this in SQL).
-- Without this, INSERT/UPDATE are not broadcast and other clients need a refresh to see new messages.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;
