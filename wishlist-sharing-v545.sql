-- Optional server migration for explicit wishlist sharing and anonymous reservations.
create table if not exists public.wishlist_shares (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 title text not null default 'Meine LEGO-Wunschliste',
 items jsonb not null default '[]'::jsonb check (jsonb_typeof(items)='array' and jsonb_array_length(items)<=500)
);
alter table public.wishlist_shares enable row level security;
drop policy if exists "manage own wishlist shares" on public.wishlist_shares;
create policy "manage own wishlist shares" on public.wishlist_shares for all to authenticated
 using(user_id=auth.uid()) with check(user_id=auth.uid());
grant select,insert,update,delete on public.wishlist_shares to authenticated;
create table if not exists public.wishlist_reservations (
 share_id uuid not null references public.wishlist_shares(id) on delete cascade,
 set_number text not null,
 token uuid not null default gen_random_uuid(),
 reserved_at timestamptz not null default now(),
 primary key(share_id,set_number)
);
alter table public.wishlist_reservations enable row level security;
revoke all on public.wishlist_reservations from anon,authenticated;
create or replace function public.get_shared_wishlist(p_share_id uuid)
returns jsonb language sql security definer set search_path=public as $$
 select jsonb_build_object('title',s.title,'items',coalesce((
 select jsonb_agg(jsonb_build_object('setNumber',item->>'setNumber','name',item->>'name','priority',item->>'priority','reserved',exists(select 1 from public.wishlist_reservations r where r.share_id=s.id and r.set_number=item->>'setNumber')))
 from jsonb_array_elements(s.items) item),'[]'::jsonb)) from public.wishlist_shares s where s.id=p_share_id;
$$;
create or replace function public.reserve_wishlist_item(p_share_id uuid,p_set_number text)
returns uuid language plpgsql security definer set search_path=public as $$
declare reservation_token uuid;
begin
 if not exists(select 1 from public.wishlist_shares s, jsonb_array_elements(s.items) item where s.id=p_share_id and item->>'setNumber'=p_set_number) then return null; end if;
 insert into public.wishlist_reservations(share_id,set_number) values(p_share_id,p_set_number)
 on conflict(share_id,set_number) do nothing returning token into reservation_token;
 return reservation_token;
end; $$;
create or replace function public.release_wishlist_item(p_share_id uuid,p_set_number text,p_token uuid)
returns boolean language plpgsql security definer set search_path=public as $$
begin
 delete from public.wishlist_reservations where share_id=p_share_id and set_number=p_set_number and token=p_token;
 return found;
end; $$;
revoke all on function public.get_shared_wishlist(uuid),public.reserve_wishlist_item(uuid,text),public.release_wishlist_item(uuid,text,uuid) from public;
grant execute on function public.get_shared_wishlist(uuid),public.reserve_wishlist_item(uuid,text),public.release_wishlist_item(uuid,text,uuid) to anon,authenticated;
