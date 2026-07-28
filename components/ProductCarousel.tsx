'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ProductVariant } from '@/lib/types';
import { ProductCard } from './ProductCard';

interface ProductCarouselProps {
  products: ProductVariant[];
  /** Hide Long SKU under the name (e.g. Related Variants). */
  hideSku?: boolean;
}

/**
 * Horizontal, arrow-driven product rail. Card widths match the ProductGrid
 * breakpoints (1 / 2 / 3 / 4 per view) so a long list scrolls sideways instead
 * of stacking into an endless column.
 */
export function ProductCarousel({ products, hideSku = false }: ProductCarouselProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  // Both true until measured, which keeps the arrows hidden on first paint.
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(true);

  const syncEdges = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
    setAtStart(el.scrollLeft <= 1);
    setAtEnd(el.scrollLeft >= maxScroll - 1);
  }, []);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    syncEdges();
    const observer = new ResizeObserver(syncEdges);
    observer.observe(el);
    return () => observer.disconnect();
  }, [syncEdges, products.length]);

  const scrollByView = (direction: -1 | 1) => {
    const el = trackRef.current;
    if (!el) return;
    // Just under a full view so the incoming card stays partly visible.
    el.scrollBy({ left: direction * el.clientWidth * 0.9, behavior: 'smooth' });
  };

  if (products.length === 0) return null;

  const hasOverflow = !atStart || !atEnd;

  const arrowCls =
    'absolute top-1/2 -translate-y-1/2 z-10 flex h-10 w-10 items-center justify-center ' +
    'rounded-full border border-gray-200 bg-white/95 text-gray-700 shadow-md backdrop-blur ' +
    'transition-opacity hover:bg-white hover:text-gray-900 ' +
    'disabled:pointer-events-none disabled:opacity-0';

  return (
    <div className="relative">
      {hasOverflow && (
        <button
          type="button"
          aria-label="Previous variants"
          onClick={() => scrollByView(-1)}
          disabled={atStart}
          className={`${arrowCls} -left-3 lg:-left-5`}
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
      )}

      <div
        ref={trackRef}
        onScroll={syncEdges}
        className="flex snap-x snap-mandatory gap-8 overflow-x-auto scroll-smooth pb-2 lg:gap-12 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {products.map((product) => (
          <div
            key={product.id}
            className="w-[80%] shrink-0 snap-start sm:w-[calc((100%_-_2rem)/2)] lg:w-[calc((100%_-_6rem)/3)] xl:w-[calc((100%_-_9rem)/4)]"
          >
            <ProductCard product={product} hideSku={hideSku} />
          </div>
        ))}
      </div>

      {hasOverflow && (
        <button
          type="button"
          aria-label="More variants"
          onClick={() => scrollByView(1)}
          disabled={atEnd}
          className={`${arrowCls} -right-3 lg:-right-5`}
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      )}
    </div>
  );
}
