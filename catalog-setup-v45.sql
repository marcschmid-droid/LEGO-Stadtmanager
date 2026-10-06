-- Brick City Manager v45: fast online set catalog

create table if not exists public.catalog_sets (
  set_number text primary key,
  name text,
  image_url text,
  theme text,
  subtheme text,
  year integer,
  pieces integer,
  minifigs integer,
  ean text,
  upc text,
  rrp_eur numeric,
  market_new_eur numeric,
  market_used_eur numeric,
  market_used_low_eur numeric,
  market_used_high_eur numeric,
  growth_12m_pct numeric,
  width numeric,
  depth numeric,
  height numeric,
  retired boolean,
  source_updated_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists catalog_sets_ean_idx on public.catalog_sets(ean);
create index if not exists catalog_sets_upc_idx on public.catalog_sets(upc);
create index if not exists catalog_sets_name_idx on public.catalog_sets using gin (to_tsvector('simple', coalesce(name,'')));

alter table public.catalog_sets enable row level security;

drop policy if exists "Catalog readable by everyone" on public.catalog_sets;
create policy "Catalog readable by everyone"
on public.catalog_sets
for select
to anon, authenticated
using (true);

grant select on public.catalog_sets to anon, authenticated;

create or replace function public.admin_upsert_catalog_batch(p_rows jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  r jsonb;
  n integer := 0;
begin
  if lower(coalesce(auth.jwt() ->> 'email','')) <> 'marcschmid@t-online.de' then
    raise exception 'not authorized';
  end if;

  for r in select * from jsonb_array_elements(coalesce(p_rows,'[]'::jsonb))
  loop
    insert into public.catalog_sets(
      set_number,name,image_url,theme,subtheme,year,pieces,minifigs,ean,upc,
      rrp_eur,market_new_eur,market_used_eur,market_used_low_eur,market_used_high_eur,
      growth_12m_pct,width,depth,height,retired,source_updated_at,updated_at
    ) values (
      r->>'set_number',
      nullif(r->>'name',''),
      nullif(r->>'image_url',''),
      nullif(r->>'theme',''),
      nullif(r->>'subtheme',''),
      nullif(r->>'year','')::integer,
      nullif(r->>'pieces','')::integer,
      nullif(r->>'minifigs','')::integer,
      nullif(r->>'ean',''),
      nullif(r->>'upc',''),
      nullif(r->>'rrp_eur','')::numeric,
      nullif(r->>'market_new_eur','')::numeric,
      nullif(r->>'market_used_eur','')::numeric,
      nullif(r->>'market_used_low_eur','')::numeric,
      nullif(r->>'market_used_high_eur','')::numeric,
      nullif(r->>'growth_12m_pct','')::numeric,
      nullif(r->>'width','')::numeric,
      nullif(r->>'depth','')::numeric,
      nullif(r->>'height','')::numeric,
      case when r ? 'retired' then (r->>'retired')::boolean else null end,
      coalesce(nullif(r->>'source_updated_at','')::timestamptz,now()),
      now()
    )
    on conflict (set_number) do update set
      name=coalesce(excluded.name,catalog_sets.name),
      image_url=coalesce(excluded.image_url,catalog_sets.image_url),
      theme=coalesce(excluded.theme,catalog_sets.theme),
      subtheme=coalesce(excluded.subtheme,catalog_sets.subtheme),
      year=coalesce(excluded.year,catalog_sets.year),
      pieces=coalesce(excluded.pieces,catalog_sets.pieces),
      minifigs=coalesce(excluded.minifigs,catalog_sets.minifigs),
      ean=coalesce(excluded.ean,catalog_sets.ean),
      upc=coalesce(excluded.upc,catalog_sets.upc),
      rrp_eur=coalesce(excluded.rrp_eur,catalog_sets.rrp_eur),
      market_new_eur=coalesce(excluded.market_new_eur,catalog_sets.market_new_eur),
      market_used_eur=coalesce(excluded.market_used_eur,catalog_sets.market_used_eur),
      market_used_low_eur=coalesce(excluded.market_used_low_eur,catalog_sets.market_used_low_eur),
      market_used_high_eur=coalesce(excluded.market_used_high_eur,catalog_sets.market_used_high_eur),
      growth_12m_pct=coalesce(excluded.growth_12m_pct,catalog_sets.growth_12m_pct),
      width=coalesce(excluded.width,catalog_sets.width),
      depth=coalesce(excluded.depth,catalog_sets.depth),
      height=coalesce(excluded.height,catalog_sets.height),
      retired=coalesce(excluded.retired,catalog_sets.retired),
      source_updated_at=greatest(catalog_sets.source_updated_at,excluded.source_updated_at),
      updated_at=now();

    n := n + 1;
  end loop;

  return n;
end;
$$;

revoke all on function public.admin_upsert_catalog_batch(jsonb) from public;
grant execute on function public.admin_upsert_catalog_batch(jsonb) to authenticated;
