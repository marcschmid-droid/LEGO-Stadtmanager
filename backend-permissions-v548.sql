-- Supabase default privileges can explicitly grant anon EXECUTE on new functions.
revoke all on function public.shared_role_v547(uuid),public.save_shared_v547(uuid,timestamptz,jsonb),public.grant_shared_v547(uuid,text,text),public.my_subscription() from anon;
-- Signed-in execution is intentional; each function checks auth.uid() and ownership.
grant execute on function public.shared_role_v547(uuid),public.save_shared_v547(uuid,timestamptz,jsonb),public.grant_shared_v547(uuid,text,text),public.my_subscription() to authenticated;
alter table public.shared_collections_v547 add constraint shared_collection_array_v548 check(jsonb_typeof(state->'collection')='array');
