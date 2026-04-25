-- Remove cross-device identity linking (link codes)

drop function if exists public.consume_identity_link_code(text);
drop function if exists public.create_identity_link_code();
drop table if exists public.identity_link_codes;

