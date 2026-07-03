import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { VariantEditTabs } from '@/components/admin/VariantEditTabs';
import { getSettings } from '@/app/(admin)/admin/settings/actions';
import { normalizeSpecSheet, type SpecSheetData } from '@/lib/sku/specSheet';
import { seedSpecSheetFromVariant } from '@/lib/sku/mapToLuken';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditVariantPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  if (!supabase) {
    return <p className="text-red-600">Supabase not configured.</p>;
  }

  const [
    { data: variant },
    { data: categories },
    { data: products },
    { data: assets },
    { data: specSheet },
  ] = await Promise.all([
    supabase.from('product_variants').select('*').eq('id', id).single(),
    supabase.from('product_categories').select('*').order('sort_order'),
    supabase.from('products').select('*').order('name'),
    supabase.from('product_assets').select('*').eq('variant_id', id).order('type').order('sort_order'),
    supabase
      .from('spec_sheets')
      .select('*')
      .eq('variant_id', id)
      .is('deleted_at', null)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (!variant) notFound();

  const settings = await getSettings();

  const productName = (products || []).find((p) => p.id === variant.product_id)?.name || variant.name || '';
  const initialData: SpecSheetData = specSheet?.data
    ? normalizeSpecSheet(specSheet.data as Partial<SpecSheetData>)
    : seedSpecSheetFromVariant(variant, productName);

  return (
    <VariantEditTabs
      variant={variant}
      categories={categories || []}
      products={products || []}
      assets={assets || []}
      settings={settings}
      initialData={initialData}
    />
  );
}
