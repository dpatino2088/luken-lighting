'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { slugify } from '@/lib/utils';
import {
  deriveIdentity,
  deriveSeries,
  normalizeSpecSheet,
  type SpecSheetData,
} from '@/lib/sku/specSheet';
import { buildSku } from '@/lib/sku/skuRules';

export async function createProduct(formData: FormData) {
  const supabase = await createClient();
  if (!supabase) return { error: 'Supabase not configured' };

  const name = formData.get('name') as string;
  const description = (formData.get('description') as string) || '';
  const slug = slugify(name);

  const { data: existing } = await supabase
    .from('products')
    .select('id')
    .eq('slug', slug)
    .single();

  if (existing) return { error: `A product with slug "${slug}" already exists` };

  const { data: maxOrder } = await supabase
    .from('products')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1)
    .single();

  const nextOrder = (maxOrder?.sort_order ?? 0) + 1;
  const category_id = (formData.get('category_id') as string) || null;
  const environment = (formData.get('environment') as string) || null;

  const { error, data } = await supabase
    .from('products')
    .insert({ name, slug, description, category_id, environment, sort_order: nextOrder })
    .select()
    .single();

  if (error) return { error: error.message };

  revalidatePath('/admin/products');
  revalidatePath('/admin/images');
  revalidatePath('/products');
  revalidatePath('/');
  return { success: true, product: data };
}

/**
 * When a family is renamed (Maia → Orion), cascade into every variant's
 * spec sheet: productName, linked series (MAI → ORI), and linked identity
 * fields (name / code / descriptions). Without this, the public page and
 * SKU builder keep showing the first name forever.
 */
async function cascadeProductRename(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  productId: string,
  newName: string,
) {
  const { data: variants } = await supabase
    .from('product_variants')
    .select('id, code, name, slug')
    .eq('product_id', productId);

  for (const variant of variants || []) {
    const { data: sheet } = await supabase
      .from('spec_sheets')
      .select('id, data')
      .eq('variant_id', variant.id)
      .is('deleted_at', null)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!sheet?.data) continue;

    const data: SpecSheetData = normalizeSpecSheet(sheet.data as Partial<SpecSheetData>);
    data.productName = newName;

    if (data.seriesLinked !== false) {
      data.sku = { ...data.sku, series: deriveSeries(newName) };
    }

    const derived = deriveIdentity(data);
    const link = data.link ?? {
      name: true,
      code: true,
      codeDescription: true,
      description: true,
    };
    if (link.name !== false) data.name = derived.name;
    if (link.code !== false) data.code = derived.code;
    if (link.codeDescription !== false) data.codeDescription = derived.codeDescription;
    if (link.description !== false) data.description = derived.description;

    const code = (data.code || buildSku(data.sku).shortCode).trim();
    const name = (data.name || data.productName).trim() || code;

    await supabase
      .from('spec_sheets')
      .update({ product_name: newName, code, data })
      .eq('id', sheet.id);

    await supabase
      .from('product_variants')
      .update({
        code,
        name,
        slug: slugify(code),
        short_description: data.codeDescription || null,
        long_description: data.description || null,
      })
      .eq('id', variant.id);

    await supabase.from('product_skus').update({ code, name }).eq('variant_id', variant.id);

    revalidatePath(`/admin/variants/${variant.id}`);
  }
}

export async function updateProduct(id: string, formData: FormData) {
  const supabase = await createClient();
  if (!supabase) return { error: 'Supabase not configured' };

  const { data: current } = await supabase
    .from('products')
    .select('id, name, slug, description, category_id, environment, hero_image_url, thumbnail_url')
    .eq('id', id)
    .single();

  if (!current) return { error: 'Product not found' };

  const name = (formData.get('name') as string)?.trim();
  if (!name) return { error: 'Name is required' };

  const description = formData.has('description')
    ? ((formData.get('description') as string) || '')
    : (current.description || '');
  const slug = formData.has('slug')
    ? ((formData.get('slug') as string) || slugify(name)).trim()
    : current.slug;

  const { data: existing } = await supabase
    .from('products')
    .select('id')
    .eq('slug', slug)
    .neq('id', id)
    .maybeSingle();

  if (existing) return { error: `Another product with slug "${slug}" already exists` };

  // Partial update: list rename (ProductFamiliesManager) omits image / environment
  // fields — never null them out. Only write keys the form actually sent.
  const update: Record<string, unknown> = { name, slug, description };

  if (formData.has('category_id')) {
    update.category_id = (formData.get('category_id') as string) || null;
  }
  if (formData.has('environment')) {
    update.environment = (formData.get('environment') as string) || null;
  }
  if (formData.has('hero_image_url')) {
    update.hero_image_url = (formData.get('hero_image_url') as string)?.trim() || null;
  }
  if (formData.has('thumbnail_url')) {
    update.thumbnail_url = (formData.get('thumbnail_url') as string)?.trim() || null;
  }

  const { error } = await supabase.from('products').update(update).eq('id', id);
  if (error) return { error: error.message };

  if (formData.has('environment')) {
    const environment = (formData.get('environment') as string) || null;
    const { error: variantSyncError } = await supabase
      .from('product_variants')
      .update({ environment })
      .eq('product_id', id);
    if (variantSyncError) return { error: variantSyncError.message };
  }

  if (current.name !== name) {
    await cascadeProductRename(supabase, id, name);
  }

  revalidatePath('/admin/products');
  revalidatePath('/admin/images');
  revalidatePath('/admin/variants');
  revalidatePath('/products');
  revalidatePath(`/products/${slug}`);
  if (current.slug !== slug) revalidatePath(`/products/${current.slug}`);
  revalidatePath('/');
  return { success: true };
}

export async function deleteProduct(id: string) {
  const supabase = await createClient();
  if (!supabase) return { error: 'Supabase not configured' };

  const { data: variants } = await supabase
    .from('product_variants')
    .select('id')
    .eq('product_id', id)
    .limit(1);

  if (variants && variants.length > 0) {
    return { error: 'Cannot delete: this product has variants assigned to it. Remove or reassign them first.' };
  }

  const { error } = await supabase
    .from('products')
    .delete()
    .eq('id', id);

  if (error) return { error: error.message };

  revalidatePath('/admin/products');
  revalidatePath('/admin/images');
  revalidatePath('/products');
  revalidatePath('/');
  return { success: true };
}

export async function updateProductSortOrder(orderedIds: string[]) {
  const supabase = await createClient();
  if (!supabase) return { error: 'Supabase not configured' };

  const updates = orderedIds.map((id, i) =>
    supabase.from('products').update({ sort_order: i + 1 }).eq('id', id)
  );
  await Promise.all(updates);

  revalidatePath('/admin/products');
  revalidatePath('/products');
  revalidatePath('/');
  return { success: true };
}
