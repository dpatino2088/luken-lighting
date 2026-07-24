import Image from 'next/image';
import Link from 'next/link';
import { ChevronRight, Download } from 'lucide-react';
import { Container } from '@/components/ui/Container';
import { ProductGrid } from '@/components/ProductGrid';
import { ProductTabs } from '@/components/ProductTabs';
import { ProductVariant, ProductAsset } from '@/lib/types';
import { formatDimensions, formatCCT, formatCRI } from '@/lib/utils';
import { generateProductSchema } from '@/lib/seo';
import {
  CONTROL_LABELS,
  IMAGE_ASSET_TYPES,
  ASSET_TYPE_LABELS,
  ASSET_TYPE_ICONS,
} from './product-constants';
import { getLatestAssetUrl, sortAssetsNewestFirst } from '@/lib/assets';

/* ─── Variant detail view — web datasheet ─────────────────────────────────── */

export function VariantView({
  variant,
  relatedVariants,
}: {
  variant: any;
  relatedVariants: ProductVariant[];
}) {
  const allAssets: ProductAsset[] = variant.assets || [];
  const images = sortAssetsNewestFirst(allAssets.filter((a) => a.type === 'image'));
  const installedImages = sortAssetsNewestFirst(
    allAssets.filter((a) => a.type === 'installed_image'),
  );
  const dimensionsImages = sortAssetsNewestFirst(
    allAssets.filter((a) => a.type === 'dimensions_image'),
  );
  const photometricImages = sortAssetsNewestFirst(
    allAssets.filter((a) => a.type === 'photometric_image'),
  );
  const documents =
    variant.assets?.filter((a: ProductAsset) => !IMAGE_ASSET_TYPES.has(a.type)) || [];
  const mainImage =
    getLatestAssetUrl(variant.assets, 'image') || '/images/placeholder-product.jpg';

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
                    <Image
                      src={img.file_url}
                      alt={img.title || 'Photometric distribution'}
                      width={1200}
                      height={900}
                      sizes="(max-width: 1024px) 100vw, 33vw"
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
                    <Image
                      src={img.file_url}
                      alt={img.title || 'Product dimensions'}
                      width={1200}
                      height={900}
                      sizes="(max-width: 1024px) 100vw, 33vw"
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

function SpecRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <tr className="border-b border-gray-100 last:border-b-0 even:bg-gray-50/50">
      <td className="px-6 py-3.5 text-sm text-gray-500 w-1/3">{label}</td>
      <td className="px-6 py-3.5 text-sm font-medium text-gray-900">{value}</td>
    </tr>
  );
}
