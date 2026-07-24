import Link from 'next/link';
import Image from 'next/image';
import { ProductVariant } from '@/lib/types';
import { formatCCT } from '@/lib/utils';
import { getLatestAssetUrl } from '@/lib/assets';

interface ProductCardProps {
  product: ProductVariant;
}

export function ProductCard({ product }: ProductCardProps) {
  const imageUrl =
    getLatestAssetUrl(product.assets, 'image') || '/images/placeholder-product.jpg';

  return (
    <Link 
      href={`/products/${product.slug}`}
      className="group block"
    >
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

        {/* Info */}
        <div className="space-y-1">
          <h3 className="text-base font-medium text-gray-900 group-hover:text-brand-copper transition-colors">
            {product.name}
          </h3>
          <p className="text-sm text-gray-500 uppercase tracking-wide">
            {product.code}
          </p>
          
          {/* Technical specs */}
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-600 pt-1">
            {product.ip_rating && (
              <span>{product.ip_rating}</span>
            )}
            {(product.cct_min || product.cct_max) && (
              <span>{formatCCT(product.cct_min, product.cct_max)}</span>
            )}
            {(product.power_w_system || product.power_w) && (
              <span>{product.power_w_system ?? product.power_w}W</span>
            )}
            {(product.lumens_system || product.lumens) && (
              <span>{product.lumens_system ?? product.lumens}lm</span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

