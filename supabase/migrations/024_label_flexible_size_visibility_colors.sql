-- Free label size (min 15 mm, 1 mm steps), per-field visibility, and colors.

ALTER TABLE public.label_templates
  DROP CONSTRAINT IF EXISTS label_templates_size_frame;
ALTER TABLE public.label_templates
  DROP CONSTRAINT IF EXISTS label_templates_fold_requires_two_sections;

ALTER TABLE public.label_templates
  ADD COLUMN IF NOT EXISTS background_color text NOT NULL DEFAULT '#231F20',
  ADD COLUMN IF NOT EXISTS ink_color text NOT NULL DEFAULT '#FFFFFF',
  ADD COLUMN IF NOT EXISTS show_barcode boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_qr boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_logo boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_text boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_site boolean NOT NULL DEFAULT true;

ALTER TABLE public.label_templates
  DROP CONSTRAINT IF EXISTS label_templates_colors_hex;
ALTER TABLE public.label_templates
  ADD CONSTRAINT label_templates_colors_hex CHECK (
    background_color ~ '^#[0-9A-Fa-f]{6}$'
    AND ink_color ~ '^#[0-9A-Fa-f]{6}$'
  );

ALTER TABLE public.label_templates
  ADD CONSTRAINT label_templates_size_frame CHECK (
    width_mm BETWEEN 15 AND 200
    AND height_mm BETWEEN 15 AND 100
    AND (width_mm * 10)::int % 10 = 0
    AND (height_mm * 10)::int % 10 = 0
  );

ALTER TABLE public.label_templates
  ADD CONSTRAINT label_templates_fold_requires_two_sections CHECK (
    (sections = 2
      AND fold_mm IS NOT NULL
      AND fold_mm >= 10
      AND (fold_mm * 10)::int % 10 = 0
      AND width_mm - fold_mm >= 15)
    OR (sections = 1 AND fold_mm IS NULL)
  );

COMMENT ON COLUMN public.label_templates.background_color IS 'Label field fill colour (hex).';
COMMENT ON COLUMN public.label_templates.ink_color IS 'Type and logo fill colour (hex).';
COMMENT ON COLUMN public.label_templates.show_barcode IS 'When false, barcode is omitted even if GTIN is set.';
COMMENT ON COLUMN public.label_templates.show_qr IS 'When false, QR is omitted.';
COMMENT ON COLUMN public.label_templates.show_logo IS 'When false, logo is omitted.';
COMMENT ON COLUMN public.label_templates.show_text IS 'When false, family/name/SKU/spec block is omitted.';
COMMENT ON COLUMN public.label_templates.show_site IS 'When false, site/origin line is omitted.';
