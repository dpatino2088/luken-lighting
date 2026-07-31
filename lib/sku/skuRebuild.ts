/**
 * Rebuilding stored identity after a change to the naming rules.
 *
 * A variant's code, name and descriptions are generated from its spec sheet, but
 * they are also stored on the row so the catalog can be read without rebuilding
 * anything. When the rules change — a segment moves, a field is renamed — the
 * stored copies keep the old shape until each variant is saved again. These types
 * carry the difference, so it can be looked at before it is written.
 */

/** The generated part of a variant: what the naming rules decide. */
export interface SkuIdentity {
  code: string;
  name: string;
  shortDescription: string;
  longDescription: string;
}

export interface SkuRebuildRow {
  variantId: string;
  family: string;
  slug: string;
  stored: SkuIdentity;
  rebuilt: SkuIdentity;
  /** Why this one cannot be written. Null when it is ready to go. */
  blocked: string | null;
}

export interface SkuRebuildPlan {
  /** Only the variants whose stored identity differs from the rebuilt one. */
  rows: SkuRebuildRow[];
  /** How many variants were read. */
  scanned: number;
  /**
   * Variants with no spec sheet. Their identity was typed or imported rather than
   * generated, so there is nothing to rebuild it from and they are left alone.
   */
  withoutSheet: string[];
}

/** Which of the four generated values a rebuild would change. */
export function changedFields(row: SkuRebuildRow): (keyof SkuIdentity)[] {
  const keys: (keyof SkuIdentity)[] = ['code', 'name', 'shortDescription', 'longDescription'];
  return keys.filter((key) => row.stored[key] !== row.rebuilt[key]);
}
