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
