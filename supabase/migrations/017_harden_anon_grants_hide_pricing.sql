-- Defense-in-depth grants: anon cannot write; cannot read portal-only tables;
-- cannot read commercial price columns on product_variants.

REVOKE ALL ON TABLE public.app_settings FROM anon;
REVOKE ALL ON TABLE public.user_profiles FROM anon;
REVOKE ALL ON TABLE public.manufacturers FROM anon;
REVOKE ALL ON TABLE public.price_lists FROM anon;
REVOKE ALL ON TABLE public.product_prices FROM anon;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.product_categories FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.products FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.product_skus FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.product_assets FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.inspiration_projects FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.project_images FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.project_products FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.site_images FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.spec_sheets FROM anon;

REVOKE ALL ON TABLE public.product_variants FROM anon;
GRANT SELECT (
  id, slug, name, code, short_description, long_description,
  category_id, product_id, mounting_type, ip_rating, light_source,
  power_w, lumens, efficacy_lm_per_w, cct_min, cct_max, cri, voltage,
  class, material, finish, dimensions, is_active, is_featured,
  created_at, updated_at, manufacturer, manufacturer_sku, control_types,
  environment, power_w_system, lumens_system, beam_angle
) ON public.product_variants TO anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.product_variants TO authenticated;
GRANT SELECT (cost_usd, distributor_price) ON public.product_variants TO authenticated;
