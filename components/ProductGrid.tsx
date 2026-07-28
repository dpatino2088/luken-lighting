import { ProductVariant } from '@/lib/types';
import { ProductCard } from './ProductCard';

interface ProductGridProps {
  products: ProductVariant[];
  /** Hide Long SKU under the name (e.g. Related Variants). */
  hideSku?: boolean;
}

export function ProductGrid({ products, hideSku = false }: ProductGridProps) {
  if (products.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-500">No products found matching your criteria.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8 lg:gap-12">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} hideSku={hideSku} />
      ))}
    </div>
  );
}

