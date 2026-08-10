ALTER TABLE public.label_templates
  DROP CONSTRAINT IF EXISTS label_templates_size_frame;

ALTER TABLE public.label_templates
  ADD CONSTRAINT label_templates_size_frame CHECK (
    width_mm BETWEEN 15 AND 500
    AND height_mm BETWEEN 15 AND 500
    AND (width_mm * 10)::int % 10 = 0
    AND (height_mm * 10)::int % 10 = 0
  );
