'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { isValidUpcA } from '@/lib/label/gtin';
import {
  LABEL_FIELDS,
  LABEL_LEVELS,
  readPlacements,
  validateLabelSize,
  validatePlacements,
  type LabelFieldKey,
  type LabelFieldRotation,
  type LabelLevel,
  type LabelOrientation,
  type LabelTemplate,
  type LabelTemplateInput,
} from '@/lib/label/geometry';

/** Column that carries each field's direction. */
const ROTATION_COLUMN: Record<LabelFieldKey, string> = {
  barcode: 'barcode_rotation',
  qr: 'qr_rotation',
  logo: 'logo_rotation',
  text: 'text_rotation',
  site: 'site_rotation',
};

// Spelled out rather than built from ROTATION_COLUMN: supabase-js reads the
// literal to type the result, and a computed string leaves every row as unknown.
const TEMPLATE_COLUMNS =
  'id, name, level, brand, width_mm, height_mm, orientation, sections, fold_mm, is_default, barcode_rotation, qr_rotation, logo_rotation, text_rotation, site_rotation, placements';

function rotationOf(value: unknown): LabelFieldRotation {
  return value === 'horizontal' || value === 'vertical' ? value : 'auto';
}

function mapTemplate(row: Record<string, unknown>): LabelTemplate {
  const rotation = {} as Record<LabelFieldKey, LabelFieldRotation>;
  for (const { key } of LABEL_FIELDS) rotation[key] = rotationOf(row[ROTATION_COLUMN[key]]);

  return {
    id: row.id as string,
    name: row.name as string,
    level: row.level as LabelLevel,
    brand: row.brand as string,
    // numeric() comes back as a string over the wire.
    width_mm: Number(row.width_mm),
    height_mm: Number(row.height_mm),
    orientation: row.orientation === 'portrait' ? 'portrait' : 'landscape',
    sections: Number(row.sections) === 2 ? 2 : 1,
    fold_mm: row.fold_mm === null ? null : Number(row.fold_mm),
    rotation,
    placements: readPlacements(row.placements),
    is_default: Boolean(row.is_default),
  };
}

function orientationOf(value: unknown): LabelOrientation {
  return value === 'portrait' ? 'portrait' : 'landscape';
}

/** The shared shape of an insert and an update, so the two cannot drift. */
function templateRow(input: LabelTemplateInput): Record<string, unknown> {
  const row: Record<string, unknown> = {
    name: input.name.trim(),
    level: input.level,
    brand: input.brand || 'Luken',
    width_mm: input.width_mm,
    height_mm: input.height_mm,
    orientation: orientationOf(input.orientation),
    sections: input.sections,
    fold_mm: input.sections === 2 ? input.fold_mm : null,
    // Re-read rather than passed through: this is the copy that reaches the column,
    // so it is also where a stray value from the client stops being trusted.
    placements: readPlacements(input.placements),
  };
  for (const { key } of LABEL_FIELDS) {
    row[ROTATION_COLUMN[key]] = rotationOf(input.rotation?.[key]);
  }
  return row;
}

/**
 * Packaging order, not alphabetical: a picker reads lamp → product box → inner →
 * master the way the goods are actually packed, and `inner_box` sorting before
 * `product` would scramble that.
 */
const LEVEL_ORDER = new Map(LABEL_LEVELS.map((l, i) => [l.value, i]));

function validate(input: LabelTemplateInput): string | null {
  if (!input.name.trim()) return 'The template needs a name.';
  // The size frame is enforced here as well as in the form: a template that is
  // outside it produces a label that silently leaves something out.
  const size = validateLabelSize(input);
  if (size) return size;
  // A hand-arranged box off the edge of the label is the one arrangement that
  // cannot be saved: it would be trimmed away at the die.
  return validatePlacements({ ...input, placements: readPlacements(input.placements) });
}

export async function listLabelTemplates(): Promise<LabelTemplate[]> {
  const supabase = await createClient();
  if (!supabase) return [];

  const { data } = await supabase.from('label_templates').select(TEMPLATE_COLUMNS);

  return (data || []).map(mapTemplate).sort(
    (a, b) =>
      (LEVEL_ORDER.get(a.level) ?? 99) - (LEVEL_ORDER.get(b.level) ?? 99) ||
      a.width_mm - b.width_mm ||
      a.name.localeCompare(b.name)
  );
}

/**
 * How many families print each template.
 * Deleting or resizing a template reaches every one of them, so the count is
 * shown before either action rather than after.
 */
export async function labelTemplateUsage(): Promise<Record<string, number>> {
  const supabase = await createClient();
  if (!supabase) return {};

  const { data } = await supabase
    .from('products')
    .select('label_template_id')
    .not('label_template_id', 'is', null);

  const usage: Record<string, number> = {};
  for (const row of data || []) {
    const id = row.label_template_id as string;
    usage[id] = (usage[id] || 0) + 1;
  }
  return usage;
}

export async function createLabelTemplate(
  input: LabelTemplateInput
): Promise<{ error: string } | { template: LabelTemplate }> {
  const supabase = await createClient();
  if (!supabase) return { error: 'Supabase not configured' };

  const invalid = validate(input);
  if (invalid) return { error: invalid };

  // First template becomes the default, so a family created before anyone picks
  // one still resolves to something printable.
  const { count } = await supabase
    .from('label_templates')
    .select('id', { count: 'exact', head: true });

  const { data, error } = await supabase
    .from('label_templates')
    .insert({ ...templateRow(input), is_default: (count ?? 0) === 0 })
    .select(TEMPLATE_COLUMNS)
    .single();

  if (error) return { error: error.message };

  revalidatePath('/admin/variants');
  return { template: mapTemplate(data) };
}

export async function updateLabelTemplate(
  id: string,
  input: LabelTemplateInput
): Promise<{ error: string } | { template: LabelTemplate }> {
  const supabase = await createClient();
  if (!supabase) return { error: 'Supabase not configured' };

  const invalid = validate(input);
  if (invalid) return { error: invalid };

  const { data, error } = await supabase
    .from('label_templates')
    .update({ ...templateRow(input), updated_at: new Date().toISOString() })
    .eq('id', id)
    .select(TEMPLATE_COLUMNS)
    .single();

  if (error) return { error: error.message };

  revalidatePath('/admin/variants');
  return { template: mapTemplate(data) };
}

/**
 * Removing a template does not remove the labels already sent to a supplier, but
 * it does leave every family that pointed at it without a size — the foreign key
 * nulls the reference — so they fall back to the default on next open.
 */
export async function deleteLabelTemplate(
  id: string
): Promise<{ error: string } | { success: true }> {
  const supabase = await createClient();
  if (!supabase) return { error: 'Supabase not configured' };

  const { error } = await supabase.from('label_templates').delete().eq('id', id);
  if (error) return { error: error.message };

  revalidatePath('/admin/variants');
  revalidatePath('/admin/products');
  return { success: true };
}

/** Exactly one default: the previous one is cleared before the new one is set. */
export async function setDefaultLabelTemplate(
  id: string
): Promise<{ error: string } | { success: true }> {
  const supabase = await createClient();
  if (!supabase) return { error: 'Supabase not configured' };

  const { error: clearError } = await supabase
    .from('label_templates')
    .update({ is_default: false })
    .eq('is_default', true);
  if (clearError) return { error: clearError.message };

  const { error } = await supabase
    .from('label_templates')
    .update({ is_default: true, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) return { error: error.message };

  revalidatePath('/admin/variants');
  return { success: true };
}

/**
 * Store the barcode number for a variant.
 *
 * The check digit is verified here rather than trusted: a transposed digit
 * produces a symbol that scans to the wrong product, and it is only discovered
 * after the boxes are printed. A GTIN is also never silently replaced — clearing
 * it has to be explicit, because it is already on packaging in the field.
 */
export async function setVariantGtin(
  variantId: string,
  gtin: string
): Promise<{ error: string } | { success: true; gtin: string | null }> {
  const supabase = await createClient();
  if (!supabase) return { error: 'Supabase not configured' };

  const digits = gtin.replace(/[\s-]/g, '');

  if (digits === '') {
    const { error } = await supabase
      .from('product_variants')
      .update({ gtin: null })
      .eq('id', variantId);
    if (error) return { error: error.message };
    revalidatePath(`/admin/variants/${variantId}`);
    return { success: true, gtin: null };
  }

  if (!/^[0-9]{12}$/.test(digits)) {
    return { error: 'A UPC-A has exactly 12 digits.' };
  }
  if (!isValidUpcA(digits)) {
    return {
      error: `Check digit does not match — ${digits} is not a valid UPC-A. Confirm the number with your GS1 allocation.`,
    };
  }

  const { error } = await supabase
    .from('product_variants')
    .update({ gtin: digits })
    .eq('id', variantId);

  if (error) {
    if (error.message.includes('product_variants_gtin_key') || error.message.includes('duplicate key')) {
      return { error: `Another variant already uses GTIN ${digits}.` };
    }
    return { error: error.message };
  }

  revalidatePath(`/admin/variants/${variantId}`);
  return { success: true, gtin: digits };
}

/** Remember the template a family prints, so it is picked once per product. */
export async function setProductLabelTemplate(
  productId: string,
  templateId: string | null
): Promise<{ error: string } | { success: true }> {
  const supabase = await createClient();
  if (!supabase) return { error: 'Supabase not configured' };

  const { error } = await supabase
    .from('products')
    .update({ label_template_id: templateId })
    .eq('id', productId);

  if (error) return { error: error.message };

  revalidatePath('/admin/products');
  return { success: true };
}
