'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentUserRole } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { slugify } from '@/lib/utils';
import { SKU_RULES_VERSION, buildSku, hasCopyMarker, looksLikeCopy } from '@/lib/sku/skuRules';
import { seedSpecSheetFromVariant, specSheetToVariantFields } from '@/lib/sku/mapToLuken';
import {
  applyCopyMarker,
  applyFooterDefault,
  clearCopyMarker,
  normalizeSpecSheet,
  syncIdentityFromSku,
  withAutoLastUpdate,
  type SpecSheetData,
} from '@/lib/sku/specSheet';
import { getSettings } from '@/app/(admin)/admin/settings/actions';
import type { DatasheetBackfillPlan, DatasheetJob } from '@/lib/specsheet/datasheetBackfill';
import type { SkuIdentity, SkuRebuildPlan, SkuRebuildRow } from '@/lib/sku/skuRebuild';
import type { ProductAsset } from '@/lib/types';

const IMAGE_BUCKET_TYPES = new Set(['image', 'installed_image', 'dimensions_image', 'photometric_image']);

export async function updateVariant(variantId: string, formData: FormData) {
  const supabase = await createClient();
  if (!supabase) return { error: 'Supabase not configured' };

  // Pricing / status. (Relationships — family/category/environment — are owned by
  // the Builder tab in the embedded editor, so we only touch them here when the
  // standalone form actually submits them.)
  const data: Record<string, any> = {
    manufacturer: formData.get('manufacturer') || null,
    manufacturer_sku: formData.get('manufacturer_sku') || null,
    cost_usd: formData.get('cost_usd') ? Number(formData.get('cost_usd')) : null,
    distributor_price: formData.get('distributor_price') ? Number(formData.get('distributor_price')) : null,
    is_active: formData.getAll('is_active').includes('true'),
    is_featured: formData.getAll('is_featured').includes('true'),
  };

  if (formData.has('product_id')) {
    const productId = (formData.get('product_id') as string) || null;
    let categoryId = (formData.get('category_id') as string) || null;
    let environment = (formData.get('environment') as string) || null;

    if (productId) {
      const { data: product } = await supabase
        .from('products')
        .select('category_id, environment')
        .eq('id', productId)
        .single();
      if (product?.category_id) categoryId = product.category_id;
      if (product?.environment) environment = product.environment;
    }

    data.product_id = productId;
    data.category_id = categoryId;
    data.environment = environment;
  }

  const { error } = await supabase
    .from('product_variants')
    .update(data)
    .eq('id', variantId);

  if (error) return { error: error.message };

  revalidatePath(`/admin/variants/${variantId}`);
  revalidatePath('/admin/variants');
  revalidatePath('/products');
  return { success: true };
}

/**
 * Save the SKU/spec-sheet builder for an existing variant. Updates only the
 * variant identity (code / name / slug / descriptions — Luken's source of
 * truth for the SKU) and upserts the spec_sheet (ficha + SKU state for
 * re-edit). Technical specs & pricing stay owned by the Details form.
 */
export async function saveVariantBuilder(
  variantId: string,
  data: SpecSheetData,
  rel?: { product_id?: string | null; category_id?: string | null; environment?: string | null }
) {
  const supabase = await createClient();
  if (!supabase) return { error: 'Supabase not configured' };

  // Last updated is always the save day — never a manual field.
  // Builder SKU is source of truth for identity — never persist a stale Name/Code
  // left over from a previous configuration (manual link flags / old sheet data).
  data = syncIdentityFromSku(withAutoLastUpdate(data));

  // A duplicate carries a COPY segment only so it does not collide with the
  // variant it came from. The moment it has a difference of its own — another
  // optic, CCT, finish — the mark has done its job, so saving drops it and the
  // copy reads like any other variant. Nothing to remember, nothing to re-apply.
  if (hasCopyMarker(data.sku)) {
    const bare = clearCopyMarker(data);
    const bareBuilt = buildSku(bare.sku);
    const bareCode = (bare.code || bareBuilt.longCode || bareBuilt.shortCode).trim();
    if (bareCode) {
      const { data: bareOwner } = await supabase
        .from('product_variants')
        .select('id')
        .eq('code', bareCode)
        .neq('id', variantId)
        .limit(1);
      if (!bareOwner?.length) data = bare;
    }
  }

  const r = buildSku(data.sku);
  // Long SKU wins — short alone is not unique across optic/CCT/finish variants.
  const code = (data.code || r.longCode || r.shortCode).trim();
  if (!code) return { error: 'A SKU code is required (complete at least the Series).' };
  const name = (data.name || data.productName).trim() || code;

  // The slug is frozen on first save: public URLs (and links already shared with
  // customers or indexed by search engines) must survive a Long-SKU edit.
  const { data: current } = await supabase
    .from('product_variants')
    .select('slug, is_active')
    .eq('id', variantId)
    .maybeSingle();
  const currentSlug = (current?.slug || '').trim();
  // One exception: a copy's URL was minted from its COPY code. While it has never
  // been public there is nobody to break, so it gets a clean one instead of
  // carrying "-copy" for the rest of its life.
  const slug = await (async () => {
    if (!currentSlug) return slugify(code);
    if (current?.is_active !== false || !looksLikeCopy(currentSlug)) return currentSlug;
    const wanted = slugify(code);
    if (!wanted || wanted === currentSlug) return currentSlug;
    const { data: slugOwner } = await supabase
      .from('product_variants')
      .select('id')
      .eq('slug', wanted)
      .neq('id', variantId)
      .limit(1);
    return slugOwner?.length ? currentSlug : wanted;
  })();
  if (!slug) return { error: 'Could not build a URL slug from the SKU code.' };

  // With the slug frozen, the UNIQUE(slug) index no longer guards Long-SKU
  // collisions, so the code has to be checked explicitly.
  const { data: codeOwner } = await supabase
    .from('product_variants')
    .select('id')
    .eq('code', code)
    .neq('id', variantId)
    .limit(1);
  if (codeOwner?.length) {
    return {
      error: `Another variant already uses this Long SKU ("${code}"). Change optic, CCT, color, or another Long-SKU segment so it is unique.`,
    };
  }

  // Builder is the source of truth for identity + technical specs + dimensions.
  // In the tabbed editor it also owns the family relationship (product_id) and
  // the inherited category/environment.
  const vf = specSheetToVariantFields(data, null);
  const updatePayload: Record<string, any> = {
    code,
    name,
    slug,
    short_description: data.codeDescription || r.shortDesc,
    long_description: data.description || r.longDesc,
    light_source: vf.light_source,
    power_w: vf.power_w,
    power_w_system: vf.power_w_system,
    lumens: vf.lumens,
    lumens_system: vf.lumens_system,
    efficacy_lm_per_w: vf.efficacy_lm_per_w,
    cct_min: vf.cct_min,
    cct_max: vf.cct_max,
    cri: vf.cri,
    beam_angle: vf.beam_angle,
    voltage: vf.voltage,
    finish: vf.finish,
    material: vf.material,
    ip_rating: vf.ip_rating,
    class: vf.class,
    control_types: vf.control_types,
    mounting_type: vf.mounting_type,
    dimensions: vf.dimensions,
    sku_rules_version: SKU_RULES_VERSION,
  };

  if (rel) {
    const productId = rel.product_id || null;
    let categoryId = rel.category_id || null;
    let environment = rel.environment || null;

    if (productId) {
      const { data: product } = await supabase
        .from('products')
        .select('category_id, environment')
        .eq('id', productId)
        .single();
      if (product?.category_id) categoryId = product.category_id;
      if (product?.environment) environment = product.environment;
    }

    updatePayload.product_id = productId;
    updatePayload.category_id = categoryId;
    updatePayload.environment = environment;
  }

  const { error: vErr } = await supabase
    .from('product_variants')
    .update(updatePayload)
    .eq('id', variantId);
  if (vErr) {
    if (vErr.message.includes('products_slug_key') || vErr.message.includes('duplicate key')) {
      return {
        error: `Another variant already uses this Long SKU / slug ("${code}"). Change optic, CCT, color, or another Long-SKU segment so the copy is unique.`,
      };
    }
    return { error: vErr.message };
  }

  await supabase.from('product_skus').update({ code, name }).eq('variant_id', variantId);

  const { data: variant } = await supabase
    .from('product_variants')
    .select('product_id')
    .eq('id', variantId)
    .single();

  const { data: existing } = await supabase
    .from('spec_sheets')
    .select('id')
    .eq('variant_id', variantId)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) {
    await supabase
      .from('spec_sheets')
      .update({ product_name: data.productName, code, data, product_id: variant?.product_id ?? null })
      .eq('id', existing.id);
  } else {
    const { data: userRes } = await supabase.auth.getUser();
    await supabase.from('spec_sheets').insert({
      variant_id: variantId,
      product_id: variant?.product_id ?? null,
      product_name: data.productName,
      code,
      data,
      created_by: userRes.user?.id ?? null,
    });
  }

  revalidatePath(`/admin/variants/${variantId}`);
  revalidatePath('/admin/variants');
  revalidatePath('/products');
  return { success: true, lastUpdate: data.lastUpdate };
}

/** Asset types that represent a single slot (re-upload replaces previous). */
const REPLACE_ON_UPLOAD = new Set([
  'image',
  'photometric_image',
  'dimensions_image',
  // Auto-generated Preview PDF + manual datasheet uploads share one slot.
  'datasheet',
]);

/** Storage object path from a public URL (strips ?v= cache-busters). */
function storagePathFromPublicUrl(fileUrl: string, bucket: string): string | null {
  const marker = `/storage/v1/object/public/${bucket}/`;
  const idx = fileUrl.indexOf(marker);
  if (idx < 0) return null;
  const raw = fileUrl.slice(idx + marker.length);
  const pathOnly = raw.split('?')[0].split('#')[0];
  if (!pathOnly) return null;
  try {
    return decodeURIComponent(pathOnly);
  } catch {
    return pathOnly;
  }
}

async function revalidateVariantPublicPages(
  supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>,
  variantId: string
) {
  revalidatePath(`/admin/variants/${variantId}`);
  revalidatePath('/admin/variants');
  revalidatePath('/products', 'layout');
  revalidatePath('/', 'layout');

  const { data: row } = await supabase
    .from('product_variants')
    .select('slug, product:products(slug)')
    .eq('id', variantId)
    .maybeSingle();

  const productSlug = (row as { product?: { slug?: string } | null } | null)?.product?.slug;
  const variantSlug = row?.slug;
  if (productSlug) {
    revalidatePath(`/products/${productSlug}`);
    if (variantSlug) {
      revalidatePath(`/products/${productSlug}/${variantSlug}`);
    }
  }
}

export async function saveVariantAsset(
  variantId: string,
  assetType: string,
  title: string,
  fileUrl: string,
  fileExtension: string
) {
  const supabase = await createClient();
  if (!supabase) return { error: 'Supabase not configured' };

  // Replacing the primary / sheet slot image must remove older rows of the same
  // type. Otherwise galleries and cards keep showing assets[0] (first upload).
  if (REPLACE_ON_UPLOAD.has(assetType)) {
    const { data: previous } = await supabase
      .from('product_assets')
      .select('id, file_url, type')
      .eq('variant_id', variantId)
      .eq('type', assetType);

    for (const asset of previous || []) {
      if (asset.file_url?.includes('/storage/v1/object/public/')) {
        const bucket = IMAGE_BUCKET_TYPES.has(asset.type) ? 'product-images' : 'documents';
        const path = storagePathFromPublicUrl(asset.file_url, bucket);
        // Skip removing the file we just uploaded (same path, e.g. stable datasheet.pdf).
        const newPath = storagePathFromPublicUrl(fileUrl, bucket);
        if (path && path !== newPath) {
          await supabase.storage.from(bucket).remove([path]);
        }
      }
      const { error: delErr } = await supabase.from('product_assets').delete().eq('id', asset.id);
      if (delErr) return { error: `Could not replace previous ${assetType}: ${delErr.message}` };
    }
  }

  const { error: dbError, data } = await supabase
    .from('product_assets')
    .insert({
      variant_id: variantId,
      type: assetType,
      title,
      file_url: fileUrl,
      file_extension: fileExtension,
    })
    .select()
    .single();

  if (dbError) return { error: dbError.message };

  await revalidateVariantPublicPages(supabase, variantId);
  return { success: true, asset: data };
}

export async function deleteVariantAsset(assetId: string, variantId: string) {
  const supabase = await createClient();
  if (!supabase) return { error: 'Supabase not configured' };

  const { data: asset } = await supabase
    .from('product_assets')
    .select('*')
    .eq('id', assetId)
    .single();

  if (asset?.file_url) {
    const bucket = IMAGE_BUCKET_TYPES.has(asset.type) ? 'product-images' : 'documents';
    const path = storagePathFromPublicUrl(asset.file_url, bucket);
    if (path) {
      await supabase.storage.from(bucket).remove([path]);
    }
  }

  const { error } = await supabase
    .from('product_assets')
    .delete()
    .eq('id', assetId);

  if (error) return { error: error.message };

  await revalidateVariantPublicPages(supabase, variantId);
  return { success: true };
}

export async function deleteVariant(variantId: string) {
  const supabase = await createClient();
  if (!supabase) return { error: 'Supabase not configured' };

  const { data: assets } = await supabase
    .from('product_assets')
    .select('*')
    .eq('variant_id', variantId);

  if (assets) {
    for (const asset of assets) {
      if (asset.file_url?.includes('/storage/v1/object/public/')) {
        const bucket = IMAGE_BUCKET_TYPES.has(asset.type) ? 'product-images' : 'documents';
        const pathParts = asset.file_url.split(`/storage/v1/object/public/${bucket}/`);
        if (pathParts[1]) {
          await supabase.storage.from(bucket).remove([decodeURIComponent(pathParts[1])]);
        }
      }
    }
  }

  const { error } = await supabase
    .from('product_variants')
    .delete()
    .eq('id', variantId);

  if (error) return { error: error.message };

  revalidatePath('/admin/variants');
  revalidatePath('/products');
  revalidatePath('/');
  return { success: true };
}

/** Activate / deactivate a variant (public visibility). */
export async function setVariantActive(variantId: string, isActive: boolean) {
  const supabase = await createClient();
  if (!supabase) return { error: 'Supabase not configured' };

  const { error } = await supabase
    .from('product_variants')
    .update({ is_active: isActive })
    .eq('id', variantId);

  if (error) return { error: error.message };

  revalidatePath(`/admin/variants/${variantId}`);
  revalidatePath('/admin/variants');
  revalidatePath('/products');
  revalidatePath('/');
  return { success: true };
}

function parsePublicStorageUrl(fileUrl: string): { bucket: string; path: string } | null {
  const match = fileUrl.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/);
  if (!match) return null;
  return { bucket: match[1], path: decodeURIComponent(match[2]) };
}

type AdminSupabase = NonNullable<Awaited<ReturnType<typeof createClient>>>;

/** Drop a trailing -COPY / -COPY2 so re-duplicating doesn't stack suffixes. */
function stripCopySuffix(code: string): string {
  return (code || '').replace(/-COPY\d*$/i, '').trim();
}

async function allocateCopyCode(
  supabase: AdminSupabase,
  baseCode: string
): Promise<{ code: string; slug: string }> {
  const root = stripCopySuffix(baseCode || 'VARIANT') || 'VARIANT';
  for (let n = 1; n <= 99; n++) {
    const suffix = n === 1 ? '-COPY' : `-COPY${n}`;
    const code = `${root}${suffix}`;
    const slug = slugify(code) || `variant-copy-${Date.now()}`;
    const [{ data: byCode }, { data: bySlug }] = await Promise.all([
      supabase.from('product_variants').select('id').eq('code', code).limit(1),
      supabase.from('product_variants').select('id').eq('slug', slug).limit(1),
    ]);
    if (!byCode?.length && !bySlug?.length) return { code, slug };
  }
  const fallback = `${root}-COPY-${Date.now()}`;
  return { code: fallback, slug: slugify(fallback) || `variant-copy-${Date.now()}` };
}

/**
 * Find the copy marker (COPY, COPY2, …) that gives this sheet a free Long SKU.
 *
 * The marker lives in the SKU, so the copy generates its own identity instead of
 * carrying a patched string the next save would overwrite.
 */
async function allocateCopyMarker(
  supabase: AdminSupabase,
  sheet: SpecSheetData
): Promise<{ marked: SpecSheetData; code: string; slug: string; n: number } | null> {
  for (let n = 1; n <= 99; n++) {
    const marked = applyCopyMarker(sheet, n);
    const code = marked.code.trim();
    if (!code) return null;
    const slug = slugify(code);
    if (!slug) return null;
    const [{ data: byCode }, { data: bySlug }] = await Promise.all([
      supabase.from('product_variants').select('id').eq('code', code).limit(1),
      supabase.from('product_variants').select('id').eq('slug', slug).limit(1),
    ]);
    if (!byCode?.length && !bySlug?.length) return { marked, code, slug, n };
  }
  return null;
}

/**
 * Full duplicate of a variant: row fields (incl. pricing), SKUs, spec sheet,
 * and every asset file (storage objects are copied, not shared).
 * New copy starts inactive so it can be edited before going public.
 */
export async function duplicateVariant(variantId: string) {
  const supabase = await createClient();
  if (!supabase) return { error: 'Supabase not configured' };

  const { data: source, error: srcErr } = await supabase
    .from('product_variants')
    .select('*')
    .eq('id', variantId)
    .single();
  if (srcErr || !source) return { error: srcErr?.message || 'Variant not found' };

  const { data: sheetRow } = await supabase
    .from('spec_sheets')
    .select('data, code')
    .eq('variant_id', variantId)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  // Identity comes from the marked SKU when there is a sheet to build it from, so
  // the copy's stored code is the one it regenerates. Sheet-less variants (typed
  // or imported identity) keep the old string suffix — there is nothing to build.
  const sheet = sheetRow?.data
    ? normalizeSpecSheet(sheetRow.data as Partial<SpecSheetData>)
    : null;
  const allocated = sheet ? await allocateCopyMarker(supabase, sheet) : null;
  const { code, slug } =
    allocated ?? (await allocateCopyCode(supabase, source.code || source.name || 'VARIANT'));

  const {
    id: _id,
    created_at: _created,
    updated_at: _updated,
    ...fields
  } = source;

  const insertPayload = {
    ...fields,
    code,
    slug,
    name: allocated
      ? allocated.marked.name || code
      : source.name
        ? `${source.name} (copy)`
        : code,
    short_description: allocated ? allocated.marked.codeDescription : source.short_description,
    long_description: allocated ? allocated.marked.description : source.long_description,
    sku_rules_version: SKU_RULES_VERSION,
    is_active: false,
    is_featured: false,
  };

  const { data: created, error: createErr } = await supabase
    .from('product_variants')
    .insert(insertPayload)
    .select('id')
    .single();

  if (createErr || !created) {
    return { error: createErr?.message || 'Failed to create copy' };
  }

  const newId = created.id as string;

  try {
    const { data: skus } = await supabase
      .from('product_skus')
      .select('code, name, finish, cct, lumens, is_active, sort_order')
      .eq('variant_id', variantId);

    if (skus?.length) {
      const { error: skuErr } = await supabase.from('product_skus').insert(
        skus.map((sku, i) => ({
          ...sku,
          variant_id: newId,
          code: i === 0 ? code : `${code}-${i + 1}`,
          name: sku.name ? `${sku.name} (copy)` : code,
        }))
      );
      if (skuErr) throw new Error(skuErr.message);
    } else {
      await supabase.from('product_skus').insert({
        variant_id: newId,
        code,
        name: insertPayload.name,
        finish: source.finish,
        is_active: true,
      });
    }

    const { data: sheets } = await supabase
      .from('spec_sheets')
      .select('product_id, product_name, code, data')
      .eq('variant_id', variantId)
      .is('deleted_at', null);

    if (sheets?.length) {
      const { data: userRes } = await supabase.auth.getUser();
      const { error: sheetErr } = await supabase.from('spec_sheets').insert(
        sheets.map((row) => {
          // The marker goes into the SKU, so the sheet generates the copy's code
          // on its own. Without it the copy would rebuild its source's identity
          // and no save would ever go through.
          const data = allocated
            ? applyCopyMarker(normalizeSpecSheet(row.data as Partial<SpecSheetData>), allocated.n)
            : row.data;
          return {
            variant_id: newId,
            product_id: row.product_id ?? source.product_id ?? null,
            product_name: row.product_name,
            code: allocated ? allocated.code : code,
            data,
            created_by: userRes.user?.id ?? null,
          };
        })
      );
      if (sheetErr) throw new Error(sheetErr.message);
    }

    const { data: assets } = await supabase
      .from('product_assets')
      .select('*')
      .eq('variant_id', variantId)
      .order('sort_order');

    for (const asset of assets || []) {
      let fileUrl = asset.file_url as string;
      const parsed = fileUrl ? parsePublicStorageUrl(fileUrl) : null;
      const bucket =
        parsed?.bucket ||
        (IMAGE_BUCKET_TYPES.has(asset.type) ? 'product-images' : 'documents');

      if (parsed) {
        const { data: blob, error: dlErr } = await supabase.storage
          .from(parsed.bucket)
          .download(parsed.path);
        if (dlErr || !blob) {
          // Fall back to shared URL if download fails (still keep the row).
        } else {
          const ext =
            asset.file_extension ||
            parsed.path.split('.').pop()?.toLowerCase() ||
            'bin';
          const destPath = `${newId}/${asset.type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
          const { error: upErr } = await supabase.storage
            .from(bucket)
            .upload(destPath, blob, { upsert: true, contentType: blob.type || undefined });
          if (!upErr) {
            fileUrl = supabase.storage.from(bucket).getPublicUrl(destPath).data.publicUrl;
          }
        }
      }

      const { error: assetErr } = await supabase.from('product_assets').insert({
        variant_id: newId,
        type: asset.type,
        title: asset.title,
        language: asset.language,
        file_url: fileUrl,
        file_extension: asset.file_extension,
        sort_order: asset.sort_order,
      });
      if (assetErr) throw new Error(assetErr.message);
    }
  } catch (err) {
    await supabase.from('spec_sheets').delete().eq('variant_id', newId);
    await supabase.from('product_variants').delete().eq('id', newId);
    return { error: err instanceof Error ? err.message : 'Duplicate failed' };
  }

  revalidatePath('/admin/variants');
  revalidatePath(`/admin/variants/${newId}`);
  revalidatePath('/products');
  return { success: true, newVariantId: newId, code };
}

/**
 * Replace the public datasheet PDF for a variant.
 * Uploads a new object, deletes every previous datasheet* file + DB row, then
 * inserts the new asset and revalidates the public product page.
 */
/**
 * Variants whose datasheet has to be produced, with everything needed to render it.
 *
 * By default those are the variants with no datasheet asset. Pass `variantIds` to
 * rebuild specific sheets instead — after a code change, an existing PDF still
 * shows the previous one.
 *
 * The PDF is produced from the live Preview DOM, so the actual export has to run
 * in the browser; this action only builds the work list.
 */
export async function listVariantsMissingDatasheet(
  variantIds?: string[]
): Promise<{ error: string } | DatasheetBackfillPlan> {
  const role = await getCurrentUserRole();
  if (role !== 'admin' && role !== 'editor') {
    return { error: 'Unauthorized' };
  }

  const supabase = await createClient();
  if (!supabase) return { error: 'Supabase not configured' };

  const [{ data: variants }, { data: datasheets }, { data: products }] = await Promise.all([
    supabase.from('product_variants').select('*').order('code'),
    supabase.from('product_assets').select('variant_id').eq('type', 'datasheet').not('file_url', 'is', null),
    supabase.from('products').select('id, name, description'),
  ]);

  const covered = new Set((datasheets || []).map((d) => d.variant_id).filter(Boolean));
  const wanted = variantIds ? new Set(variantIds) : null;
  const pending = (variants || []).filter((v) => (wanted ? wanted.has(v.id) : !covered.has(v.id)));
  if (pending.length === 0) {
    return { jobs: [], brandLogoUrl: null };
  }

  const pendingIds = pending.map((v) => v.id);
  const [{ data: assets }, { data: sheets }] = await Promise.all([
    supabase
      .from('product_assets')
      .select('*')
      .in('variant_id', pendingIds)
      .order('created_at', { ascending: false }),
    supabase
      .from('spec_sheets')
      .select('variant_id, data, updated_at')
      .in('variant_id', pendingIds)
      .is('deleted_at', null)
      .order('updated_at', { ascending: false }),
  ]);

  const assetsByVariant = new Map<string, ProductAsset[]>();
  for (const asset of (assets || []) as ProductAsset[]) {
    if (!asset.variant_id) continue;
    const list = assetsByVariant.get(asset.variant_id) || [];
    list.push(asset);
    assetsByVariant.set(asset.variant_id, list);
  }

  // Ordered newest-first above, so the first row per variant is the current sheet.
  const sheetByVariant = new Map<string, unknown>();
  for (const sheet of sheets || []) {
    if (!sheetByVariant.has(sheet.variant_id)) sheetByVariant.set(sheet.variant_id, sheet.data);
  }

  const familyById = new Map((products || []).map((p) => [p.id, p]));

  // app_settings is a key/value table: it has no brand_logo_url column, so
  // querying one returned nothing and backfilled sheets came out without a logo.
  const settings = await getSettings();

  const jobs: DatasheetJob[] = pending.map((variant) => {
    const family = variant.product_id ? familyById.get(variant.product_id) : undefined;
    const familyName = family?.name || variant.name || '';
    const raw = sheetByVariant.get(variant.id);
    const data = applyFooterDefault(
      raw
        ? normalizeSpecSheet(raw as Partial<SpecSheetData>)
        : seedSpecSheetFromVariant(variant, familyName),
      settings.sheet_footer_note
    );
    return {
      variantId: variant.id,
      code: data.code || variant.code || '',
      data,
      assets: assetsByVariant.get(variant.id) || [],
      familyOverview: family?.description ?? null,
    };
  });

  return { jobs, brandLogoUrl: settings.brand_logo_url };
}

/** A variant ready to be rewritten, with the sheet row that has to follow it. */
type RebuildWrite = SkuIdentity & {
  variantId: string;
  sheetId: string;
  data: SpecSheetData;
};

/**
 * Give a colliding copy its own identity by marking it in the SKU, and write the
 * marked sheet back into the pending write. Returns null when no free marker fits.
 */
function markCopyForRebuild(
  write: RebuildWrite,
  claimed: Map<string, string>,
  variantId: string
): SkuIdentity | null {
  for (let n = 1; n <= 99; n++) {
    const marked = applyCopyMarker(write.data, n);
    const code = marked.code.trim();
    if (!code) return null;
    const owner = claimed.get(code);
    if (owner && owner !== variantId) continue;

    write.data = marked;
    write.code = code;
    write.name = (marked.name || marked.productName).trim() || code;
    write.shortDescription = marked.codeDescription.trim();
    write.longDescription = marked.description.trim();
    return {
      code: write.code,
      name: write.name,
      shortDescription: write.shortDescription,
      longDescription: write.longDescription,
    };
  }
  return null;
}

/**
 * Read every variant and work out the identity the current rules would give it.
 *
 * The four values are computed exactly as `saveVariantBuilder` computes them, so
 * a rebuild lands on the same code, name and descriptions as opening the variant
 * and pressing Save — the batch cannot drift from a hand-made save. A variant
 * whose Name or Code was taken over by hand keeps it: `syncIdentityFromSku`
 * honours the sheet's link flags.
 */
async function readSkuRebuild(
  supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>
): Promise<{ plan: SkuRebuildPlan; writes: RebuildWrite[]; scannedIds: string[] }> {
  const [{ data: variants }, { data: sheets }, { data: products }] = await Promise.all([
    supabase
      .from('product_variants')
      .select('id, code, name, slug, short_description, long_description, product_id')
      .order('code'),
    supabase
      .from('spec_sheets')
      .select('id, variant_id, data, updated_at')
      .is('deleted_at', null)
      .order('updated_at', { ascending: false }),
    supabase.from('products').select('id, name'),
  ]);

  // Ordered newest-first, so the first row per variant is the sheet in use.
  const sheetByVariant = new Map<string, { id: string; data: unknown }>();
  for (const sheet of sheets || []) {
    if (!sheet.variant_id || sheetByVariant.has(sheet.variant_id)) continue;
    sheetByVariant.set(sheet.variant_id, { id: sheet.id, data: sheet.data });
  }
  const familyById = new Map((products || []).map((p) => [p.id, p.name as string]));

  const rows: SkuRebuildRow[] = [];
  const writes: RebuildWrite[] = [];
  const withoutSheet: string[] = [];
  const scannedIds: string[] = [];
  // Codes that will still be in use after the rebuild: one per variant, either
  // the rebuilt code or the stored one for the variants left untouched. Two
  // variants must not end up sharing a Long SKU.
  const claimed = new Map<string, string>();
  const pending: { row: SkuRebuildRow; write: RebuildWrite }[] = [];

  for (const variant of variants || []) {
    scannedIds.push(variant.id);
    const sheet = sheetByVariant.get(variant.id);
    const family = (variant.product_id ? familyById.get(variant.product_id) : '') || '';

    if (!sheet) {
      withoutSheet.push(variant.code || variant.name || variant.id);
      claimed.set((variant.code || '').trim(), variant.id);
      continue;
    }

    const data = syncIdentityFromSku(normalizeSpecSheet(sheet.data as Partial<SpecSheetData>));
    const r = buildSku(data.sku);
    const code = (data.code || r.longCode || r.shortCode).trim();
    const stored: SkuIdentity = {
      code: (variant.code || '').trim(),
      name: (variant.name || '').trim(),
      shortDescription: (variant.short_description || '').trim(),
      longDescription: (variant.long_description || '').trim(),
    };

    // No code means an unfinished sheet (no Series). Rewriting it would erase a
    // code the catalog is already using, so it is left as it is.
    if (!code) {
      withoutSheet.push(stored.code || variant.name || variant.id);
      claimed.set(stored.code, variant.id);
      continue;
    }

    const rebuilt: SkuIdentity = {
      code,
      name: (data.name || data.productName).trim() || code,
      shortDescription: (data.codeDescription || r.shortDesc).trim(),
      longDescription: (data.description || r.longDesc).trim(),
    };

    const row: SkuRebuildRow = {
      variantId: variant.id,
      family,
      slug: variant.slug || '',
      stored,
      rebuilt,
      blocked: null,
    };

    const same =
      stored.code === rebuilt.code &&
      stored.name === rebuilt.name &&
      stored.shortDescription === rebuilt.shortDescription &&
      stored.longDescription === rebuilt.longDescription;

    if (same) {
      claimed.set(stored.code, variant.id);
      continue;
    }

    pending.push({
      row,
      write: {
        variantId: variant.id,
        sheetId: sheet.id,
        data,
        ...rebuilt,
      },
    });
  }

  // Second pass: a rebuilt code may only be written if nothing else will carry it.
  for (const { row, write } of pending) {
    const owner = claimed.get(row.rebuilt.code);
    if (owner && owner !== row.variantId) {
      // A duplicate made before the marker lived in the SKU rebuilds its source's
      // code, so it can never be written — that is the row that sits in the list
      // showing a name nobody can change. Re-mark it and it becomes its own
      // variant again, keeping the "-COPY" code it is already known by.
      const remarked = looksLikeCopy(row.stored.code)
        ? markCopyForRebuild(write, claimed, row.variantId)
        : null;
      if (remarked) {
        row.rebuilt = remarked;
        claimed.set(remarked.code, row.variantId);
        writes.push(write);
      } else {
        row.blocked = `“${row.rebuilt.code}” would be used by two variants. Change a Long-SKU segment (optic, CCT, finish…) on one of them first.`;
      }
    } else {
      claimed.set(row.rebuilt.code, row.variantId);
      writes.push(write);
    }
    rows.push(row);
  }

  return {
    plan: { rows, scanned: (variants || []).length, withoutSheet },
    writes,
    scannedIds,
  };
}

/**
 * What a rebuild would change, without changing anything.
 *
 * Read first, apply second: a code is printed on labels and quoted to customers,
 * so the list is meant to be looked at before it is written.
 */
export async function planSkuRebuild(): Promise<{ error: string } | SkuRebuildPlan> {
  const role = await getCurrentUserRole();
  if (role !== 'admin' && role !== 'editor') return { error: 'Unauthorized' };

  const supabase = await createClient();
  if (!supabase) return { error: 'Supabase not configured' };

  const { plan } = await readSkuRebuild(supabase);
  return plan;
}

/**
 * Write the rebuilt identity onto every variant that needs it, and stamp the
 * whole catalog with the rules build that produced it.
 *
 * Slugs are not touched — public URLs outlive a code change.
 */
async function runSkuRebuild(
  supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>
): Promise<{ updated: number; skipped: number; failures: string[]; variantIds: string[] }> {
  const { plan, writes, scannedIds } = await readSkuRebuild(supabase);
  const failures: string[] = [];
  const variantIds: string[] = [];
  const failedIds = new Set<string>();

  for (const write of writes) {
    const { error } = await supabase
      .from('product_variants')
      .update({
        code: write.code,
        name: write.name,
        short_description: write.shortDescription,
        long_description: write.longDescription,
        sku_rules_version: SKU_RULES_VERSION,
      })
      .eq('id', write.variantId);

    if (error) {
      failures.push(`${write.code}: ${error.message}`);
      failedIds.add(write.variantId);
      continue;
    }

    await supabase
      .from('product_skus')
      .update({ code: write.code, name: write.name })
      .eq('variant_id', write.variantId);

    // The sheet carries the same identity inside its JSON, and it is what the
    // editor and the PDF read. Leaving it behind would make the next Save look
    // like it changed something.
    await supabase
      .from('spec_sheets')
      .update({ code: write.code, data: write.data })
      .eq('id', write.sheetId);

    variantIds.push(write.variantId);
  }

  // Everything that was read is now as current as these rules can make it —
  // including the rows that already matched, the ones blocked by a duplicate code
  // and the ones with no sheet to rebuild from. Stamping them all is what keeps
  // the automatic pass from doing this again on the next page load; the manual
  // Rebuild still recomputes every row from scratch and reports what it skipped.
  // A row whose write failed keeps its old stamp, so the next pass retries it.
  const stamped = scannedIds.filter((id) => !failedIds.has(id));
  if (stamped.length > 0) {
    await supabase
      .from('product_variants')
      .update({ sku_rules_version: SKU_RULES_VERSION })
      .in('id', stamped);
  }

  revalidatePath('/admin/variants');
  revalidatePath('/products', 'layout');
  revalidatePath('/', 'layout');

  return {
    updated: variantIds.length,
    skipped: plan.rows.filter((r) => r.blocked).length,
    failures,
    variantIds,
  };
}

/** Rebuild on demand, from the admin's own hands. */
export async function applySkuRebuild(): Promise<
  | { error: string }
  | { updated: number; skipped: number; failures: string[]; variantIds: string[] }
> {
  const role = await getCurrentUserRole();
  if (role !== 'admin' && role !== 'editor') return { error: 'Unauthorized' };

  const supabase = await createClient();
  if (!supabase) return { error: 'Supabase not configured' };

  return runSkuRebuild(supabase);
}

/**
 * Bring the catalog up to the current naming rules, if it is behind.
 *
 * A variant row stores what the rules generated, so changing a rule leaves every
 * row stale until someone opens the variant and saves it — which is how the list
 * and the Product tab ended up disagreeing. Each row carries the rules build that
 * wrote it, and the Variants page calls this on load: one pass per rules change,
 * nothing to remember.
 *
 * Cheap when there is nothing to do — a single count, then it returns.
 */
export async function ensureSkuRebuild(): Promise<
  | { error: string }
  | { stale: number; updated: number; skipped: number; failures: string[]; variantIds: string[] }
> {
  const role = await getCurrentUserRole();
  if (role !== 'admin' && role !== 'editor') return { error: 'Unauthorized' };

  const supabase = await createClient();
  if (!supabase) return { error: 'Supabase not configured' };

  const { count, error } = await supabase
    .from('product_variants')
    .select('id', { count: 'exact', head: true })
    .lt('sku_rules_version', SKU_RULES_VERSION);

  if (error) return { error: error.message };
  const stale = count ?? 0;
  if (stale === 0) {
    return { stale: 0, updated: 0, skipped: 0, failures: [], variantIds: [] };
  }

  const result = await runSkuRebuild(supabase);
  return { stale, ...result };
}

export async function replaceVariantDatasheetPdf(
  variantId: string,
  code: string,
  formData: FormData
) {
  try {
    const role = await getCurrentUserRole();
    if (role !== 'admin' && role !== 'editor') {
      return { error: 'Unauthorized' };
    }

    const file = formData.get('file');
    if (!file || typeof file === 'string') {
      return { error: 'Missing PDF file' };
    }
    const blob = file as Blob;
    if (typeof blob.arrayBuffer !== 'function' || blob.size < 100) {
      return { error: 'Generated PDF was empty' };
    }

    // Prefer service role so storage replace is never blocked by session quirks.
    const admin = createAdminClient();
    const supabase = admin || (await createClient());
    if (!supabase) return { error: 'Supabase not configured' };

    const stamp = Date.now();
    const safeCode = (code || 'spec-sheet').replace(/[^A-Za-z0-9._-]+/g, '-');
    // Stable object name: overwriting it keeps every previously shared link alive
    // while still serving the newest PDF. The ?v= param below busts the CDN cache.
    const fileName = 'datasheet.pdf';
    const filePath = `${variantId}/${fileName}`;
    const bytes = Buffer.from(await blob.arrayBuffer());

    const { error: uploadError } = await supabase.storage.from('documents').upload(filePath, bytes, {
      upsert: true,
      contentType: 'application/pdf',
      cacheControl: '0',
    });
    if (uploadError) return { error: `Storage upload failed: ${uploadError.message}` };

    // Drop legacy timestamped datasheets left by earlier versions of this action.
    const { data: listed } = await supabase.storage.from('documents').list(variantId, { limit: 100 });
    const stalePaths = (listed || [])
      .filter((obj) => obj.name.startsWith('datasheet') && obj.name !== fileName)
      .map((obj) => `${variantId}/${obj.name}`);
    if (stalePaths.length > 0) {
      await supabase.storage.from('documents').remove(stalePaths);
    }

    // Replace singleton DB slot.
    const { data: previous } = await supabase
      .from('product_assets')
      .select('id, file_url')
      .eq('variant_id', variantId)
      .eq('type', 'datasheet');
    // Manually uploaded datasheets can live under any name — clean those too.
    for (const prev of previous || []) {
      const prevPath = prev.file_url ? storagePathFromPublicUrl(prev.file_url, 'documents') : null;
      if (prevPath && prevPath !== filePath) {
        await supabase.storage.from('documents').remove([prevPath]);
      }
    }
    if (previous?.length) {
      const { error: delErr } = await supabase
        .from('product_assets')
        .delete()
        .eq('variant_id', variantId)
        .eq('type', 'datasheet');
      if (delErr) return { error: `Could not clear previous datasheet: ${delErr.message}` };
    }

    const { data: urlData } = supabase.storage.from('documents').getPublicUrl(filePath);
    const publicUrl = `${urlData.publicUrl}?v=${stamp}`;
    const title = `Spec Sheet / Datasheet (PDF) - ${safeCode}-spec-sheet.pdf`;

    const { data: asset, error: insertErr } = await supabase
      .from('product_assets')
      .insert({
        variant_id: variantId,
        type: 'datasheet',
        title,
        file_url: publicUrl,
        file_extension: 'pdf',
      })
      .select(
        'id, variant_id, type, title, language, file_url, file_extension, sort_order, created_at, updated_at'
      )
      .single();

    if (insertErr) return { error: `Could not save datasheet asset: ${insertErr.message}` };

    await revalidateVariantPublicPages(supabase, variantId);
    return { success: true, url: publicUrl, asset };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : 'Datasheet PDF replace failed',
    };
  }
}
