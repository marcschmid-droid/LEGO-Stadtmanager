-- Brick City Manager v43: shared barcode learning

create table if not exists public.barcode_mappings (
  barcode text primary key,
  set_number text not null,
  set_name text,
  image_url text,
  status text not null default 'pending'
    check (status in ('pending','verified','conflict','rejected')),
  report_count integer not null default 1,
  first_seen_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.barcode_mappings enable row level security;

drop policy if exists "Authenticated users read barcode mappings"
on public.barcode_mappings;

create policy "Authenticated users read barcode mappings"
on public.barcode_mappings
for select
to authenticated
using (true);

grant select on public.barcode_mappings to authenticated;

create or replace function public.learn_barcode_mapping(
  p_barcode text,
  p_set_number text,
  p_set_name text default '',
  p_image_url text default ''
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  existing public.barcode_mappings%rowtype;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if p_barcode !~ '^[0-9]{8,14}$' then
    raise exception 'invalid barcode';
  end if;

  if p_set_number !~ '^[0-9]{4,7}$' then
    raise exception 'invalid set number';
  end if;

  select * into existing
  from public.barcode_mappings
  where barcode = p_barcode;

  if not found then
    insert into public.barcode_mappings(
      barcode,set_number,set_name,image_url,status,report_count,first_seen_at,updated_at
    )
    values(
      p_barcode,p_set_number,nullif(p_set_name,''),nullif(p_image_url,''),
      'pending',1,now(),now()
    );
    return true;
  end if;

  if existing.set_number = p_set_number then
    update public.barcode_mappings
    set
      set_name = coalesce(nullif(p_set_name,''),set_name),
      image_url = coalesce(nullif(p_image_url,''),image_url),
      report_count = report_count + 1,
      updated_at = now()
    where barcode = p_barcode;
    return true;
  end if;

  update public.barcode_mappings
  set status='conflict', updated_at=now()
  where barcode=p_barcode;

  return false;
end;
$$;

revoke all on function public.learn_barcode_mapping(text,text,text,text) from public;
grant execute on function public.learn_barcode_mapping(text,text,text,text) to authenticated;

create or replace function public.admin_set_barcode_status(
  p_barcode text,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if lower(coalesce(auth.jwt() ->> 'email','')) <> 'marcschmid@t-online.de' then
    raise exception 'not authorized';
  end if;

  if p_status not in ('pending','verified','conflict','rejected') then
    raise exception 'invalid status';
  end if;

  update public.barcode_mappings
  set status=p_status, updated_at=now()
  where barcode=p_barcode;
end;
$$;

revoke all on function public.admin_set_barcode_status(text,text) from public;
grant execute on function public.admin_set_barcode_status(text,text) to authenticated;

-- Seed the barcode already confirmed in the app.
insert into public.barcode_mappings(
  barcode,set_number,set_name,status,report_count,updated_at
)
values(
  '5702017166421','40529','Children''s Amusement Park','verified',1,now()
)
on conflict (barcode) do update
set
  set_number=excluded.set_number,
  set_name=excluded.set_name,
  status='verified',
  updated_at=now();
