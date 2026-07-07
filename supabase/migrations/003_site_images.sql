-- Site Images CMS
-- Allows managing all non-product images from the admin panel

-- NOTE: You must manually create the 'site-images' storage bucket in the Supabase dashboard:
--   Name: site-images
--   Public: Yes
--   Max file size: 10MB
--   Allowed MIME types: image/*

-- Site-wide images table (key-value store for image slots)
CREATE TABLE site_images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT UNIQUE NOT NULL,
  label TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  alt_text TEXT,
  section TEXT NOT NULL DEFAULT 'general',
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add hero_image_url to product_categories (collections and applications already have it)
ALTER TABLE product_categories ADD COLUMN hero_image_url TEXT;

-- Indexes
CREATE INDEX idx_site_images_key ON site_images(key);
CREATE INDEX idx_site_images_section ON site_images(section);

-- updated_at trigger
CREATE TRIGGER update_site_images_updated_at BEFORE UPDATE ON site_images
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE site_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view site images"
  ON site_images FOR SELECT
  USING (true);

CREATE POLICY "Admin/Editor can insert site images"
  ON site_images FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'editor')
    )
  );

CREATE POLICY "Admin/Editor can update site images"
  ON site_images FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'editor')
    )
  );

CREATE POLICY "Admin can delete site images"
  ON site_images FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );

-- Pre-seed image slots
INSERT INTO site_images (key, label, description, section, sort_order) VALUES
  ('homepage_hero', 'Homepage Hero', 'Main hero banner on the homepage (recommended: 1920x1080)', 'homepage', 1),
  ('homepage_about', 'Homepage About Image', 'Image next to the About section on the homepage (recommended: 800x600)', 'homepage', 2),
  ('about_hero', 'About Page Hero', 'Hero banner on the About page (recommended: 1920x800)', 'about', 1),
  ('about_story', 'About - Our Story', 'Image next to the Our Story section (recommended: 800x600)', 'about', 2),
  ('about_value_1', 'About - Value 1 (Design Excellence)', 'Image for the first Our Values card on the About page (recommended: 800x800)', 'about', 3),
  ('about_value_2', 'About - Value 2 (Quality Craftsmanship)', 'Image for the second Our Values card on the About page (recommended: 800x800)', 'about', 4),
  ('about_value_3', 'About - Value 3 (Innovation)', 'Image for the third Our Values card on the About page (recommended: 800x800)', 'about', 5),
  ('site_logo', 'Site Logo', 'Main logo displayed in the header (recommended: SVG or 240x62 PNG)', 'general', 1),
  ('og_default', 'Default Social Share Image', 'Default image for social media previews when no specific image is set (recommended: 1200x630)', 'general', 2),
  ('product_placeholder', 'Product Placeholder', 'Fallback image shown when a product has no images (recommended: 800x800)', 'general', 3);
