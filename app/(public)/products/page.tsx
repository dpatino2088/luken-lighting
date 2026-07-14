import Link from 'next/link';
import Image from 'next/image';
import { Suspense } from 'react';
import { Container } from '@/components/ui/Container';
import { ProductSidebar } from '@/components/ProductSidebar';
import { createClient } from '@/lib/supabase/server';
import { Product, ProductCategory } from '@/lib/types';
import { generateMetadata as genMeta } from '@/lib/seo';

export const metadata = genMeta({
  title: 'Products',
  description: 'Browse our complete range of architectural lighting products — minimal fixtures designed to integrate invisibly into any space.',
  path: '/products',
});

interface ProductsPageProps {
  searchParams: Promise<{
    category?: string;
    environment?: 'indoor' | 'outdoor';
    search?: string;
  }>;
}

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const params = await searchParams;
  const supabase = await createClient();

  if (!supabase) {
    return (
      <div className="py-12 lg:py-16">
        <Container>
          <div className="mb-12">
            <h1 className="text-4xl lg:text-5xl font-light tracking-widest uppercase mb-4">
              Products
            </h1>
            <p className="text-gray-600 max-w-2xl">
              Architectural lighting with clean, minimal lines — designed to let the space shine
            </p>
          </div>
          <div className="bg-blue-50 border border-blue-200 p-8 text-center">
            <h3 className="text-lg font-medium mb-2">Supabase Not Configured</h3>
            <p className="text-gray-600 mb-4">
              Please configure your Supabase credentials in <code className="bg-white px-2 py-1 rounded">.env.local</code> to view products.
            </p>
          </div>
        </Container>
      </div>
    );
  }

  const [categoriesRes, productsRes] = await Promise.all([
    supabase.from('product_categories').select('*').order('sort_order'),
    supabase.from('products').select('*').order('sort_order'),
  ]);

  const categories = (categoriesRes.data ?? []) as ProductCategory[];
  const allProducts = (productsRes.data ?? []) as Product[];

  const activeCategory = params.category
    ? categories.find((c) => c.slug === params.category) ?? null
    : null;
  const activeEnvironment = params.environment || '';

  let displayProducts = allProducts;

  if (activeEnvironment) {
    displayProducts = displayProducts.filter((p) => p.environment === activeEnvironment);
  }

  if (activeCategory) {
    displayProducts = displayProducts.filter((p) => p.category_id === activeCategory.id);
  }

  if (params.search) {
    const q = params.search.toLowerCase();
    displayProducts = displayProducts.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.description && p.description.toLowerCase().includes(q))
    );
  }

  // Always keep a fixed order by system/category (as defined by
  // product_categories.sort_order — e.g. Downlights first, then the next, ...),
  // never by product insertion order. Within a category: product sort_order,
  // then name. Products with no category go last.
  const categoryOrder = new Map(categories.map((c, i) => [c.id, i]));
  const catRank = (id: string | null | undefined) =>
    id != null && categoryOrder.has(id) ? categoryOrder.get(id)! : Number.MAX_SAFE_INTEGER;
  displayProducts = [...displayProducts].sort((a, b) => {
    const ca = catRank(a.category_id);
    const cb = catRank(b.category_id);
    if (ca !== cb) return ca - cb;
    const sa = a.sort_order ?? 0;
    const sb = b.sort_order ?? 0;
    if (sa !== sb) return sa - sb;
    return a.name.localeCompare(b.name);
  });

  // Group the (already ordered) products by category so the grid renders in
  // subtle sections: Downlights, then a gap, then Spotlights, and so on —
  // always following product_categories.sort_order.
  const productGroups: { key: string; name: string | null; products: Product[] }[] = [];
  for (const cat of categories) {
    const items = displayProducts.filter((p) => p.category_id === cat.id);
    if (items.length > 0) productGroups.push({ key: cat.id, name: cat.name, products: items });
  }
  const uncategorized = displayProducts.filter(
    (p) => !p.category_id || !categoryOrder.has(p.category_id)
  );
  if (uncategorized.length > 0) {
    productGroups.push({ key: 'uncategorized', name: null, products: uncategorized });
  }
  const showGroupHeaders = productGroups.length > 1;

  const categoriesWithCount = categories.map((cat) => ({
    ...cat,
    productCount: allProducts.filter((p) => p.category_id === cat.id).length,
  }));
  const environmentsWithCount = [
    {
      value: 'indoor' as const,
      label: 'Indoor',
      count: allProducts.filter((p) => p.environment === 'indoor').length,
    },
    {
      value: 'outdoor' as const,
      label: 'Outdoor',
      count: allProducts.filter((p) => p.environment === 'outdoor').length,
    },
  ];

  return (
    <div className="py-12 lg:py-16">
      <Container>
        <div className="mb-10">
          <h1 className="text-4xl lg:text-5xl font-light tracking-widest uppercase mb-4">
            Products
          </h1>
          <p className="text-gray-600 max-w-2xl">
            Architectural lighting with clean, minimal lines — designed to let the space shine
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-0">
          {/* Sidebar: shows filter button on mobile, full sidebar on desktop */}
          <Suspense>
            <ProductSidebar
              categories={categoriesWithCount}
              totalProducts={allProducts.length}
              environments={environmentsWithCount}
            />
          </Suspense>

          {/* Product grid */}
          <div className="flex-1 min-w-0">
            {/* Results count */}
            <div className="mb-6 flex items-center justify-between">
              <p className="text-sm text-gray-500">
                {displayProducts.length} product{displayProducts.length !== 1 ? 's' : ''}
                {activeEnvironment && (
                  <> in <span className="text-gray-900 font-medium capitalize">{activeEnvironment}</span></>
                )}
                {activeCategory && (
                  <> in <span className="text-gray-900 font-medium">{activeCategory.name}</span></>
                )}
              </p>
            </div>

            {displayProducts.length > 0 ? (
              <div className="space-y-16">
                {productGroups.map((group) => (
                  <section key={group.key}>
                    {showGroupHeaders && (
                      <div className="mb-6 flex items-center gap-4">
                        <h2 className="text-xs font-medium tracking-[0.25em] uppercase text-gray-400 whitespace-nowrap">
                          {group.name ?? 'Other'}
                        </h2>
                        <span className="h-px flex-1 bg-gray-200" />
                      </div>
                    )}
                    <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-8">
                      {group.products.map((product) => (
                        <Link
                          key={product.id}
                          href={`/products/${product.slug}`}
                          className="group"
                        >
                          <div className="space-y-4">
                            <div className="relative aspect-[4/3] bg-gray-100 overflow-hidden">
                              {(product.thumbnail_url || product.hero_image_url) ? (
                                <Image
                                  src={product.thumbnail_url || product.hero_image_url!}
                                  alt={product.name}
                                  fill
                                  sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
                                  className="object-cover group-hover:scale-105 transition-transform duration-500"
                                />
                              ) : (
                                <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-100 group-hover:scale-105 transition-transform duration-500" />
                              )}
                            </div>
                            <div>
                              <h2 className="text-lg font-medium tracking-wide uppercase group-hover:text-brand-copper transition-colors">
                                {product.name}
                              </h2>
                              <p className="text-sm text-gray-600 mt-1 leading-relaxed line-clamp-2">
                                {product.description}
                              </p>
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            ) : (
              <div className="text-center py-16">
                <p className="text-gray-500">
                  {params.search
                    ? 'No products match your search.'
                    : activeCategory && activeEnvironment
                      ? `No products found in ${activeEnvironment} / ${activeCategory.name}.`
                      : activeCategory
                        ? `No products found in ${activeCategory.name}.`
                        : activeEnvironment
                          ? `No products found in ${activeEnvironment}.`
                          : 'No products available yet.'}
                </p>
              </div>
            )}
          </div>
        </div>
      </Container>
    </div>
  );
}
