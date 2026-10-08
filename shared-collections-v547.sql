-- Optional migration: authenticated shared collections with viewer/editor rights.
create table if not exists public.shared_collections_v547 (
 id uuid primary key default gen_random_uuid(), title text not null,
 owner_id uuid not null references auth.users(id) on delete cascade,
 state jsonb not null default '{"collection":[]}'::jsonb,
 updated_at timestamptz not null default now()
);
create table if not exists public.shared_collection_members_v547 (
 collection_id uuid references public.shared_collections_v547(id) on delete cascade,
 user_id uuid references auth.users(id) on delete cascade,
 role text not null check(role in ('viewer','editor')),primary key(collection_id,user_id)
);
alter table public.shared_collections_v547 enable row level security;
alter table public.shared_collection_members_v547 enable row level security;
create or replace function public.shared_role_v547(p_id uuid) returns text
language sql stable security definer set search_path=public as $$
 select case when c.owner_id=auth.uid() then 'owner' else (select m.role from public.shared_collection_members_v547 m where m.collection_id=c.id and m.user_id=auth.uid()) end
 from public.shared_collections_v547 c where c.id=p_id;
$$;
revoke all on function public.shared_role_v547(uuid) from public,anon;
grant execute on function public.shared_role_v547(uuid) to authenticated;
drop policy if exists "shared read" on public.shared_collections_v547;
create policy "shared read" on public.shared_collections_v547 for select to authenticated using(public.shared_role_v547(id) is not null);
drop policy if exists "shared create" on public.shared_collections_v547;
create policy "shared create" on public.shared_collections_v547 for insert to authenticated with check(owner_id=auth.uid());
drop policy if exists "shared delete" on public.shared_collections_v547;
create policy "shared delete" on public.shared_collections_v547 for delete to authenticated using(owner_id=auth.uid());
-- No direct client updates: the RPC below checks role, revision and immutable ownership.
revoke update on public.shared_collections_v547 from anon,authenticated;
grant select,insert,delete on public.shared_collections_v547 to authenticated;
revoke all on public.shared_collection_members_v547 from anon,authenticated;
create or replace function public.save_shared_v547(p_id uuid,p_revision timestamptz,p_state jsonb) returns timestamptz
language plpgsql security definer set search_path=public as $$
declare new_revision timestamptz;
begin
 if coalesce(public.shared_role_v547(p_id),'') not in ('owner','editor') then raise exception 'not authorized'; end if;
 if jsonb_typeof(p_state->'collection') is distinct from 'array' then raise exception 'invalid collection'; end if;
 update public.shared_collections_v547 set state=p_state,updated_at=greatest(clock_timestamp(),updated_at+interval '1 microsecond') where id=p_id and updated_at=p_revision returning updated_at into new_revision;
 return new_revision;
end; $$;
create or replace function public.grant_shared_v547(p_id uuid,p_email text,p_role text) returns boolean
language plpgsql security definer set search_path=public as $$
declare target uuid;
begin
 if public.shared_role_v547(p_id) is distinct from 'owner' then raise exception 'not authorized';end if;
 if p_role not in ('viewer','editor','remove') then raise exception 'invalid role';end if;
 select id into target from auth.users where lower(email)=lower(trim(p_email)) and email_confirmed_at is not null limit 1;
 if target is null then return false;end if;
 if exists(select 1 from public.shared_collections_v547 where id=p_id and owner_id=target) then return false;end if;
 if p_role='remove' then delete from public.shared_collection_members_v547 where collection_id=p_id and user_id=target;
 else insert into public.shared_collection_members_v547(collection_id,user_id,role) values(p_id,target,p_role) on conflict(collection_id,user_id) do update set role=excluded.role;end if;
 return true;
end; $$;
revoke all on function public.save_shared_v547(uuid,timestamptz,jsonb),public.grant_shared_v547(uuid,text,text) from public,anon;
grant execute on function public.save_shared_v547(uuid,timestamptz,jsonb),public.grant_shared_v547(uuid,text,text) to authenticated;
