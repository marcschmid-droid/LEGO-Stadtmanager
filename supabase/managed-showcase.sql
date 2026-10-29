-- Public capability read is deliberately separate from owner-only table access.
create schema if not exists brick_showcase_private;
revoke all on schema brick_showcase_private from public;
grant usage on schema brick_showcase_private to anon, authenticated;
create function brick_showcase_private.valid_items(items jsonb) returns boolean
language plpgsql immutable set search_path = '' as $$
declare item jsonb;
begin
 if jsonb_typeof(items) <> 'array' or jsonb_array_length(items) not between 1 and 12 then return false; end if;
 for item in select value from jsonb_array_elements(items) loop
  if jsonb_typeof(item) <> 'object' then return false; end if;
  if (select count(*) from jsonb_object_keys(item)) <> 3 or not (item ?& array['setNumber','name','imageUrl']) then return false; end if;
  if jsonb_typeof(item->'setNumber') <> 'string' or (item->>'setNumber') !~ '^\d{4,7}(-\d)?$' then return false; end if;
  if jsonb_typeof(item->'name') <> 'string' or length(item->>'name') > 120 then return false; end if;
  if jsonb_typeof(item->'imageUrl') <> 'string' or length(item->>'imageUrl') > 1024 then return false; end if;
  if item->>'imageUrl' <> '' and (item->>'imageUrl') !~ '^https://(images\.brickset\.com|img\.bricklink\.com|images\.bricklink\.com|cdn\.rebrickable\.com|www\.lego\.com|images\.lego\.com)/[^?#[:space:]]*$' then return false; end if;
 end loop;
 return true;
end $$;
revoke all on function brick_showcase_private.valid_items(jsonb) from public;
grant execute on function brick_showcase_private.valid_items(jsonb) to authenticated;
create table public.showcase_links (
 owner_id uuid primary key references auth.users(id) on delete cascade,
 token uuid not null unique default gen_random_uuid(),
 items jsonb not null check (brick_showcase_private.valid_items(items)),
 active boolean not null default true,
 updated_at timestamptz not null default now()
);
alter table public.showcase_links enable row level security;
revoke all on public.showcase_links from public, anon, authenticated;
grant select on public.showcase_links to authenticated;
grant insert(owner_id,items) on public.showcase_links to authenticated;
grant update(items,active,updated_at) on public.showcase_links to authenticated;
create policy showcase_owner_read on public.showcase_links for select to authenticated using ((select auth.uid())=owner_id and not coalesce((select auth.jwt())->>'is_anonymous','false')::boolean);
create policy showcase_owner_insert on public.showcase_links for insert to authenticated with check ((select auth.uid())=owner_id and not coalesce((select auth.jwt())->>'is_anonymous','false')::boolean);
create policy showcase_owner_update on public.showcase_links for update to authenticated using ((select auth.uid())=owner_id and not coalesce((select auth.jwt())->>'is_anonymous','false')::boolean) with check ((select auth.uid())=owner_id and not coalesce((select auth.jwt())->>'is_anonymous','false')::boolean);
-- This function intentionally permits anonymous viewers holding an unguessable UUID.
-- It exposes only the validated public payload, never owner IDs or a list of links.
create function brick_showcase_private.read_showcase(link_token uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
 select jsonb_build_object('sets',s.items,'updated_at',s.updated_at)
 from public.showcase_links s join auth.users u on u.id=s.owner_id
 where s.token=link_token and s.active and u.deleted_at is null and not coalesce(u.is_anonymous,false)
$$;
revoke all on function brick_showcase_private.read_showcase(uuid) from public;
grant execute on function brick_showcase_private.read_showcase(uuid) to anon, authenticated;
create function public.read_showcase(link_token uuid) returns jsonb
language sql stable security invoker set search_path = '' as $$
 select brick_showcase_private.read_showcase(link_token)
$$;
revoke all on function public.read_showcase(uuid) from public;
grant execute on function public.read_showcase(uuid) to anon, authenticated;
