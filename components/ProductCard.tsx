import Link from 'next/link';
import Image from 'next/image';
import { ProductVariant } from '@/lib/types';
import { formatCCT } from '@/lib/utils';
import { getLatestAssetUrl } from '@/lib/assets';
import { extractSkuColorCode } from '@/lib/sku/skuRules';

interface ProductCardProps {
  product: ProductVariant;
  hideSku?: boolean;
}

export function ProductCard({ product, hideSku = false }: ProductCardProps) {
  const imageUrl =
    getLatestAssetUrl(product.assets, 'image') || '/images/placeholder-product.jpg';
  const familySlug = (product as ProductVariant & { product?: { slug?: string } }).product?.slug;
  const href = familySlug
    ? `/products/${familySlug}/${product.slug}`
    : `/products/${product.slug}`;
  const colorCode = extractSkuColorCode(product.code, product.finish);

  return (
    <Link href={href} className="group block">
      <div className="space-y-3">
        {/* Image */}
        <div className="relative aspect-square bg-gray-100 overflow-hidden">
          <Image
            src={imageUrl}
            alt={product.name}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-500"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />

          {/* Tags overlay */}
          <div className="absolute top-3 left-3 flex flex-wrap gap-2">
            {product.is_featured && (
              <span className="px-2 py-1 text-xs uppercase tracking-wide bg-white text-gray-900">
                Featured
              </span>
            )}
          </div>
        </div>

        {/* Info — Name, optional Long SKU */}
        <div className="space-y-1">
          <h3 className="text-base font-medium text-gray-900 group-hover:text-brand-copper transition-colors">
            {product.name}
          </h3>
          {!hideSku && product.code ? (
            <p className="font-mono text-[11px] text-gray-400 break-all leading-snug">
              {product.code}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-600 pt-1">
            {product.beam_angle != null && (
              <span className="font-medium text-gray-900">{product.beam_angle}°</span>
            )}
            {colorCode ? (
              <span className="font-mono font-medium text-gray-900">{colorCode}</span>
            ) : null}
            {product.ip_rating && <span>{product.ip_rating}</span>}
            {(product.cct_min || product.cct_max) && (
              <span>{formatCCT(product.cct_min, product.cct_max)}</span>
            )}
            {(product.power_w_system || product.power_w) && (
              <span>{product.power_w_system ?? product.power_w}W</span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

