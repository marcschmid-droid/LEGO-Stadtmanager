-- Webhook signing secret lives in Supabase Vault, never in the repository.
create or replace function public.billing_webhook_secret_v548() returns text language sql security definer set search_path=public,vault as $$
 select decrypted_secret from vault.decrypted_secrets where name='brick_city_webhook_v548' limit 1;
$$;
revoke all on function public.billing_webhook_secret_v548() from public,anon,authenticated;
grant execute on function public.billing_webhook_secret_v548() to service_role;
