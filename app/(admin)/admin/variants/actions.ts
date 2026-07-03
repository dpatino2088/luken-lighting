'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { slugify } from '@/lib/utils';
import { buildSku } from '@/lib/sku/skuRules';
import { specSheetToVariantFields } from '@/lib/sku/mapToLuken';
import type { SpecSheetData } from '@/lib/sku/specSheet';

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

  const r = buildSku(data.sku);
  const code = (data.code || r.shortCode).trim();
  if (!code) return { error: 'A SKU code is required (complete at least the Series).' };
  const name = (data.name || data.productName).trim() || code;

  // Builder is the source of truth for identity + technical specs + dimensions.
  // In the tabbed editor it also owns the family relationship (product_id) and
  // the inherited category/environment.
  const vf = specSheetToVariantFields(data, null);
  const updatePayload: Record<string, any> = {
    code,
    name,
    slug: slugify(code),
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
  if (vErr) return { error: vErr.message };

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
  return { success: true };
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

  revalidatePath(`/admin/variants/${variantId}`);
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
    const url = new URL(asset.file_url);
    const pathParts = url.pathname.split(`/storage/v1/object/public/${bucket}/`);
    if (pathParts[1]) {
      await supabase.storage.from(bucket).remove([pathParts[1]]);
    }
  }

  const { error } = await supabase
    .from('product_assets')
    .delete()
    .eq('id', assetId);

  if (error) return { error: error.message };

  revalidatePath(`/admin/variants/${variantId}`);
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
