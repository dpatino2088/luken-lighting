import { MetadataRoute } from 'next';
import { createClient } from '@/lib/supabase/server';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://lukenlighting.com';
  const supabase = await createClient();

  const staticPages = [
    '',
    '/products',
    '/inspiration',
    '/about',
    '/professionals',
    '/contact',
  ].map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: route === '' ? 1 : 0.8,
  }));

  if (!supabase) {
    return staticPages;
  }

  // Products
  const { data: products } = await supabase
    .from('products')
    .select('slug, updated_at')
    .eq('is_active', true);

  const productPages = (products || []).map((product) => ({
    url: `${baseUrl}/products/${product.slug}`,
    lastModified: new Date(product.updated_at),
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }));

  // Product variants
  const { data: variants } = await supabase
    .from('product_variants')
    .select('slug, updated_at, product:products!inner(slug)')
    .eq('is_active', true)
    .eq('product.is_active', true);

  const variantPages = (variants || []).map((variant: any) => ({
    url: `${baseUrl}/products/${variant.product.slug}/${variant.slug}`,
    lastModified: new Date(variant.updated_at),
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }));

  // Inspiration projects
  const { data: projects } = await supabase
    .from('inspiration_projects')
    .select('slug, updated_at');

  const projectPages = (projects || []).map((project) => ({
    url: `${baseUrl}/inspiration/${project.slug}`,
    lastModified: new Date(project.updated_at),
    changeFrequency: 'monthly' as const,
    priority: 0.6,
  }));

  return [
    ...staticPages,
    ...productPages,
    ...variantPages,
    ...projectPages,
  ];
}
