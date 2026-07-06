// Database types matching Supabase schema
// Naming: products = base products, product_variants = configurations, product_skus = permutations

export interface ProductCategory {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  hero_image_url: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface InspirationProject {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  hero_image_url: string | null;
  thumbnail_url: string | null;
  sort_order: number;
  location: string | null;
  year: number | null;
  architect: string | null;
  lighting_designer: string | null;
  client_name: string | null;
  photographer: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectImage {
  id: string;
  project_id: string;
  image_url: string;
  caption: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  description: string;
  environment: ProductEnvironment | null;
  category_id: string | null;
  hero_image_url: string | null;
  thumbnail_url: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export type MountingType = 'recessed' | 'surface' | 'pendant' | 'wall' | 'track';
export type ProductEnvironment = 'indoor' | 'outdoor';
export type LightSource = 'LED Integrated' | 'GU10' | 'E27' | 'E14' | 'GU5.3' | 'Other';
export type IpRating = 'IP20' | 'IP44' | 'IP54' | 'IP65' | 'IP67' | 'IP68';
export type ElectricalClass = 'Class I' | 'Class II' | 'Class III';
export type ControlType = 'on-off' | 'phase' | 'dali' | '0-10v' | '1-10v' | 'casambi' | 'zigbee' | 'dmx' | 'push' | 'driver-not-included';

export const CONTROL_TYPE_LABELS: Record<ControlType, string> = {
  'on-off': 'On/Off',
  'phase': 'Phase Cut',
  'dali': 'DALI',
  '0-10v': '0-10V',
  '1-10v': '1-10V',
  'casambi': 'Casambi',
  'zigbee': 'Zigbee',
  'dmx': 'DMX512',
  'push': 'Push-dim',
  'driver-not-included': 'Driver Not Included',
};

export const ALL_CONTROL_TYPES: ControlType[] = [
  'on-off', 'phase', 'dali', '0-10v', '1-10v', 'casambi', 'zigbee', 'dmx', 'push', 'driver-not-included',
];

export interface ProductDimensions {
  width_mm?: number;
  height_mm?: number;
  length_mm?: number;
  weight_kg?: number;
}

export interface ProductVariant {
  id: string;
  slug: string;
  name: string;
  code: string;
  /** Full/long SKU derived from the spec sheet (all segments). Display-only. */
  full_code?: string;
  short_description: string;
  long_description: string;
  category_id: string;
  product_id: string | null;
  environment: ProductEnvironment | null;
  
  mounting_type: MountingType | null;
  ip_rating: string | null;
  light_source: string | null;
  power_w: number | null;
  power_w_system: number | null;
  lumens: number | null;
  lumens_system: number | null;
  efficacy_lm_per_w: number | null;
  cct_min: number | null;
  cct_max: number | null;
  cri: number | null;
  beam_angle: number | null;
  control_types: string[];
  voltage: string | null;
  class: string | null;
  material: string | null;
  finish: string | null;
  dimensions: ProductDimensions | null;
  
  manufacturer: string | null;
  manufacturer_sku: string | null;
  cost_usd: number | null;
  distributor_price: number | null;

  is_active: boolean;
  is_featured: boolean;
  
  created_at: string;
  updated_at: string;
  
  // Relations (populated via joins)
  category?: ProductCategory;
  product?: Product;
  skus?: ProductSku[];
  assets?: ProductAsset[];
  projects?: InspirationProject[];
}

export interface ProductSku {
  id: string;
  variant_id: string;
  code: string;
  name: string;
  finish: string | null;
  cct: number | null;
  lumens: number | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export type AssetType = 
  | 'image' 
  | 'installed_image'
  | 'dimensions_image'
  | 'photometric_image'
  | 'datasheet' 
  | 'photometric' 
  | 'manual' 
  | 'catalogue' 
  | 'line_drawing' 
  | 'revit' 
  | '3d' 
  | 'other';

export interface ProductAsset {
  id: string;
  variant_id: string | null;
  type: AssetType;
  title: string;
  language: string | null;
  file_url: string;
  file_extension: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface PriceList {
  id: string;
  name: string;
  currency: string;
  description: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductPrice {
  id: string;
  variant_id: string;
  price_list_id: string;
  price: number;
  valid_from: string;
  valid_to: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserProfile {
  id: string;
  full_name: string;
  role: 'admin' | 'editor' | 'viewer';
  created_at: string;
  updated_at: string;
}

export interface SiteImage {
  id: string;
  key: string;
  label: string;
  description: string | null;
  image_url: string | null;
  alt_text: string | null;
  section: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface VariantFilters {
  search?: string;
  category?: string;
  mounting_type?: MountingType;
  ip_rating?: string;
  light_source?: string;
  control_type?: string;
  cct_min?: number;
  cct_max?: number;
  is_featured?: boolean;
  page?: number;
  limit?: number;
}

export interface VariantListResponse {
  variants: ProductVariant[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface VariantFormData {
  name: string;
  code: string;
  slug: string;
  short_description: string;
  long_description: string;
  category_id: string;
  product_id: string | null;
  mounting_type: MountingType | null;
  ip_rating: string | null;
  light_source: string | null;
  power_w: number | null;
  power_w_system: number | null;
  lumens: number | null;
  lumens_system: number | null;
  cct_min: number | null;
  cct_max: number | null;
  cri: number | null;
  beam_angle: number | null;
  control_types: string[];
  voltage: string | null;
  class: string | null;
  material: string | null;
  finish: string | null;
  dimensions: ProductDimensions | null;
  manufacturer: string | null;
  manufacturer_sku: string | null;
  cost_usd: number | null;
  distributor_price: number | null;
  is_active: boolean;
  is_featured: boolean;
}

export interface AppSettings {
  eur_to_usd_rate: number;
  /** Brand logo shown on the spec sheet header (Preview + PDF). */
  brand_logo_url: string | null;
}

export interface Manufacturer {
  id: string;
  name: string;
  country: string | null;
  currency: string | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}
