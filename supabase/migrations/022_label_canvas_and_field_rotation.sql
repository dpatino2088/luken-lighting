-- The canvas stops turning; the fields turn instead.
--
-- Until now "vertical" rotated the whole artboard, so a vertical template had a
-- tall die and the preview came out tall. That made the label impossible to judge
-- against the horizontal ones, and it forced every element to turn together —
-- there was no way to keep the barcode reading across while the text ran up the
-- label, which is what the cartons actually need.
--
-- So the canvas is now always horizontal: width is the long side, height the short
-- one, which the size frame already guarantees (60-130 × 40-50). Direction becomes
-- a property of each field, with the template-wide setting acting as the default.
--
-- Nothing about the delivered artwork is lost: a piece applied vertically is the
-- same rectangle with its contents turned, and that is exactly what these columns
-- describe.

-- The old frame read the long side through the orientation column, so a swapped row
-- fails it before the new one is in place. Both go first.
ALTER TABLE public.label_templates
  DROP CONSTRAINT IF EXISTS label_templates_size_frame;
ALTER TABLE public.label_templates
  DROP CONSTRAINT IF EXISTS label_templates_fold_requires_two_sections;

-- Templates stored with a tall die were the old rotated-artboard form. Swapping the
-- sides recovers the canvas they were composed in; their fold was already measured
-- along the artwork, so it needs no change.
UPDATE public.label_templates
SET width_mm = height_mm,
    height_mm = width_mm
WHERE height_mm > width_mm;

-- Per-field direction.
--   auto        follow the template's direction, and turn only if it cannot fit
--   horizontal  reads across the label
--   vertical    turned 90°, reads bottom to top
ALTER TABLE public.label_templates
  ADD COLUMN IF NOT EXISTS barcode_rotation text NOT NULL DEFAULT 'auto',
  ADD COLUMN IF NOT EXISTS qr_rotation text NOT NULL DEFAULT 'auto',
  ADD COLUMN IF NOT EXISTS logo_rotation text NOT NULL DEFAULT 'auto',
  ADD COLUMN IF NOT EXISTS text_rotation text NOT NULL DEFAULT 'auto',
  ADD COLUMN IF NOT EXISTS site_rotation text NOT NULL DEFAULT 'auto';

ALTER TABLE public.label_templates
  DROP CONSTRAINT IF EXISTS label_templates_field_rotation_check;
ALTER TABLE public.label_templates
  ADD CONSTRAINT label_templates_field_rotation_check CHECK (
    barcode_rotation IN ('auto', 'horizontal', 'vertical')
    AND qr_rotation IN ('auto', 'horizontal', 'vertical')
    AND logo_rotation IN ('auto', 'horizontal', 'vertical')
    AND text_rotation IN ('auto', 'horizontal', 'vertical')
    AND site_rotation IN ('auto', 'horizontal', 'vertical')
  );

-- The frame no longer needs to ask which way the die is turned: the canvas is
-- always the long side by the short side.
ALTER TABLE public.label_templates
  ADD CONSTRAINT label_templates_size_frame CHECK (
    width_mm BETWEEN 60 AND 130
    AND height_mm BETWEEN 40 AND 50
    AND (width_mm * 10)::int % 100 = 0
    AND (height_mm * 10)::int % 100 = 0
  );

ALTER TABLE public.label_templates
  ADD CONSTRAINT label_templates_fold_requires_two_sections CHECK (
    (sections = 2
      AND fold_mm IS NOT NULL
      AND fold_mm >= 30
      AND (fold_mm * 10)::int % 100 = 0
      AND width_mm - fold_mm >= 50)
    OR (sections = 1 AND fold_mm IS NULL)
  );

COMMENT ON COLUMN public.label_templates.orientation IS
  'Default reading direction of the artwork: landscape = across the label, portrait = turned 90°. The canvas itself is always horizontal; per-field columns override this.';
COMMENT ON COLUMN public.label_templates.width_mm IS
  'Long side of the canvas, always horizontal.';
COMMENT ON COLUMN public.label_templates.height_mm IS
  'Short side of the canvas.';
COMMENT ON COLUMN public.label_templates.fold_mm IS
  'Distance from the left edge of the canvas to the fold.';
