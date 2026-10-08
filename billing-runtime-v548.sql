-- Apply after billing-setup-v540.sql. Server-only Stripe customer ownership mapping.
create table if not exists public.billing_customers_v548(user_id uuid primary key references auth.users(id) on delete cascade,stripe_customer_id text not null unique);
create table if not exists public.billing_events_v548(event_id text primary key,event_created bigint not null,user_id uuid references auth.users(id) on delete cascade,processed_at timestamptz not null default now());
alter table public.billing_customers_v548 enable row level security;
alter table public.billing_events_v548 enable row level security;
revoke all on public.billing_customers_v548,public.billing_events_v548 from anon,authenticated;
grant all on public.billing_customers_v548,public.billing_events_v548 to service_role;
alter table public.subscriptions add column if not exists last_event_created bigint not null default 0;
create or replace function public.register_billing_customer_v548(p_user_id uuid,p_customer text) returns void language plpgsql security definer set search_path=public as $$
begin
 insert into public.billing_customers_v548(user_id,stripe_customer_id) values(p_user_id,p_customer) on conflict(user_id) do nothing;
 if not exists(select 1 from public.billing_customers_v548 where user_id=p_user_id and stripe_customer_id=p_customer) then raise exception 'mapping mismatch';end if;
end; $$;
create or replace function public.apply_billing_event_v548(p_event_id text,p_event_created bigint,p_user_id uuid,p_subscription jsonb) returns void language plpgsql security definer set search_path=public as $$
begin
 if not exists(select 1 from public.billing_customers_v548 where user_id=p_user_id and stripe_customer_id=p_subscription->>'stripe_customer_id') then raise exception 'mapping mismatch';end if;
 insert into public.billing_events_v548(event_id,event_created,user_id) values(p_event_id,p_event_created,p_user_id) on conflict(event_id) do nothing;
 if not found then return;end if;
 insert into public.subscriptions(user_id,stripe_customer_id,stripe_subscription_id,plan,status,current_period_end,cancel_at_period_end,last_event_created,updated_at)
 values(p_user_id,p_subscription->>'stripe_customer_id',p_subscription->>'stripe_subscription_id',p_subscription->>'plan',p_subscription->>'status',(p_subscription->>'current_period_end')::timestamptz,(p_subscription->>'cancel_at_period_end')::boolean,p_event_created,now())
 on conflict(user_id) do update set stripe_customer_id=excluded.stripe_customer_id,stripe_subscription_id=excluded.stripe_subscription_id,plan=excluded.plan,status=excluded.status,current_period_end=excluded.current_period_end,cancel_at_period_end=excluded.cancel_at_period_end,last_event_created=excluded.last_event_created,updated_at=excluded.updated_at where public.subscriptions.last_event_created<=excluded.last_event_created;
end; $$;
revoke all on function public.register_billing_customer_v548(uuid,text),public.apply_billing_event_v548(text,bigint,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.register_billing_customer_v548(uuid,text),public.apply_billing_event_v548(text,bigint,uuid,jsonb) to service_role;
