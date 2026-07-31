import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PUBLIC_VARIANT_DETAIL, PUBLIC_VARIANT_RELATED } from '@/lib/supabase/publicSelects';
import { ProductVariant } from '@/lib/types';
import { generateMetadata as genMeta } from '@/lib/seo';
import { VariantView } from '../VariantView';

export const dynamic = 'force-dynamic';

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
    .eq('product.is_active', true)
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
    .select(PUBLIC_VARIANT_DETAIL)
    .eq('slug', variantSlug)
    .eq('product.is_active', true)
    .single();

  if (error || !variant || (variant as any).product?.slug !== slug) {
    notFound();
  }

  // Related Variants = the rest of the family, resolved automatically. Curating
  // this by hand meant every new variant had to be added to each of its siblings.
  // The Builder's "Related Product" list is for accessories on the spec sheet.
  let related: ProductVariant[] = [];
  if (variant.product_id) {
    const { data } = await supabase
      .from('product_variants')
      .select(PUBLIC_VARIANT_RELATED)
      .eq('product_id', variant.product_id)
      .eq('is_active', true)
      .neq('id', variant.id)
      .order('code');
    related = (data as unknown as ProductVariant[]) || [];
  }

  return (
    <VariantView
      variant={variant}
      relatedVariants={related}
    />
  );
}
