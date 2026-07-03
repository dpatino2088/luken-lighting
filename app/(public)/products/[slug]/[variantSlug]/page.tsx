import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ProductVariant } from '@/lib/types';
import { generateMetadata as genMeta } from '@/lib/seo';
import { VariantView } from '../VariantView';

interface PageProps {
  params: Promise<{ slug: string; variantSlug: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { slug, variantSlug } = await params;
  const supabase = await createClient();
  if (!supabase) return genMeta({ title: 'Not Found' });

  const { data: variant } = await supabase
    .from('product_variants')
    .select('name, code, short_description, product:products!inner(slug)')
    .eq('slug', variantSlug)
    .single();

  if (variant && (variant as any).product?.slug === slug) {
    return genMeta({
      title: variant.code || variant.name,
      description: variant.short_description,
      path: `/products/${slug}/${variantSlug}`,
    });
  }

  return genMeta({ title: 'Not Found' });
}

export default async function VariantPage({ params }: PageProps) {
  const { slug, variantSlug } = await params;
  const supabase = await createClient();
  if (!supabase) notFound();

  const { data: variant, error } = await supabase
    .from('product_variants')
    .select(
      `*, category:product_categories(*), product:products!inner(*), skus:product_skus(*), assets:product_assets(*)`
    )
    .eq('slug', variantSlug)
    .single();

  if (error || !variant || (variant as any).product?.slug !== slug) {
    notFound();
  }

  const { data: relatedVariants } = await supabase
    .from('product_variants')
    .select(`*, category:product_categories(*), assets:product_assets(*)`)
    .eq('category_id', variant.category_id)
    .eq('is_active', true)
    .neq('id', variant.id)
    .limit(4);

  return (
    <VariantView
      variant={variant}
      relatedVariants={(relatedVariants as ProductVariant[]) || []}
    />
  );
}
