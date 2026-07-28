-- Harden RLS: public web = read + downloads; portal writes = admin/editor only.
-- Viewer = authenticated read-only on portal data.
-- Hide cost_usd / distributor_price from anon (column privileges).

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT role FROM public.user_profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_portal_reader()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (SELECT role FROM public.user_profiles WHERE id = auth.uid())
      IN ('admin', 'editor', 'viewer'),
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.is_portal_writer()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (SELECT role FROM public.user_profiles WHERE id = auth.uid())
      IN ('admin', 'editor'),
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.is_portal_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (SELECT role FROM public.user_profiles WHERE id = auth.uid()) = 'admin',
    false
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_user_role() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_portal_reader() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_portal_writer() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_portal_admin() TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- Drop existing policies on app tables + storage.objects
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE (schemaname = 'public' AND tablename IN (
            'product_categories', 'products', 'product_variants', 'product_skus',
            'product_assets', 'price_lists', 'product_prices',
            'inspiration_projects', 'project_images', 'project_products',
            'manufacturers', 'spec_sheets', 'site_images',
            'app_settings', 'user_profiles'
          ))
       OR (schemaname = 'storage' AND tablename = 'objects')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- Enable RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_skus ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inspiration_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manufacturers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spec_sheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- product_categories — public read; portal write
-- ---------------------------------------------------------------------------
CREATE POLICY product_categories_select_public
  ON public.product_categories FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY product_categories_insert_writer
  ON public.product_categories FOR INSERT
  TO authenticated
  WITH CHECK (public.is_portal_writer());

CREATE POLICY product_categories_update_writer
  ON public.product_categories FOR UPDATE
  TO authenticated
  USING (public.is_portal_writer())
  WITH CHECK (public.is_portal_writer());

CREATE POLICY product_categories_delete_writer
  ON public.product_categories FOR DELETE
  TO authenticated
  USING (public.is_portal_writer());

-- ---------------------------------------------------------------------------
-- products (families) — public read; portal write
-- ---------------------------------------------------------------------------
CREATE POLICY products_select_public
  ON public.products FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY products_insert_writer
  ON public.products FOR INSERT
  TO authenticated
  WITH CHECK (public.is_portal_writer());

CREATE POLICY products_update_writer
  ON public.products FOR UPDATE
  TO authenticated
  USING (public.is_portal_writer())
  WITH CHECK (public.is_portal_writer());

CREATE POLICY products_delete_writer
  ON public.products FOR DELETE
  TO authenticated
  USING (public.is_portal_writer());

-- ---------------------------------------------------------------------------
-- product_variants — public active only; portal all + write
-- ---------------------------------------------------------------------------
CREATE POLICY product_variants_select_public_active
  ON public.product_variants FOR SELECT
  TO anon, authenticated
  USING (is_active = true OR public.is_portal_reader());

CREATE POLICY product_variants_insert_writer
  ON public.product_variants FOR INSERT
  TO authenticated
  WITH CHECK (public.is_portal_writer());

CREATE POLICY product_variants_update_writer
  ON public.product_variants FOR UPDATE
  TO authenticated
  USING (public.is_portal_writer())
  WITH CHECK (public.is_portal_writer());

CREATE POLICY product_variants_delete_writer
  ON public.product_variants FOR DELETE
  TO authenticated
  USING (public.is_portal_writer());

-- Hide commercial pricing from anonymous API consumers (public site uses select *)
REVOKE SELECT (cost_usd, distributor_price) ON public.product_variants FROM anon;
GRANT SELECT (cost_usd, distributor_price) ON public.product_variants TO authenticated;
GRANT SELECT (cost_usd, distributor_price) ON public.product_variants TO service_role;

-- ---------------------------------------------------------------------------
-- product_skus — public active only; portal all + write
-- ---------------------------------------------------------------------------
CREATE POLICY product_skus_select_public_active
  ON public.product_skus FOR SELECT
  TO anon, authenticated
  USING (is_active = true OR public.is_portal_reader());

CREATE POLICY product_skus_insert_writer
  ON public.product_skus FOR INSERT
  TO authenticated
  WITH CHECK (public.is_portal_writer());

CREATE POLICY product_skus_update_writer
  ON public.product_skus FOR UPDATE
  TO authenticated
  USING (public.is_portal_writer())
  WITH CHECK (public.is_portal_writer());

CREATE POLICY product_skus_delete_writer
  ON public.product_skus FOR DELETE
  TO authenticated
  USING (public.is_portal_writer());

-- ---------------------------------------------------------------------------
-- product_assets — public download metadata; portal write
-- ---------------------------------------------------------------------------
CREATE POLICY product_assets_select_public
  ON public.product_assets FOR SELECT
  TO anon, authenticated
  USING (
    public.is_portal_reader()
    OR variant_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.product_variants pv
      WHERE pv.id = product_assets.variant_id
        AND pv.is_active = true
    )
  );

CREATE POLICY product_assets_insert_writer
  ON public.product_assets FOR INSERT
  TO authenticated
  WITH CHECK (public.is_portal_writer());

CREATE POLICY product_assets_update_writer
  ON public.product_assets FOR UPDATE
  TO authenticated
  USING (public.is_portal_writer())
  WITH CHECK (public.is_portal_writer());

CREATE POLICY product_assets_delete_writer
  ON public.product_assets FOR DELETE
  TO authenticated
  USING (public.is_portal_writer());

-- ---------------------------------------------------------------------------
-- price_lists / product_prices — portal only (no public)
-- ---------------------------------------------------------------------------
CREATE POLICY price_lists_select_reader
  ON public.price_lists FOR SELECT
  TO authenticated
  USING (public.is_portal_reader());

CREATE POLICY price_lists_write_writer
  ON public.price_lists FOR ALL
  TO authenticated
  USING (public.is_portal_writer())
  WITH CHECK (public.is_portal_writer());

CREATE POLICY product_prices_select_reader
  ON public.product_prices FOR SELECT
  TO authenticated
  USING (public.is_portal_reader());

CREATE POLICY product_prices_write_writer
  ON public.product_prices FOR ALL
  TO authenticated
  USING (public.is_portal_writer())
  WITH CHECK (public.is_portal_writer());

-- ---------------------------------------------------------------------------
-- inspiration + project media — public read; portal write
-- ---------------------------------------------------------------------------
CREATE POLICY inspiration_projects_select_public
  ON public.inspiration_projects FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY inspiration_projects_insert_writer
  ON public.inspiration_projects FOR INSERT
  TO authenticated
  WITH CHECK (public.is_portal_writer());

CREATE POLICY inspiration_projects_update_writer
  ON public.inspiration_projects FOR UPDATE
  TO authenticated
  USING (public.is_portal_writer())
  WITH CHECK (public.is_portal_writer());

CREATE POLICY inspiration_projects_delete_writer
  ON public.inspiration_projects FOR DELETE
  TO authenticated
  USING (public.is_portal_writer());

CREATE POLICY project_images_select_public
  ON public.project_images FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY project_images_insert_writer
  ON public.project_images FOR INSERT
  TO authenticated
  WITH CHECK (public.is_portal_writer());

CREATE POLICY project_images_update_writer
  ON public.project_images FOR UPDATE
  TO authenticated
  USING (public.is_portal_writer())
  WITH CHECK (public.is_portal_writer());

CREATE POLICY project_images_delete_writer
  ON public.project_images FOR DELETE
  TO authenticated
  USING (public.is_portal_writer());

CREATE POLICY project_products_select_public
  ON public.project_products FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY project_products_insert_writer
  ON public.project_products FOR INSERT
  TO authenticated
  WITH CHECK (public.is_portal_writer());

CREATE POLICY project_products_update_writer
  ON public.project_products FOR UPDATE
  TO authenticated
  USING (public.is_portal_writer())
  WITH CHECK (public.is_portal_writer());

CREATE POLICY project_products_delete_writer
  ON public.project_products FOR DELETE
  TO authenticated
  USING (public.is_portal_writer());

-- ---------------------------------------------------------------------------
-- manufacturers — portal only
-- ---------------------------------------------------------------------------
CREATE POLICY manufacturers_select_reader
  ON public.manufacturers FOR SELECT
  TO authenticated
  USING (public.is_portal_reader());

CREATE POLICY manufacturers_insert_writer
  ON public.manufacturers FOR INSERT
  TO authenticated
  WITH CHECK (public.is_portal_writer());

CREATE POLICY manufacturers_update_writer
  ON public.manufacturers FOR UPDATE
  TO authenticated
  USING (public.is_portal_writer())
  WITH CHECK (public.is_portal_writer());

CREATE POLICY manufacturers_delete_writer
  ON public.manufacturers FOR DELETE
  TO authenticated
  USING (public.is_portal_writer());

-- ---------------------------------------------------------------------------
-- spec_sheets — public for active variants; portal all + write
-- ---------------------------------------------------------------------------
CREATE POLICY spec_sheets_select_public_active
  ON public.spec_sheets FOR SELECT
  TO anon, authenticated
  USING (
    public.is_portal_reader()
    OR (
      deleted_at IS NULL
      AND EXISTS (
        SELECT 1
        FROM public.product_variants pv
        WHERE pv.id = spec_sheets.variant_id
          AND pv.is_active = true
      )
    )
  );

CREATE POLICY spec_sheets_insert_writer
  ON public.spec_sheets FOR INSERT
  TO authenticated
  WITH CHECK (public.is_portal_writer());

CREATE POLICY spec_sheets_update_writer
  ON public.spec_sheets FOR UPDATE
  TO authenticated
  USING (public.is_portal_writer())
  WITH CHECK (public.is_portal_writer());

CREATE POLICY spec_sheets_delete_writer
  ON public.spec_sheets FOR DELETE
  TO authenticated
  USING (public.is_portal_writer());

-- ---------------------------------------------------------------------------
-- site_images — public read; portal write
-- ---------------------------------------------------------------------------
CREATE POLICY site_images_select_public
  ON public.site_images FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY site_images_insert_writer
  ON public.site_images FOR INSERT
  TO authenticated
  WITH CHECK (public.is_portal_writer());

CREATE POLICY site_images_update_writer
  ON public.site_images FOR UPDATE
  TO authenticated
  USING (public.is_portal_writer())
  WITH CHECK (public.is_portal_writer());

CREATE POLICY site_images_delete_writer
  ON public.site_images FOR DELETE
  TO authenticated
  USING (public.is_portal_writer());

-- ---------------------------------------------------------------------------
-- app_settings — portal writers only (FX rate, brand, etc.)
-- ---------------------------------------------------------------------------
CREATE POLICY app_settings_select_writer
  ON public.app_settings FOR SELECT
  TO authenticated
  USING (public.is_portal_writer());

CREATE POLICY app_settings_insert_writer
  ON public.app_settings FOR INSERT
  TO authenticated
  WITH CHECK (public.is_portal_writer());

CREATE POLICY app_settings_update_writer
  ON public.app_settings FOR UPDATE
  TO authenticated
  USING (public.is_portal_writer())
  WITH CHECK (public.is_portal_writer());

CREATE POLICY app_settings_delete_admin
  ON public.app_settings FOR DELETE
  TO authenticated
  USING (public.is_portal_admin());

-- ---------------------------------------------------------------------------
-- user_profiles — own + admin; no public
-- ---------------------------------------------------------------------------
CREATE POLICY user_profiles_select_own
  ON public.user_profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id OR public.is_portal_admin());

CREATE POLICY user_profiles_update_own
  ON public.user_profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND role = public.get_user_role()
  );

CREATE POLICY user_profiles_update_admin
  ON public.user_profiles FOR UPDATE
  TO authenticated
  USING (public.is_portal_admin())
  WITH CHECK (public.is_portal_admin());

CREATE POLICY user_profiles_insert_admin
  ON public.user_profiles FOR INSERT
  TO authenticated
  WITH CHECK (public.is_portal_admin());

-- ---------------------------------------------------------------------------
-- Storage: public read (downloads); write = portal writers only
-- ---------------------------------------------------------------------------
CREATE POLICY storage_public_read_documents
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'documents');

CREATE POLICY storage_public_read_product_images
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'product-images');

CREATE POLICY storage_public_read_site_images
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'site-images');

CREATE POLICY storage_writer_insert_documents
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'documents' AND public.is_portal_writer());

CREATE POLICY storage_writer_update_documents
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'documents' AND public.is_portal_writer())
  WITH CHECK (bucket_id = 'documents' AND public.is_portal_writer());

CREATE POLICY storage_writer_delete_documents
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'documents' AND public.is_portal_writer());

CREATE POLICY storage_writer_insert_product_images
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'product-images' AND public.is_portal_writer());

CREATE POLICY storage_writer_update_product_images
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'product-images' AND public.is_portal_writer())
  WITH CHECK (bucket_id = 'product-images' AND public.is_portal_writer());

CREATE POLICY storage_writer_delete_product_images
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'product-images' AND public.is_portal_writer());

CREATE POLICY storage_writer_insert_site_images
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'site-images' AND public.is_portal_writer());

CREATE POLICY storage_writer_update_site_images
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'site-images' AND public.is_portal_writer())
  WITH CHECK (bucket_id = 'site-images' AND public.is_portal_writer());

CREATE POLICY storage_writer_delete_site_images
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'site-images' AND public.is_portal_writer());
