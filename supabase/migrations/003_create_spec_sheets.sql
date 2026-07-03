-- Spec Sheets (fichas técnicas) for Luken products.
-- Luken's structured model (products / product_variants / product_skus) remains
-- the source of truth; this table stores the technical sheet JSON + the SKU
-- generator state so a sheet can be re-edited and exported (PDF) later.

create table if not exists public.spec_sheets (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.products(id) on delete cascade,
  variant_id uuid references public.product_variants(id) on delete set null,
  product_name text not null default '',
  code text not null default '',
  data jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists spec_sheets_product_id_idx on public.spec_sheets (product_id);
create index if not exists spec_sheets_variant_id_idx on public.spec_sheets (variant_id);
create index if not exists spec_sheets_deleted_at_idx on public.spec_sheets (deleted_at);
create index if not exists spec_sheets_updated_at_idx on public.spec_sheets (updated_at desc);

create or replace function public.spec_sheets_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_spec_sheets_updated_at on public.spec_sheets;
create trigger trg_spec_sheets_updated_at
  before update on public.spec_sheets
  for each row execute function public.spec_sheets_set_updated_at();

alter table public.spec_sheets enable row level security;

drop policy if exists "spec_sheets_select_authenticated" on public.spec_sheets;
create policy "spec_sheets_select_authenticated" on public.spec_sheets
  for select to authenticated using (true);

drop policy if exists "spec_sheets_insert_authenticated" on public.spec_sheets;
create policy "spec_sheets_insert_authenticated" on public.spec_sheets
  for insert to authenticated with check (true);

drop policy if exists "spec_sheets_update_authenticated" on public.spec_sheets;
create policy "spec_sheets_update_authenticated" on public.spec_sheets
  for update to authenticated using (true) with check (true);

drop policy if exists "spec_sheets_delete_authenticated" on public.spec_sheets;
create policy "spec_sheets_delete_authenticated" on public.spec_sheets
  for delete to authenticated using (true);
