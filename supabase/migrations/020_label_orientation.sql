-- Which way the artwork runs on the label.
--
-- Width and height already describe the die, but they do not say how the design
-- is laid out inside it. A tall label applied to the narrow side of a box still
-- carries the same composition — family name, SKU, barcode, QR — only turned 90°,
-- so the type reads bottom-to-top. Without this the layout always assumed a wide
-- panel and a tall die had nowhere to put the barcode.
--
-- 'landscape' keeps the existing behaviour, so every template created before this
-- migration renders exactly as it did.

ALTER TABLE public.label_templates
  ADD COLUMN IF NOT EXISTS orientation text NOT NULL DEFAULT 'landscape';

ALTER TABLE public.label_templates
  DROP CONSTRAINT IF EXISTS label_templates_orientation_check;
ALTER TABLE public.label_templates
  ADD CONSTRAINT label_templates_orientation_check
  CHECK (orientation IN ('landscape', 'portrait'));

-- The fold is measured along the artwork, not along the die: on a portrait label
-- the art is rotated, so the fold runs across the short dimension. The old
-- constraint compared it against width_mm only, which rejected valid portrait
-- folds and accepted impossible ones.
ALTER TABLE public.label_templates
  DROP CONSTRAINT IF EXISTS label_templates_fold_requires_two_sections;
ALTER TABLE public.label_templates
  ADD CONSTRAINT label_templates_fold_requires_two_sections
  CHECK (
    (sections = 2
      AND fold_mm IS NOT NULL
      AND fold_mm > 0
      AND fold_mm < CASE WHEN orientation = 'portrait' THEN height_mm ELSE width_mm END)
    OR (sections = 1 AND fold_mm IS NULL)
  );

COMMENT ON COLUMN public.label_templates.orientation IS
  'landscape = artwork runs along the width; portrait = artwork is rotated 90° so it runs along the height.';
COMMENT ON COLUMN public.label_templates.fold_mm IS
  'Distance to the fold measured from the start of the artwork: the left edge on landscape, the bottom edge on portrait.';
