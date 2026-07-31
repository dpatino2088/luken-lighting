-- The size frame for label templates.
--
-- Every bound here was measured against the layout engine, not chosen by eye:
-- inside this frame a label always carries all of its content (barcode, QR, logo,
-- family, name, Long SKU, electrical line), and outside it something silently
-- drops off at download time. Enforcing it in the database as well as in the form
-- means a template can never reach a supplier in a size that cannot hold the
-- information.
--
-- All four bounds describe the ARTWORK. A vertical label is the same frame turned,
-- so the die of a 130 × 50 design is 50 × 130 and the CASE below swaps them.
--
--   long side   60 – 130 mm   below 60 the QR no longer fits beside the type
--   short side  40 –  50 mm   a turned UPC-A needs 40 with its quiet zones
--   fold        from 30 mm    narrower forces the bars to be shortened
--   main panel  50 mm min     what has to remain past the fold
--   steps       10 mm         so a range of cartons shares a few label sizes

-- Existing rows are brought inside the frame first, since the constraints below
-- are validated against them.

-- A die taller than it is wide was already a vertical label, whatever the
-- orientation column said — it was created before that column existed. Reading it
-- as portrait keeps the size the user entered and only names the layout properly.
UPDATE public.label_templates
SET orientation = 'portrait'
WHERE orientation = 'landscape'
  AND height_mm > width_mm;

-- What is left outside the frame cannot be fixed by relabelling: those sizes are
-- the ones that were dropping the QR, the logo and half the text. Each is raised
-- to the nearest size that holds everything, keeping its number of sections.
UPDATE public.label_templates
SET width_mm = GREATEST(width_mm, 80),
    height_mm = GREATEST(height_mm, 40),
    fold_mm = 30
WHERE orientation = 'landscape'
  AND sections = 2
  AND (width_mm < 80 OR height_mm < 40 OR fold_mm < 30 OR width_mm - fold_mm < 50);

UPDATE public.label_templates
SET height_mm = GREATEST(height_mm, 80),
    width_mm = GREATEST(width_mm, 40),
    fold_mm = 30
WHERE orientation = 'portrait'
  AND sections = 2
  AND (height_mm < 80 OR width_mm < 40 OR fold_mm < 30 OR height_mm - fold_mm < 50);

UPDATE public.label_templates
SET width_mm = GREATEST(width_mm, 60),
    height_mm = GREATEST(height_mm, 40)
WHERE orientation = 'landscape'
  AND sections = 1
  AND (width_mm < 60 OR height_mm < 40);

UPDATE public.label_templates
SET height_mm = GREATEST(height_mm, 60),
    width_mm = GREATEST(width_mm, 40)
WHERE orientation = 'portrait'
  AND sections = 1
  AND (height_mm < 60 OR width_mm < 40);

ALTER TABLE public.label_templates
  DROP CONSTRAINT IF EXISTS label_templates_size_frame;
ALTER TABLE public.label_templates
  ADD CONSTRAINT label_templates_size_frame CHECK (
    -- Long side of the artwork.
    (CASE WHEN orientation = 'portrait' THEN height_mm ELSE width_mm END) BETWEEN 60 AND 130
    -- Short side of the artwork.
    AND (CASE WHEN orientation = 'portrait' THEN width_mm ELSE height_mm END) BETWEEN 40 AND 50
    -- Centimetre steps.
    AND (width_mm * 10)::int % 100 = 0
    AND (height_mm * 10)::int % 100 = 0
  );

ALTER TABLE public.label_templates
  DROP CONSTRAINT IF EXISTS label_templates_fold_requires_two_sections;
ALTER TABLE public.label_templates
  ADD CONSTRAINT label_templates_fold_requires_two_sections CHECK (
    (sections = 2
      AND fold_mm IS NOT NULL
      AND fold_mm >= 30
      AND (fold_mm * 10)::int % 100 = 0
      -- The main panel keeps at least 50mm.
      AND (CASE WHEN orientation = 'portrait' THEN height_mm ELSE width_mm END) - fold_mm >= 50)
    OR (sections = 1 AND fold_mm IS NULL)
  );

COMMENT ON CONSTRAINT label_templates_size_frame ON public.label_templates IS
  'Artwork long side 60-130mm, short side 40-50mm, in 10mm steps. Measured range in which a label still carries all of its content.';
