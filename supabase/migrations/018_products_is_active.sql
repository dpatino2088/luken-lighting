-- Product families can be switched off without deleting them, the same way
-- variants already can. A family that is off disappears from the public
-- catalog, sitemap and search along with all of its variants, but keeps its
-- data, slug and files so it can be turned back on.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS products_is_active_idx
  ON public.products (is_active);
