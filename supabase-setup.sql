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


-- v37: queue unknown set numbers for server-side catalog enrichment.
create table if not exists public.catalog_requests (
  id bigint generated always as identity primary key,
  set_number text not null,
  requested_by uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

create unique index if not exists catalog_requests_pending_unique
on public.catalog_requests (set_number, requested_by)
where status = 'pending';

alter table public.catalog_requests enable row level security;

drop policy if exists "Users insert own catalog requests" on public.catalog_requests;
drop policy if exists "Users read own catalog requests" on public.catalog_requests;

create policy "Users insert own catalog requests"
on public.catalog_requests for insert to authenticated
with check ((select auth.uid()) = requested_by);

create policy "Users read own catalog requests"
on public.catalog_requests for select to authenticated
using ((select auth.uid()) = requested_by);
