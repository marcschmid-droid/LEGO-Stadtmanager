-- Run once in Supabase SQL Editor
create table if not exists public.user_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.user_state enable row level security;
drop policy if exists "Users read own state" on public.user_state;
drop policy if exists "Users insert own state" on public.user_state;
drop policy if exists "Users update own state" on public.user_state;
create policy "Users read own state" on public.user_state for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users insert own state" on public.user_state for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users update own state" on public.user_state for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);


-- v24: allow a signed-in user to permanently delete their own account.
create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_own_account() from public;
grant execute on function public.delete_own_account() to authenticated;


-- v36: operator-only aggregate admin metrics. No access to users' collection contents.
create or replace function public.admin_metrics()
returns table(user_count bigint, last_state_update timestamptz)
language plpgsql
security definer
set search_path = public
as $$
begin
  if lower(coalesce(auth.jwt() ->> 'email','')) <> 'marcschmid@t-online.de' then
    raise exception 'not authorized';
  end if;

  return query
  select
    (select count(*) from auth.users),
    (select max(updated_at) from public.user_state);
end;
$$;

revoke all on function public.admin_metrics() from public;
grant execute on function public.admin_metrics() to authenticated;


-- v48: shared, non-personal queue of set numbers that need server-side catalog enrichment.
-- The client only stores the set number and refresh timestamp. No user collection data is exposed.
create table if not exists public.catalog_requests (
  set_number text primary key,
  requested_at timestamptz not null default now()
);

alter table public.catalog_requests enable row level security;

drop policy if exists "Users insert own catalog requests" on public.catalog_requests;
drop policy if exists "Users read own catalog requests" on public.catalog_requests;
drop policy if exists "Authenticated users request catalog sets" on public.catalog_requests;
drop policy if exists "Catalog requests readable for enrichment" on public.catalog_requests;
drop policy if exists "Authenticated users refresh catalog requests" on public.catalog_requests;

create policy "Authenticated users request catalog sets"
on public.catalog_requests
for insert to authenticated
with check (set_number ~ '^[0-9]{4,7}(-[0-9]+)?$');

create policy "Catalog requests readable for enrichment"
on public.catalog_requests
for select to anon, authenticated
using (true);

create policy "Authenticated users refresh catalog requests"
on public.catalog_requests
for update to authenticated
using (set_number ~ '^[0-9]{4,7}(-[0-9]+)?$')
with check (set_number ~ '^[0-9]{4,7}(-[0-9]+)?$');

grant select on public.catalog_requests to anon, authenticated;
grant insert, update on public.catalog_requests to authenticated;


-- v38: lightweight sync telemetry for aggregate admin metrics.
create table if not exists public.sync_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null default 'sync',
  created_at timestamptz not null default now()
);
alter table public.sync_events enable row level security;
drop policy if exists "Users insert own sync events" on public.sync_events;
drop policy if exists "Users read own sync events" on public.sync_events;
create policy "Users insert own sync events"
on public.sync_events for insert to authenticated
with check ((select auth.uid()) = user_id);
create policy "Users read own sync events"
on public.sync_events for select to authenticated
using ((select auth.uid()) = user_id);

-- v38: server-generated price alerts visible only to the owning user.
create table if not exists public.price_alert_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  set_number text not null,
  set_name text,
  market_price numeric,
  limit_price numeric,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index if not exists price_alert_events_user_created_idx
on public.price_alert_events(user_id, created_at desc);
alter table public.price_alert_events enable row level security;
drop policy if exists "Users read own price alerts" on public.price_alert_events;
drop policy if exists "Users update own price alerts" on public.price_alert_events;
create policy "Users read own price alerts"
on public.price_alert_events for select to authenticated
using ((select auth.uid()) = user_id);
create policy "Users update own price alerts"
on public.price_alert_events for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

-- v38: richer aggregate-only operator metrics. No collection contents are exposed.
create or replace function public.admin_metrics_v38()
returns table(
  active_7d bigint,
  active_30d bigint,
  syncs_24h bigint,
  db_bytes bigint,
  pending_catalog_requests bigint
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if lower(coalesce(auth.jwt() ->> 'email','')) <> 'marcschmid@t-online.de' then
    raise exception 'not authorized';
  end if;

  return query
  select
    (select count(*) from public.user_state where updated_at >= now() - interval '7 days'),
    (select count(*) from public.user_state where updated_at >= now() - interval '30 days'),
    (select count(*) from public.sync_events where created_at >= now() - interval '24 hours'),
    (
      pg_total_relation_size('public.user_state'::regclass) +
      pg_total_relation_size('public.catalog_requests'::regclass) +
      pg_total_relation_size('public.sync_events'::regclass) +
      pg_total_relation_size('public.price_alert_events'::regclass)
    )::bigint,
    (select count(*) from public.catalog_requests);
end;
$$;

revoke all on function public.admin_metrics_v38() from public;
grant execute on function public.admin_metrics_v38() to authenticated;



