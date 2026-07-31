import type { ProductVariant } from '@/lib/types';

export interface LabelData {
  /** Family, set largest — "LEDA". */
  family: string;
  /** Identity name of the configuration — "LEDA-RCS-TRK-ETC-TEC". */
  name: string;
  /** Long SKU, printed under the name as reference data. */
  code: string;
  /** Compact electrical summary, e.g. "GU10 max. 13W 120/240Vac IP20". */
  specLine: string;
  gtin: string | null;
  /** Null when the variant has no public page to point at. */
  qrUrl: string | null;
  logoUrl: string | null;
  siteText: string;
  originText: string;
}

/**
 * A representative variant, for judging a template before any product is chosen.
 *
 * Real strings: `LEDA-RCS-TRK-ETC-TEC` and a full Alhena SKU are what the sizes
 * have to survive, and a shorter stand-in would flatter every template. It lives
 * here, next to the type it fills, so the artwork drawn in Settings and the fit
 * summary printed beside it are measuring the same product.
 */
export const SAMPLE_LABEL_DATA: LabelData = {
  family: 'LEDA',
  name: 'LEDA-RCS-TRK-ETC-TEC',
  code: 'ALH15-32-TRA-LED-MOD-WH-CR90-CT30',
  specLine: 'GU10 max. 13W 120/240Vac IP20',
  // The GS1 sample number, check digit included, so the barcode drawn in Settings
  // is a real symbol at the real width rather than a grey block.
  gtin: '012345678905',
  qrUrl: 'https://lukenlighting.com/products/leda/leda-rcs-trk-etc-tec',
  logoUrl: null,
  siteText: 'lukenlighting.com',
  originText: 'Produced in China',
};

/**
 * Rebuilds the electrical summary line the factory prints under the name. It is
 * derived rather than typed so it cannot drift from the variant's real specs,
 * following the same rule the Builder uses for the SKU-linked fields.
 */
export function deriveSpecLine(variant: Pick<
  ProductVariant,
  'light_source' | 'power_w' | 'voltage' | 'ip_rating'
>): string {
  const parts: string[] = [];
  if (variant.light_source) parts.push(variant.light_source);
  if (variant.power_w) parts.push(`max. ${variant.power_w}W`);
  if (variant.voltage) parts.push(variant.voltage);
  if (variant.ip_rating) parts.push(variant.ip_rating);
  return parts.join(' ');
}

/**
 * Origin used on printed artwork.
 *
 * Never `window.location.origin`: a label exported from a dev machine or a
 * preview deploy would carry `localhost` on a physical box forever. Anything
 * that is not the public domain falls back to it.
 */
export function labelSiteOrigin(): string {
  const configured = (process.env.NEXT_PUBLIC_SITE_URL || '').trim().replace(/\/$/, '');
  const isPublic =
    configured &&
    !/localhost|127\.0\.0\.1|0\.0\.0\.0|\.vercel\.app|^http:\/\//i.test(configured);
  return isPublic ? configured : 'https://lukenlighting.com';
}

/**
 * Canonical public URL of the variant — the page a scan should land on.
 *
 * Safe to print because variant slugs are frozen on first save: a Long-SKU edit
 * no longer rewrites the slug, so a code printed today keeps resolving. Returns
 * null when the variant has no family, since it then has no public page.
 */
export function labelQrUrl(
  productSlug: string | null,
  variantSlug: string | null
): string | null {
  if (!productSlug || !variantSlug) return null;
  return `${labelSiteOrigin()}/products/${productSlug}/${variantSlug}`;
}
