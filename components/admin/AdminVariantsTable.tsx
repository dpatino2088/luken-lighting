'use client';

import { useState, useMemo, Fragment } from 'react';
import Link from 'next/link';
import { Search, Eye, Edit, ImageOff, ChevronLeft, ChevronRight } from 'lucide-react';
import { DeleteVariantButton } from './DeleteVariantButton';
import { calcMsrp, formatUsd } from '@/lib/pricing';

interface AssetSlim {
  id?: string;
  file_url: string;
  type: string;
  sort_order: number;
  created_at?: string;
}

interface VariantRow {
  id: string;
  name: string;
  slug: string;
  code: string;
  category_id: string | null;
  product_id: string | null;
  manufacturer: string | null;
  manufacturer_sku: string | null;
  cost_usd: number | null;
  distributor_price: number | null;
  is_active: boolean;
  is_featured: boolean;
  category?: { id: string; name: string } | null;
  product?: { id: string; name: string; slug: string } | null;
  assets?: AssetSlim[];
}

interface Props {
  variants: VariantRow[];
  categories: { id: string; name: string }[];
  products: { id: string; name: string }[];
}

function getFirstImage(assets?: AssetSlim[]): string | null {
  if (!assets || assets.length === 0) return null;
  // Prefer newest upload (re-uploads must not keep showing the first image).
  const images = assets
    .filter((a) => a.type === 'image' && a.file_url)
    .sort((a, b) => {
      const aT = a.created_at ? new Date(a.created_at).getTime() : 0;
      const bT = b.created_at ? new Date(b.created_at).getTime() : 0;
      if (bT !== aT) return bT - aT;
      return (b.sort_order ?? 0) - (a.sort_order ?? 0);
    });
  return images[0]?.file_url || null;
}

const PAGE_SIZES = [10, 50, 100] as const;

export function AdminVariantsTable({ variants, categories, products }: Props) {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [productFilter, setProductFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(50);

  const filtered = useMemo(() => {
    let list = variants;

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (v) =>
          v.name.toLowerCase().includes(q) ||
          v.code.toLowerCase().includes(q) ||
          (v.manufacturer && v.manufacturer.toLowerCase().includes(q)) ||
          (v.manufacturer_sku && v.manufacturer_sku.toLowerCase().includes(q))
      );
    }

    if (categoryFilter) {
      list = list.filter((v) => v.category_id === categoryFilter);
    }

    if (productFilter) {
      list = list.filter((v) => v.product_id === productFilter);
    }

    return list;
  }, [variants, search, categoryFilter, productFilter]);

  // Category display order (follows product_categories.sort_order); anything with
  // no / unknown category sinks to the bottom under "Uncategorized".
  const categoryRank = useMemo(() => {
    const m = new Map<string, number>();
    categories.forEach((c, i) => m.set(c.id, i));
    return m;
  }, [categories]);

  // Keep the list sub-categorized and alphabetical: group by category (in the
  // established order), then sort by name within each category so nothing is
  // mixed together.
  const sorted = useMemo(() => {
    const rank = (v: VariantRow) =>
      v.category_id && categoryRank.has(v.category_id)
        ? categoryRank.get(v.category_id)!
        : Number.MAX_SAFE_INTEGER;
    return [...filtered].sort((a, b) => {
      const ra = rank(a);
      const rb = rank(b);
      if (ra !== rb) return ra - rb;
      return (a.name || a.code || '').localeCompare(b.name || b.code || '');
    });
  }, [filtered, categoryRank]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const pageVariants = sorted.slice(start, start + pageSize);

  const handleSearchChange = (val: string) => {
    setSearch(val);
    setPage(1);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search name, SKU, manufacturer..."
            className="w-full pl-9 pr-3 py-2 text-xs border border-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 text-xs border border-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent bg-white"
        >
          <option value="">All Categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select
          value={productFilter}
          onChange={(e) => { setProductFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 text-xs border border-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent bg-white"
        >
          <option value="">All Products</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <span className="text-xs text-gray-500 ml-auto">
          {filtered.length} variant{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="bg-white border border-gray-200">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-2 py-2 w-12"></th>
                <th className="px-3 py-2 text-left text-[10px] font-medium uppercase tracking-wider text-gray-500">Variant</th>
                <th className="px-3 py-2 text-left text-[10px] font-medium uppercase tracking-wider text-gray-500">SKU</th>
                <th className="px-3 py-2 text-left text-[10px] font-medium uppercase tracking-wider text-gray-500">Manufacturer</th>
                <th className="px-3 py-2 text-left text-[10px] font-medium uppercase tracking-wider text-gray-500">Mfr. SKU</th>
                <th className="px-3 py-2 text-right text-[10px] font-medium uppercase tracking-wider text-gray-500">Cost</th>
                <th className="px-3 py-2 text-right text-[10px] font-medium uppercase tracking-wider text-gray-500">Dist.</th>
                <th className="px-3 py-2 text-right text-[10px] font-medium uppercase tracking-wider text-gray-500">MSRP</th>
                <th className="px-3 py-2 text-left text-[10px] font-medium uppercase tracking-wider text-gray-500">Status</th>
                <th className="px-3 py-2 w-24"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {pageVariants.map((variant, idx) => {
                const cost = variant.cost_usd ? Number(variant.cost_usd) : null;
                const dp = variant.distributor_price ? Number(variant.distributor_price) : null;
                const imgUrl = getFirstImage(variant.assets);
                const catName = variant.category?.name || 'Uncategorized';
                const prev = pageVariants[idx - 1];
                const prevCatName = prev ? prev.category?.name || 'Uncategorized' : null;
                const showHeader = catName !== prevCatName;

                return (
                  <Fragment key={variant.id}>
                  {showHeader && (
                    <tr className="bg-gray-50/70">
                      <td colSpan={10} className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-gray-500">
                        {catName}
                      </td>
                    </tr>
                  )}
                  <tr className="hover:bg-gray-50 transition-colors">
                    <td className="px-2 py-1.5">
                      {imgUrl ? (
                        <img src={imgUrl} alt="" className="w-10 h-10 object-cover border border-gray-200" />
                      ) : (
                        <div className="w-10 h-10 bg-gray-100 border border-gray-200 flex items-center justify-center">
                          <ImageOff className="w-3.5 h-3.5 text-gray-300" />
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-1.5">
                      <p className="text-xs font-medium text-gray-900 leading-tight">{variant.code}</p>
                      <p className="text-[10px] text-gray-400">{variant.category?.name || ''}</p>
                    </td>
                    <td className="px-3 py-1.5 text-xs text-gray-600 font-mono">{variant.code}</td>
                    <td className="px-3 py-1.5 text-xs text-gray-500">{variant.manufacturer || '—'}</td>
                    <td className="px-3 py-1.5 text-xs text-gray-500 font-mono">{variant.manufacturer_sku || '—'}</td>
                    <td className="px-3 py-1.5 text-xs text-gray-500 text-right tabular-nums">
                      {cost !== null ? formatUsd(cost) : '—'}
                    </td>
                    <td className="px-3 py-1.5 text-xs text-gray-500 text-right tabular-nums">
                      {dp !== null ? formatUsd(dp) : '—'}
                    </td>
                    <td className="px-3 py-1.5 text-xs text-gray-500 text-right tabular-nums">
                      {dp !== null ? formatUsd(calcMsrp(dp)) : '—'}
                    </td>
                    <td className="px-3 py-1.5">
                      <div className="flex items-center gap-1">
                        <span className={`inline-flex px-1.5 py-0.5 text-[10px] uppercase tracking-wide leading-tight ${variant.is_active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {variant.is_active ? 'Active' : 'Off'}
                        </span>
                        {variant.is_featured && (
                          <span className="inline-flex px-1.5 py-0.5 text-[10px] uppercase tracking-wide leading-tight bg-blue-50 text-blue-700">
                            Feat
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-1.5">
                      <div className="flex items-center justify-end gap-1">
                        <Link href={variant.product?.slug ? `/products/${variant.product.slug}/${variant.slug}` : '#'} target="_blank" className="p-1 text-gray-400 hover:text-gray-700" title="View on site">
                          <Eye className="w-3.5 h-3.5" />
                        </Link>
                        <Link href={`/admin/variants/${variant.id}`} className="p-1 text-gray-400 hover:text-gray-700" title="Edit">
                          <Edit className="w-3.5 h-3.5" />
                        </Link>
                        <DeleteVariantButton variantId={variant.id} variantName={variant.code} />
                      </div>
                    </td>
                  </tr>
                  </Fragment>
                );
              })}
            </tbody>
          </table>

          {pageVariants.length === 0 && (
            <div className="text-center py-12 text-xs text-gray-500">
              No variants match your filters.
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-gray-500">
        <div className="flex items-center gap-2">
          <span>Rows per page:</span>
          {PAGE_SIZES.map((size) => (
            <button
              key={size}
              onClick={() => { setPageSize(size); setPage(1); }}
              className={`px-2 py-1 border transition-colors ${pageSize === size ? 'border-gray-900 text-gray-900 font-medium' : 'border-gray-200 text-gray-500 hover:border-gray-400'}`}
            >
              {size}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <span>
            {filtered.length > 0
              ? `${start + 1}–${Math.min(start + pageSize, filtered.length)} of ${filtered.length}`
              : '0 variants'}
          </span>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage <= 1} className="p-1 border border-gray-200 text-gray-500 hover:border-gray-400 disabled:opacity-30 disabled:cursor-not-allowed">
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={safePage >= totalPages} className="p-1 border border-gray-200 text-gray-500 hover:border-gray-400 disabled:opacity-30 disabled:cursor-not-allowed">
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
