import { type ClassValue, clsx } from 'clsx';

/**
 * Utility for merging Tailwind CSS classes
 */
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

/**
 * Format price with currency
 */
export function formatPrice(price: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(price);
}

/**
 * Generate slug from string
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w ]+/g, '')
    .replace(/ +/g, '-');
}

/**
 * Truncate text to specified length
 */
export function truncate(text: string, length: number): string {
  if (text.length <= length) return text;
  return text.slice(0, length) + '...';
}

/**
 * Format dimensions object to readable string
 */
export function formatDimensions(dimensions: any): string {
  if (!dimensions) return 'N/A';

  const size: string[] = [];
  if (dimensions.width_mm) size.push(`${dimensions.width_mm}`);
  if (dimensions.height_mm) size.push(`${dimensions.height_mm}`);
  if (dimensions.length_mm) size.push(`${dimensions.length_mm}`);

  const parts: string[] = [];
  if (size.length > 0) parts.push(size.join(' × ') + ' mm');
  if (dimensions.weight_kg) parts.push(`${dimensions.weight_kg} kg`);

  return parts.join(' · ') || 'N/A';
}

const CCT_SPECIAL_LABELS: Record<number, string> = { [-1]: 'RGB', [-2]: 'RGBW', [-3]: 'RGBWW', [-4]: 'RGB+CCT', [-5]: 'CCT' };

export function formatCCT(cct_min?: number | null, cct_max?: number | null): string {
  if (cct_min == null && cct_max == null) return 'N/A';
  if (cct_min != null && cct_min < 0) return CCT_SPECIAL_LABELS[cct_min] || 'N/A';
  if (cct_min === cct_max || !cct_max) return `${cct_min}K`;
  return `${cct_min}K – ${cct_max}K`;
}

export function formatCRI(cri?: number | null): string | null {
  if (cri == null) return null;
  if (cri >= 1000) {
    const base = Math.floor(cri / 100);
    const r9 = cri % 100;
    return `${base}+ CRI, R9>${r9}`;
  }
  return `${cri}+ CRI`;
}

/** Compact card label, e.g. CRI90 — matches BK / IP20 on product cards. */
export function formatCRICompact(cri?: number | null): string | null {
  if (cri == null) return null;
  const value = cri >= 1000 ? Math.floor(cri / 100) : cri;
  return `CRI${value}`;
}

