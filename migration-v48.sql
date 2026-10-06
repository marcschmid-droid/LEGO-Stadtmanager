-- Brick City Manager v48 stability migration
-- Run once in the Supabase SQL Editor before deploying v48.
-- Rebuilds catalog_requests into the single schema used by the current app.

begin;

create table if not exists public.catalog_requests_v48 (
  set_number text primary key,
  requested_at timestamptz not null default now()
);

-- Both historical catalog_requests variants contain set_number.
-- Keep each queued set once; personal request metadata is intentionally not carried over.
insert into public.catalog_requests_v48 (set_number, requested_at)
select distinct set_number, now()
from public.catalog_requests
where set_number ~ '^[0-9]{4,7}(-[0-9]+)?$'
on conflict (set_number) do update
set requested_at = excluded.requested_at;

drop table public.catalog_requests cascade;
alter table public.catalog_requests_v48 rename to catalog_requests;

alter table public.catalog_requests enable row level security;

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

commit;
