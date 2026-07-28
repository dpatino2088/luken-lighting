'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentUserRole } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { slugify } from '@/lib/utils';
import { buildSku } from '@/lib/sku/skuRules';
import { seedSpecSheetFromVariant, specSheetToVariantFields } from '@/lib/sku/mapToLuken';
import {
  normalizeSpecSheet,
  syncIdentityFromSku,
  withAutoLastUpdate,
  type SpecSheetData,
} from '@/lib/sku/specSheet';
import type { DatasheetBackfillPlan, DatasheetJob } from '@/lib/specsheet/datasheetBackfill';
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

  const r = buildSku(data.sku);
  // Long SKU wins — short alone is not unique across optic/CCT/finish variants.
  const code = (data.code || r.longCode || r.shortCode).trim();
  if (!code) return { error: 'A SKU code is required (complete at least the Series).' };
  const name = (data.name || data.productName).trim() || code;

  // The slug is frozen on first save: public URLs (and links already shared with
  // customers or indexed by search engines) must survive a Long-SKU edit.
  const { data: current } = await supabase
    .from('product_variants')
    .select('slug')
    .eq('id', variantId)
    .maybeSingle();
  const slug = current?.slug?.trim() || slugify(code);
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

  // Prefer Long SKU from the builder sheet — that is what distinguishes copies
  // (optic degree, CCT, color, …) when the Short SKU stem is identical.
  let baseCode = source.code || source.name || 'VARIANT';
  {
    const { data: sheetRow } = await supabase
      .from('spec_sheets')
      .select('data, code')
      .eq('variant_id', variantId)
      .is('deleted_at', null)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    const sheetData = sheetRow?.data as { sku?: Parameters<typeof buildSku>[0] } | null;
    if (sheetData?.sku) {
      const built = buildSku(sheetData.sku);
      baseCode = built.longCode || built.shortCode || sheetRow?.code || baseCode;
    } else if (sheetRow?.code) {
      baseCode = sheetRow.code;
    }
  }

  const { code, slug } = await allocateCopyCode(supabase, baseCode);

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
    name: source.name ? `${source.name} (copy)` : code,
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
        sheets.map((sheet) => {
          const data =
            sheet.data && typeof sheet.data === 'object'
              ? JSON.parse(JSON.stringify(sheet.data))
              : sheet.data;
          if (data && typeof data === 'object') {
            if ('code' in data) (data as Record<string, unknown>).code = code;
            if ('name' in data && typeof (data as Record<string, unknown>).name === 'string') {
              (data as Record<string, unknown>).name = insertPayload.name;
            }
          }
          return {
            variant_id: newId,
            product_id: sheet.product_id ?? source.product_id ?? null,
            product_name: sheet.product_name,
            code,
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
 * Variants with no datasheet asset, with everything needed to render their sheet.
 *
 * The PDF is produced from the live Preview DOM, so the actual export has to run
 * in the browser; this action only builds the work list.
 */
export async function listVariantsMissingDatasheet(): Promise<
  { error: string } | DatasheetBackfillPlan
> {
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
  const pending = (variants || []).filter((v) => !covered.has(v.id));
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

  const jobs: DatasheetJob[] = pending.map((variant) => {
    const family = variant.product_id ? familyById.get(variant.product_id) : undefined;
    const familyName = family?.name || variant.name || '';
    const raw = sheetByVariant.get(variant.id);
    const data = raw
      ? normalizeSpecSheet(raw as Partial<SpecSheetData>)
      : seedSpecSheetFromVariant(variant, familyName);
    return {
      variantId: variant.id,
      code: data.code || variant.code || '',
      data,
      assets: assetsByVariant.get(variant.id) || [],
      familyOverview: family?.description ?? null,
    };
  });

  const { data: settings } = await supabase
    .from('app_settings')
    .select('brand_logo_url')
    .limit(1)
    .maybeSingle();

  return { jobs, brandLogoUrl: settings?.brand_logo_url ?? null };
}

export async function replaceVariantDatasheetPdf(
  variantId: string,
  code: string,
  formData: FormData
) {
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
    .select()
    .single();

  if (insertErr) return { error: `Could not save datasheet asset: ${insertErr.message}` };

  await revalidateVariantPublicPages(supabase, variantId);
  return { success: true, url: publicUrl, asset };
}
