/**
 * Column lists for queries that run as the anonymous visitor (public web).
 *
 * `product_variants.cost_usd` and `.distributor_price` are portal-only and are
 * hidden with column-level grants (migrations 016/017). A column-level grant
 * REPLACES the table-level one, so `select('*')` fails for anon with
 * "permission denied for table product_variants" and the whole query returns
 * nothing — the public catalogue silently renders empty. Public queries must
 * therefore list the readable columns explicitly.
 *
 * Written as string literals (not `join()`) because supabase-js parses the
 * select string at the type level; a computed `string` breaks the row types.
 * Keep in sync with the GRANT SELECT list in
 * `supabase/migrations/017_harden_anon_grants_hide_pricing.sql`.
 */
export const PUBLIC_VARIANT_COLUMNS =
  'id, slug, name, code, short_description, long_description, category_id, product_id, mounting_type, ip_rating, light_source, power_w, lumens, efficacy_lm_per_w, cct_min, cct_max, cri, voltage, class, material, finish, dimensions, is_active, is_featured, created_at, updated_at, manufacturer, manufacturer_sku, control_types, environment, power_w_system, lumens_system, beam_angle' as const;

/** Variant + the related rows the public catalogue renders (images, family). */
export const PUBLIC_VARIANT_WITH_RELATIONS =
  'id, slug, name, code, short_description, long_description, category_id, product_id, mounting_type, ip_rating, light_source, power_w, lumens, efficacy_lm_per_w, cct_min, cct_max, cri, voltage, class, material, finish, dimensions, is_active, is_featured, created_at, updated_at, manufacturer, manufacturer_sku, control_types, environment, power_w_system, lumens_system, beam_angle, category:product_categories(*), product:products(*), assets:product_assets(*)' as const;

/**
 * Same as above but with the family as an inner join, so a filter like
 * `.eq('product.is_active', true)` drops the variant instead of just nulling
 * the embedded family.
 */
export const PUBLIC_VARIANT_FEATURED =
  'id, slug, name, code, short_description, long_description, category_id, product_id, mounting_type, ip_rating, light_source, power_w, lumens, efficacy_lm_per_w, cct_min, cct_max, cri, voltage, class, material, finish, dimensions, is_active, is_featured, created_at, updated_at, manufacturer, manufacturer_sku, control_types, environment, power_w_system, lumens_system, beam_angle, category:product_categories(*), product:products!inner(*), assets:product_assets(*)' as const;

/** Variant + relations for the detail page (family is an inner join). */
export const PUBLIC_VARIANT_DETAIL =
  'id, slug, name, code, short_description, long_description, category_id, product_id, mounting_type, ip_rating, light_source, power_w, lumens, efficacy_lm_per_w, cct_min, cct_max, cri, voltage, class, material, finish, dimensions, is_active, is_featured, created_at, updated_at, manufacturer, manufacturer_sku, control_types, environment, power_w_system, lumens_system, beam_angle, category:product_categories(*), product:products!inner(*), skus:product_skus(*), assets:product_assets(*)' as const;

/** Variant + relations for related-variant lookups (family trimmed down). */
export const PUBLIC_VARIANT_RELATED =
  'id, slug, name, code, short_description, long_description, category_id, product_id, mounting_type, ip_rating, light_source, power_w, lumens, efficacy_lm_per_w, cct_min, cct_max, cri, voltage, class, material, finish, dimensions, is_active, is_featured, created_at, updated_at, manufacturer, manufacturer_sku, control_types, environment, power_w_system, lumens_system, beam_angle, category:product_categories(*), product:products(id, name, slug), assets:product_assets(*)' as const;
