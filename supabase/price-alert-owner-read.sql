-- Applied 2026-10-29 as price_alert_owner_read_access.
-- Clients may read only their own price alerts. No client write permission.
grant select on table public.price_alert_events to authenticated;
create policy price_alert_owner_read on public.price_alert_events
for select to authenticated using ((select auth.uid()) = user_id);
