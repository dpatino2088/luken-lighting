import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Container } from '@/components/ui/Container';
import { Button } from '@/components/ui/Button';
import { ProductGrid } from '@/components/ProductGrid';
import { VariantsTable } from '@/components/VariantsTable';
import { ProductTabs } from '@/components/ProductTabs';
import { FilterDropdown } from '@/components/FilterDropdown';
import { createClient } from '@/lib/supabase/server';
import { ProductVariant, ProductAsset, ProductSku } from '@/lib/types';
import { formatDimensions, formatCCT, formatCRI } from '@/lib/utils';
import { generateMetadata as genMeta, generateProductSchema } from '@/lib/seo';
import {
  Download,
  FileText,
  Shield,
  Zap,
  Lightbulb,
  RotateCw,
  ChevronRight,
  BookOpen,
  FileSpreadsheet,
  Box,
  Ruler,
} from 'lucide-react';

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

    return (
      <ProductView
        product={product}
        variants={(variants as ProductVariant[]) || []}
        filterOptic={filters.optic}
        filterK={filters.k}
        filterCri={filters.cri}
        filterControl={filters.control}
      />
    );
  }

  notFound();
}

/* ─── Helpers ───────────────────────────────────────────────────────────────── */

const CONTROL_LABELS: Record<string, string> = {
  'on-off': 'On/Off',
  phase: 'Phase Cut',
  dali: 'DALI',
  '0-10v': '0-10V',
  '1-10v': '1-10V',
  casambi: 'Casambi',
  zigbee: 'Zigbee',
  dmx: 'DMX512',
  push: 'Push-dim',
};

const IMAGE_ASSET_TYPES = new Set(['image', 'installed_image', 'dimensions_image', 'photometric_image']);

const ASSET_TYPE_LABELS: Record<string, string> = {
  datasheet: 'Datasheet',
  photometric: 'Photometric Data',
  photometric_image: 'Photometric Curve',
  installed_image: 'Installed',
  dimensions_image: 'Dimensions',
  manual: 'Installation Manual',
  catalogue: 'Catalogue',
  line_drawing: 'Line Drawing',
  revit: 'Revit Model',
  '3d': '3D Model',
  other: 'Document',
};

const ASSET_TYPE_ICONS: Record<string, typeof FileText> = {
  datasheet: FileText,
  photometric: FileSpreadsheet,
  manual: BookOpen,
  line_drawing: Ruler,
  catalogue: BookOpen,
  revit: Box,
  '3d': Box,
  other: Download,
};

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
              <img
                src={product.hero_image_url}
                alt={product.name}
                className="w-full h-full object-cover"
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


/* ─── Variant detail view — web datasheet ─────────────────────────────────── */

export function VariantView({
  variant,
  relatedVariants,
}: {
  variant: any;
  relatedVariants: ProductVariant[];
}) {
  const images =
    variant.assets?.filter((a: ProductAsset) => a.type === 'image') || [];
  const installedImages =
    variant.assets?.filter((a: ProductAsset) => a.type === 'installed_image') || [];
  const dimensionsImages =
    variant.assets?.filter((a: ProductAsset) => a.type === 'dimensions_image') || [];
  const photometricImages =
    variant.assets?.filter((a: ProductAsset) => a.type === 'photometric_image') || [];
  const documents =
    variant.assets?.filter((a: ProductAsset) => !IMAGE_ASSET_TYPES.has(a.type)) || [];
  const mainImage = images[0]?.file_url || '/images/placeholder-product.jpg';

  const documentsByType = documents.reduce(
    (acc: Record<string, ProductAsset[]>, doc: ProductAsset) => {
      const type = doc.type;
      if (!acc[type]) acc[type] = [];
      acc[type].push(doc);
      return acc;
    },
    {} as Record<string, ProductAsset[]>
  );

  const productName = variant.product?.name || '';
  const categoryName = variant.category?.name || '';
  const efficacySrc = variant.efficacy_lm_per_w ? `${variant.efficacy_lm_per_w} lm/W` : null;
  const efficacySys = variant.lumens_system && variant.power_w_system
    ? `${(variant.lumens_system / variant.power_w_system).toFixed(1)} lm/W`
    : null;

  /* ── Tab 1: Technical Specs ─────────────────────────────────────────────── */
  const specsContent = (
    <div className="space-y-10">
      {/* Two-column: specs table + photometric image */}
      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 border border-gray-200 overflow-x-auto">
          <table className="w-full min-w-[380px]">
            <tbody>
              <SpecRow label="Mounting Type" value={variant.mounting_type} />
              <SpecRow label="Beam Angle" value={variant.beam_angle ? `${variant.beam_angle}°` : null} />
              <SpecRow label="Light Source" value={variant.light_source} />
              <SpecRow label="Power Source" value={variant.power_w ? `${variant.power_w}W` : null} />
              <SpecRow label="Power System" value={variant.power_w_system ? `${variant.power_w_system}W` : null} />
              <SpecRow label="Lumens Source" value={variant.lumens ? `${variant.lumens}lm` : null} />
              <SpecRow label="Lumens System" value={variant.lumens_system ? `${variant.lumens_system}lm` : null} />
              <SpecRow label="Efficacy Source" value={efficacySrc} />
              <SpecRow label="Efficacy System" value={efficacySys} />
              <SpecRow
                label="Color Temperature"
                value={variant.cct_min || variant.cct_max ? formatCCT(variant.cct_min, variant.cct_max) : null}
              />
              <SpecRow label="CRI" value={formatCRI(variant.cri)} />
              <SpecRow
                label="Control"
                value={
                  variant.control_types && variant.control_types.length > 0
                    ? variant.control_types.map((ct: string) => CONTROL_LABELS[ct] || ct).join(', ')
                    : null
                }
              />
              <SpecRow label="Voltage" value={variant.voltage} />
              <SpecRow label="IP Rating" value={variant.ip_rating} />
              <SpecRow label="Electrical Class" value={variant.class} />
              <SpecRow label="Material" value={variant.material} />
              <SpecRow label="Finish" value={variant.finish} />
              <SpecRow label="Dimensions" value={variant.dimensions ? formatDimensions(variant.dimensions) : null} />
            </tbody>
          </table>
        </div>

        {(photometricImages.length > 0 || dimensionsImages.length > 0) && (
          <div className="space-y-6">
            {photometricImages.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-widest text-gray-400">
                  Photometric Distribution
                </h4>
                {photometricImages.map((img: ProductAsset) => (
                  <div key={img.id} className="border border-gray-200 bg-white p-4">
                    <img
                      src={img.file_url}
                      alt={img.title || 'Photometric distribution'}
                      className="w-full h-auto"
                    />
                  </div>
                ))}
              </div>
            )}
            {dimensionsImages.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-widest text-gray-400">
                  Dimensions
                </h4>
                {dimensionsImages.map((img: ProductAsset) => (
                  <div key={img.id} className="border border-gray-200 bg-white p-4">
                    <img
                      src={img.file_url}
                      alt={img.title || 'Product dimensions'}
                      className="w-full h-auto"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  /* ── Tab 2: Downloads ───────────────────────────────────────────────────── */
  const downloadsContent =
    documents.length > 0 ? (
      <div className="space-y-8">
        {Object.entries(documentsByType).map(([type, docs]) => {
          const Icon = ASSET_TYPE_ICONS[type] || Download;
          return (
            <div key={type}>
              <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-4">
                {ASSET_TYPE_LABELS[type] || type}
              </h3>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {(docs as ProductAsset[]).map((doc) => (
                  <a
                    key={doc.id}
                    href={doc.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-4 p-4 border border-gray-200 hover:border-gray-900 hover:bg-gray-50 transition-all group"
                  >
                    <div className="w-10 h-10 bg-gray-100 flex items-center justify-center flex-shrink-0 group-hover:bg-gray-200 transition-colors">
                      <Icon className="w-5 h-5 text-gray-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{doc.title}</p>
                      <p className="text-xs text-gray-500 uppercase mt-0.5">
                        {doc.file_extension}
                      </p>
                    </div>
                    <Download className="w-4 h-4 text-gray-400 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </a>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    ) : null;

  const tabs = [
    { id: 'specs', label: 'Technical Specs', content: specsContent },
    {
      id: 'downloads',
      label: 'Downloads',
      content: downloadsContent || (
        <p className="text-sm text-gray-500 py-8 text-center">No files available for download yet.</p>
      ),
    },
  ];

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
          {variant.product && (
            <>
              <ChevronRight className="h-3.5 w-3.5 flex-shrink-0" />
              <Link
                href={`/products/${variant.product.slug}`}
                className="hover:text-gray-900 transition-colors flex-shrink-0"
              >
                {variant.product.name}
              </Link>
            </>
          )}
          <ChevronRight className="h-3.5 w-3.5 flex-shrink-0" />
          <span className="text-gray-900 flex-shrink-0">{variant.code}</span>
        </nav>

        {/* ── Datasheet header ─────────────────────────────────────────────── */}
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 mb-12">
          {/* Product images */}
          <div className="space-y-3">
            <div className="aspect-[4/3] bg-gray-100 relative overflow-hidden">
              <Image
                src={mainImage}
                alt={variant.code}
                fill
                className="object-cover"
                priority
                sizes="(max-width: 768px) 100vw, 50vw"
              />
            </div>
            {(images.length > 1 || installedImages.length > 0) && (
              <div className="grid grid-cols-4 gap-3">
                {[...images.slice(1), ...installedImages].slice(0, 4).map((image: ProductAsset) => (
                  <div key={image.id} className="aspect-square bg-gray-100 relative overflow-hidden border border-gray-200">
                    <Image
                      src={image.file_url}
                      alt={image.title}
                      fill
                      className="object-cover"
                      sizes="25vw"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Info panel */}
          <div className="flex flex-col justify-center">
            {/* Product family + category */}
            <div className="flex flex-wrap items-center gap-2 mb-3">
              {productName && (
                <Link
                  href={`/products/${variant.product?.slug}`}
                  className="text-xs uppercase tracking-widest text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {productName}
                </Link>
              )}
              {productName && categoryName && (
                <span className="text-gray-300">·</span>
              )}
              {categoryName && (
                <span className="text-xs uppercase tracking-widest text-gray-400">
                  {categoryName}
                </span>
              )}
            </div>

            {/* Code as main title */}
            <h1 className="text-3xl lg:text-4xl font-light tracking-widest uppercase mb-6">
              {variant.code}
            </h1>

            {/* Tags */}
            <div className="flex flex-wrap gap-2 mb-6">
              {variant.ip_rating && (
                <span className="px-3 py-1.5 text-xs uppercase tracking-wide border border-gray-200 bg-gray-50 text-gray-700 font-medium">
                  {variant.ip_rating}
                </span>
              )}
              {variant.class && (
                <span className="px-3 py-1.5 text-xs uppercase tracking-wide border border-gray-200 bg-gray-50 text-gray-700 font-medium">
                  {variant.class}
                </span>
              )}
              {variant.mounting_type && (
                <span className="px-3 py-1.5 text-xs uppercase tracking-wide border border-gray-200 bg-gray-50 text-gray-700 font-medium capitalize">
                  {variant.mounting_type}
                </span>
              )}
              {variant.voltage && (
                <span className="px-3 py-1.5 text-xs uppercase tracking-wide border border-gray-200 bg-gray-50 text-gray-700 font-medium">
                  {variant.voltage}
                </span>
              )}
            </div>

            {/* Overview — family description (detailed specs live in the tab below) */}
            {variant.product?.description && (
              <div>
                <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-4">
                  Overview
                </h2>
                <div className="space-y-2">
                  {variant.product.description
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

          </div>
        </div>

        {/* ── Tabs: Technical Specs / Downloads ────────────────────────────── */}
        {tabs.length > 0 && (
          <div className="mb-16">
            <ProductTabs tabs={tabs} />
          </div>
        )}

        {/* Related products */}
        {relatedVariants.length > 0 && (
          <section>
            <h2 className="text-2xl font-light tracking-wide uppercase mb-6">
              Related Products
            </h2>
            <ProductGrid products={relatedVariants} />
          </section>
        )}

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(
              generateProductSchema({
                name: variant.code,
                description: `${variant.code} - ${productName}`,
                code: variant.code,
              })
            ),
          }}
        />
      </Container>
    </div>
  );
}

/* ─── Shared sub-components ────────────────────────────────────────────────── */

function SpecCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Zap;
  label: string;
  value: string;
}) {
  return (
    <div className="p-4 bg-gray-50 border border-gray-100">
      <div className="flex items-center gap-2 mb-1.5">
        <Icon className="h-4 w-4 text-gray-400" />
        <span className="text-xs text-gray-500 uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-sm font-medium text-gray-900">{value}</p>
    </div>
  );
}

function SpecRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <tr className="border-b border-gray-100 last:border-b-0 even:bg-gray-50/50">
      <td className="px-6 py-3.5 text-sm text-gray-500 w-1/3">{label}</td>
      <td className="px-6 py-3.5 text-sm font-medium text-gray-900">{value}</td>
    </tr>
  );
}
