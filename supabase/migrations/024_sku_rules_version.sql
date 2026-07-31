-- Variant rows cache what the naming rules generate: code, name and both
-- descriptions. A change to the rules leaves every cached copy behind, and the
-- only way to refresh one was to open the variant and press Save — so the list
-- and the Product tab could disagree for weeks without anybody noticing.
--
-- This stamp records which build of the rules wrote the row. The admin compares
-- it against SKU_RULES_VERSION and rewrites whatever is behind, so a rule change
-- reaches the catalog on its own.
alter table public.product_variants
  add column if not exists sku_rules_version smallint not null default 0;

comment on column public.product_variants.sku_rules_version is
  'Build of lib/sku/skuRules that generated code / name / descriptions. Lower than SKU_RULES_VERSION means the row is stale and gets rebuilt automatically.';
