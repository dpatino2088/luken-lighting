-- Product labels: the GTIN printed as a barcode, and the template library that
-- describes the physical label (size in mm, one or two fold sections).
--
-- A GTIN is allocated once and never regenerated: it is printed on packaging,
-- so changing it would orphan stock already in the field. Same reasoning as the
-- frozen variant slug.

ALTER TABLE public.product_variants
  ADD COLUMN IF NOT EXISTS gtin text;

-- 12-digit UPC-A. The check digit is validated in the app before it gets here.
ALTER TABLE public.product_variants
  DROP CONSTRAINT IF EXISTS product_variants_gtin_format;
ALTER TABLE public.product_variants
  ADD CONSTRAINT product_variants_gtin_format
  CHECK (gtin IS NULL OR gtin ~ '^[0-9]{12}$');

CREATE UNIQUE INDEX IF NOT EXISTS product_variants_gtin_key
  ON public.product_variants (gtin)
  WHERE gtin IS NOT NULL;

-- Element sizes (logo, barcode, QR, type) are fixed across every template so
-- the printed pieces stay consistent and stay within GS1 minimums. A template
-- therefore only carries the canvas and where the fold falls.
CREATE TABLE IF NOT EXISTS public.label_templates (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  -- Packaging level this template is meant for: product, product_box,
  -- inner_box, master_box.
  level text NOT NULL DEFAULT 'product_box',
  brand text NOT NULL DEFAULT 'Luken',
  width_mm numeric(6,2) NOT NULL,
  height_mm numeric(6,2) NOT NULL,
  -- 1 = plain label, 2 = two panels separated by a fold line.
  sections smallint NOT NULL DEFAULT 1 CHECK (sections IN (1, 2)),
  -- Distance from the left edge to the fold. NULL when sections = 1.
  fold_mm numeric(6,2),
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT label_templates_fold_requires_two_sections
    CHECK ((sections = 2 AND fold_mm IS NOT NULL AND fold_mm > 0 AND fold_mm < width_mm)
        OR (sections = 1 AND fold_mm IS NULL))
);

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS label_template_id uuid
  REFERENCES public.label_templates (id) ON DELETE SET NULL;

-- The size measured from the existing Illustrator artwork (66 files, all
-- 130x50mm with the fold 30mm from the left edge).
INSERT INTO public.label_templates (name, level, brand, width_mm, height_mm, sections, fold_mm, is_default)
SELECT 'Product Box 130x50 · 2 sections', 'product_box', 'Luken', 130, 50, 2, 30, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.label_templates WHERE level = 'product_box' AND width_mm = 130 AND height_mm = 50
);

ALTER TABLE public.label_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS label_templates_read ON public.label_templates;
CREATE POLICY label_templates_read ON public.label_templates
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS label_templates_write ON public.label_templates;
CREATE POLICY label_templates_write ON public.label_templates
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.label_templates TO authenticated;
REVOKE ALL ON TABLE public.label_templates FROM anon;
