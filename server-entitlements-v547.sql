-- Optional migration. Apply billing-setup-v540.sql first.
-- Paid/trial entitlements must be written by a trusted billing webhook.
-- Existing over-limit collections remain editable; only growth is restricted.
create or replace function public.enforce_collection_limit_v547() returns trigger
language plpgsql security definer set search_path=public as $$
declare new_count integer; old_count integer := 0; paid boolean;
begin
 if auth.role() is distinct from 'authenticated' then return new; end if;
 if new.user_id is distinct from auth.uid() then raise exception 'not authorized'; end if;
 if jsonb_typeof(new.state->'collection') is distinct from 'array' then raise exception 'invalid collection'; end if;
 select count(distinct value->>'setNumber') into new_count from jsonb_array_elements(new.state->'collection');
 if tg_op='UPDATE' then
  select count(distinct value->>'setNumber') into old_count from jsonb_array_elements(coalesce(old.state->'collection','[]'::jsonb));
 end if;
 select exists(select 1 from public.subscriptions where user_id=auth.uid() and plan in ('basic','premium') and status in ('active','trialing') and current_period_end > now()) into paid;
 if not paid and new_count > 25 and new_count > old_count then raise exception 'Free collection limit exceeded (25 sets)'; end if;
 return new;
end; $$;
revoke all on function public.enforce_collection_limit_v547() from public;
drop trigger if exists collection_limit_v547 on public.user_state;
create trigger collection_limit_v547 before insert or update of state,user_id on public.user_state for each row execute function public.enforce_collection_limit_v547();
-- Do not activate until checkout, verified webhooks and server-side trials are configured.
