-- Manufacturers / vendors catalog so the variant "Manufacturer" field is a
-- reusable dropdown instead of free text. Kept simple: name + country of
-- origin + currency. The variant still stores the manufacturer NAME as text
-- (product_variants.manufacturer) for back-compat with the site & CSV import;
-- this table just powers the dropdown and lets admins add/edit/delete entries.

create table if not exists public.manufacturers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  country text,
  currency text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists manufacturers_name_idx on public.manufacturers (name);

drop trigger if exists trg_manufacturers_updated_at on public.manufacturers;
create trigger trg_manufacturers_updated_at
  before update on public.manufacturers
  for each row execute function public.update_updated_at_column();

-- Seed from distinct manufacturer names already used on variants.
insert into public.manufacturers (name)
select distinct trim(manufacturer)
from public.product_variants
where manufacturer is not null and trim(manufacturer) <> ''
on conflict (name) do nothing;

alter table public.manufacturers enable row level security;

drop policy if exists "manufacturers_select_authenticated" on public.manufacturers;
create policy "manufacturers_select_authenticated" on public.manufacturers
  for select to authenticated using (true);

drop policy if exists "manufacturers_insert_authenticated" on public.manufacturers;
create policy "manufacturers_insert_authenticated" on public.manufacturers
  for insert to authenticated with check (true);

drop policy if exists "manufacturers_update_authenticated" on public.manufacturers;
create policy "manufacturers_update_authenticated" on public.manufacturers
  for update to authenticated using (true) with check (true);

drop policy if exists "manufacturers_delete_authenticated" on public.manufacturers;
create policy "manufacturers_delete_authenticated" on public.manufacturers
  for delete to authenticated using (true);
