-- Brick City Manager v50.40
-- Server-side subscription entitlement foundation for Supabase.
-- Run only after review in the Supabase SQL editor.

create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  plan text not null default 'free' check (plan in ('free','basic','premium')),
  status text not null default 'inactive',
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

drop policy if exists "users can read own subscription" on public.subscriptions;
create policy "users can read own subscription"
on public.subscriptions for select
to authenticated
using (auth.uid() = user_id);

-- Do not allow client-side INSERT/UPDATE/DELETE.
-- Writes should be performed only by a trusted server-side Stripe webhook
-- using the Supabase service-role key.

create or replace function public.my_subscription()
returns table(plan text,status text,current_period_end timestamptz,cancel_at_period_end boolean)
language sql
security definer
set search_path = public
as $$
  select s.plan,s.status,s.current_period_end,s.cancel_at_period_end
  from public.subscriptions s
  where s.user_id = auth.uid()
  limit 1;
$$;

revoke all on function public.my_subscription() from public;
grant execute on function public.my_subscription() to authenticated;
