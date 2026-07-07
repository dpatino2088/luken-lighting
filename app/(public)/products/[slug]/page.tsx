import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Container } from '@/components/ui/Container';
import { VariantsTable } from '@/components/VariantsTable';
import { FilterDropdown } from '@/components/FilterDropdown';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { ProductVariant } from '@/lib/types';
import { buildSku } from '@/lib/sku/skuRules';
import { formatCCT, formatCRI } from '@/lib/utils';
import { generateMetadata as genMeta } from '@/lib/seo';
import { Shield, Lightbulb, ChevronRight } from 'lucide-react';
import { CONTROL_LABELS } from './product-constants';

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ optic?: string; k?: string; cri?: string; control?: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  const supabase = await createClient();
  if (!supabase) return genMeta({ title: 'Not Found' });

  const { data: product } = await supabase
    .from('products')
    .select('name, description')
    .eq('slug', slug)
    .single();

  if (product) {
    return genMeta({
      title: product.name,
      description: product.description,
      path: `/products/${slug}`,
    });
  }

  return genMeta({ title: 'Not Found' });
}

export default async function ProductPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const filters = searchParams ? await searchParams : {};
  const supabase = await createClient();
  if (!supabase) notFound();

  const { data: product } = await supabase
    .from('products')
    .select('*, category:product_categories(*)')
    .eq('slug', slug)
    .single();

  if (product) {
    const { data: variants } = await supabase
      .from('product_variants')
      .select(`*, category:product_categories(*), product:products(*), assets:product_assets(*)`)
      .eq('product_id', product.id)
      .eq('is_active', true)
      .order('name');

    const variantList = (variants as ProductVariant[]) || [];

    // Public "Product Codes" shows the LONG SKU (all segments) so the code alone
    // identifies the product. The long code lives in the spec sheet SKU state
    // (spec_sheets.data.sku); we compute it here and fall back to the stored
    // short `code` for legacy variants that have no spec sheet yet.
    // spec_sheets is RLS-restricted to authenticated users, so we read it with
    // the server-only admin client and expose ONLY the derived long code.
    const ids = variantList.map((v) => v.id);
    const latestSheet = new Map<string, any>();
    const sheetReader = createAdminClient() ?? supabase;
    if (ids.length > 0) {
      const { data: sheets } = await sheetReader
        .from('spec_sheets')
        .select('variant_id, data, updated_at')
        .in('variant_id', ids)
        .is('deleted_at', null);
      for (const s of sheets || []) {
        const prev = latestSheet.get(s.variant_id);
        if (!prev || new Date(s.updated_at) > new Date(prev.updated_at)) {
          latestSheet.set(s.variant_id, s);
        }
      }
    }
    const enriched = variantList.map((v) => {
      const sku = latestSheet.get(v.id)?.data?.sku;
      let full_code = v.code;
      if (sku) {
        const r = buildSku(sku);
        if (r.longCode) full_code = r.longCode;
      }
      return { ...v, full_code };
    });

    return (
      <ProductView
        product={product}
        variants={enriched}
        filterOptic={filters.optic}
        filterK={filters.k}
        filterCri={filters.cri}
        filterControl={filters.control}
      />
    );
  }

  notFound();
}

/* ─── Product view (iGuzzini-style) ────────────────────────────────────────── */

function ProductView({
  product,
  variants,
  filterOptic,
  filterK,
  filterCri,
  filterControl,
}: {
  product: any;
  variants: ProductVariant[];
  filterOptic?: string;
  filterK?: string;
  filterCri?: string;
  filterControl?: string;
}) {
  const baseUrl = `/products/${product.slug}`;
  const currentFilters = { optic: filterOptic, k: filterK, cri: filterCri, control: filterControl };

  const getCctLabel = (v: ProductVariant) =>
    (v.cct_min || v.cct_max) ? formatCCT(v.cct_min, v.cct_max) : null;
  const getCriLabel = (v: ProductVariant) =>
    v.cri ? formatCRI(v.cri) : null;

  const getBeamLabel = (v: ProductVariant) =>
    v.beam_angle ? `${v.beam_angle}°` : null;

  const filtered = variants.filter((v) => {
    if (filterOptic && getBeamLabel(v) !== filterOptic) return false;
    if (filterK && getCctLabel(v) !== filterK) return false;
    if (filterCri && getCriLabel(v) !== filterCri) return false;
    if (filterControl && !(v.control_types && v.control_types.includes(filterControl))) return false;
    return true;
  });

  const uniqueOptic = [...new Set(variants.map((v) => getBeamLabel(v)).filter(Boolean))] as string[];
  const uniqueK = [...new Set(variants.map((v) => getCctLabel(v)).filter(Boolean))] as string[];
  const uniqueCri = [...new Set(variants.map((v) => getCriLabel(v)).filter(Boolean))] as string[];
  const uniqueControl = [...new Set(variants.flatMap((v) => v.control_types || []))].filter(Boolean).sort();

  const categoryName = product.category?.name || null;

  return (
    <div className="py-8 lg:py-12">
      <Container>
        {/* Breadcrumb */}
        <nav className="mb-8 flex items-center gap-1.5 text-sm text-gray-500 overflow-x-auto whitespace-nowrap pb-2 -mb-2 lg:pb-0 lg:mb-8">
          <Link href="/" className="hover:text-gray-900 transition-colors flex-shrink-0">
            Home
          </Link>
          <ChevronRight className="h-3.5 w-3.5 flex-shrink-0" />
          <Link href="/products" className="hover:text-gray-900 transition-colors flex-shrink-0">
            Products
          </Link>
          <ChevronRight className="h-3.5 w-3.5 flex-shrink-0" />
          <span className="text-gray-900 flex-shrink-0">{product.name}</span>
        </nav>

        {/* Hero: two-column layout */}
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 mb-16">
          {/* Product image */}
          <div className="aspect-[4/3] bg-gray-100 relative overflow-hidden">
            {product.hero_image_url ? (
              <Image
                src={product.hero_image_url}
                alt={product.name}
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-100 flex items-center justify-center">
                <Lightbulb className="h-16 w-16 text-gray-300" />
              </div>
            )}
          </div>

          {/* Product info */}
          <div className="flex flex-col justify-center">
            <h1 className="text-3xl lg:text-4xl font-light tracking-widest uppercase mb-6">
              {product.name}
            </h1>

            {/* Overview */}
            {product.description && (
              <div className="mb-8">
                <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-4">
                  Overview
                </h2>
                <div className="space-y-2">
                  {product.description
                    .split('\n')
                    .filter((line: string) => line.trim())
                    .map((line: string, i: number) => (
                      <div key={i} className="flex gap-3 text-sm text-gray-600 leading-relaxed">
                        <span className="text-gray-300 mt-1 flex-shrink-0">•</span>
                        <span>{line.trim()}</span>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Product details */}
            {(categoryName || product.environment) && (
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">
                  Specifications
                </h3>
                <div className="flex flex-wrap gap-3">
                  {categoryName && (
                    <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-100">
                      <Lightbulb className="h-4 w-4 text-gray-500" />
                      <span className="text-sm text-gray-700">{categoryName}</span>
                    </div>
                  )}
                  {product.environment && (
                    <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-100">
                      <Shield className="h-4 w-4 text-gray-500" />
                      <span className="text-sm text-gray-700 capitalize">{product.environment}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Product codes section */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-light tracking-wide uppercase">Product Codes</h2>
            <span className="text-sm text-gray-500">
              {filtered.length} variant{filtered.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Filters — always visible */}
          <div className="mb-6 bg-gray-50 border border-gray-200 rounded-lg px-6 py-5">
            <div className="flex flex-wrap items-center gap-4">
              <span className="text-sm text-gray-500 mr-2">Filter codes by:</span>
              <FilterDropdown
                label="Optic"
                options={uniqueOptic}
                current={currentFilters.optic}
                baseUrl={baseUrl}
                filterKey="optic"
                allFilters={currentFilters}
              />
              <FilterDropdown
                label="K"
                options={uniqueK}
                current={currentFilters.k}
                baseUrl={baseUrl}
                filterKey="k"
                allFilters={currentFilters}
              />
              <FilterDropdown
                label="CRI"
                options={uniqueCri}
                current={currentFilters.cri}
                baseUrl={baseUrl}
                filterKey="cri"
                allFilters={currentFilters}
              />
              <FilterDropdown
                label="Control"
                options={uniqueControl.map((c) => CONTROL_LABELS[c] || c)}
                values={uniqueControl}
                current={currentFilters.control}
                baseUrl={baseUrl}
                filterKey="control"
                allFilters={currentFilters}
              />
            </div>
          </div>

          {filtered.length > 0 ? (
            <VariantsTable variants={filtered} productSlug={product.slug} />
          ) : (
            <div className="text-center py-12 border border-gray-200">
              <p className="text-gray-500">
                {variants.length > 0
                  ? 'No variants match the selected filters.'
                  : 'No variants in this product yet.'}
              </p>
            </div>
          )}
        </section>
      </Container>
    </div>
  );
}



