'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, Eye, Edit, Trash2, ImageOff, ChevronLeft, ChevronRight } from 'lucide-react';
import { deleteProduct } from '@/app/(admin)/admin/products/actions';
import { toast } from '@/components/ui/Toast';
import { confirmDialog } from '@/components/ui/ConfirmDialog';

interface ProductRow {
  id: string;
  name: string;
  slug: string;
  description: string;
  environment: 'indoor' | 'outdoor' | null;
  category_id: string | null;
  hero_image_url: string | null;
  thumbnail_url: string | null;
  sort_order: number;
}

interface Props {
  products: ProductRow[];
  categories: { id: string; name: string }[];
}

const PAGE_SIZES = [10, 50, 100] as const;

export function AdminProductsTable({ products, categories }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(50);

  const catMap = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);

  const filtered = useMemo(() => {
    let list = products;

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.slug.toLowerCase().includes(q) ||
          (p.description && p.description.toLowerCase().includes(q))
      );
    }

    if (categoryFilter) {
      list = list.filter((p) => p.category_id === categoryFilter);
    }

    return list;
  }, [products, search, categoryFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const pageProducts = filtered.slice(start, start + pageSize);

  const handleSearchChange = (val: string) => {
    setSearch(val);
    setPage(1);
  };

  const handleDelete = async (prod: ProductRow) => {
    const ok = await confirmDialog({
      title: 'Delete product',
      message: `Delete "${prod.name}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    const result = await deleteProduct(prod.id);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(`"${prod.name}" deleted.`);
      router.refresh();
    }
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
            placeholder="Search name, slug, description..."
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
        <span className="text-xs text-gray-500 ml-auto">
          {filtered.length} product{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="bg-white border border-gray-200">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-2 py-2 w-12"></th>
                <th className="px-3 py-2 text-left text-[10px] font-medium uppercase tracking-wider text-gray-500">Name</th>
                <th className="px-3 py-2 text-left text-[10px] font-medium uppercase tracking-wider text-gray-500">Category</th>
                <th className="px-3 py-2 text-left text-[10px] font-medium uppercase tracking-wider text-gray-500">Environment</th>
                <th className="px-3 py-2 text-left text-[10px] font-medium uppercase tracking-wider text-gray-500">Slug</th>
                <th className="px-3 py-2 text-left text-[10px] font-medium uppercase tracking-wider text-gray-500">Description</th>
                <th className="px-3 py-2 w-24"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {pageProducts.map((prod) => {
                const imgUrl = prod.thumbnail_url || prod.hero_image_url;

                return (
                  <tr key={prod.id} className="hover:bg-gray-50 transition-colors">
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
                      <p className="text-xs font-medium text-gray-900 leading-tight">{prod.name}</p>
                    </td>
                    <td className="px-3 py-1.5 text-xs text-gray-500">
                      {prod.category_id ? catMap.get(prod.category_id) || '—' : '—'}
                    </td>
                    <td className="px-3 py-1.5 text-xs text-gray-500 capitalize">
                      {prod.environment || '—'}
                    </td>
                    <td className="px-3 py-1.5 text-xs text-gray-500 font-mono">{prod.slug}</td>
                    <td className="px-3 py-1.5 text-xs text-gray-500 max-w-[200px] truncate">
                      {prod.description || '—'}
                    </td>
                    <td className="px-3 py-1.5">
                      <div className="flex items-center justify-end gap-1">
                        <Link href={`/products/${prod.slug}`} target="_blank" className="p-1 text-gray-400 hover:text-gray-700" title="View on site">
                          <Eye className="w-3.5 h-3.5" />
                        </Link>
                        <Link href={`/admin/products/${prod.id}`} className="p-1 text-gray-400 hover:text-gray-700" title="Edit">
                          <Edit className="w-3.5 h-3.5" />
                        </Link>
                        <button
                          onClick={() => handleDelete(prod)}
                          className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {pageProducts.length === 0 && (
            <div className="text-center py-12 text-xs text-gray-500">
              No products match your filters.
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
              : '0 products'}
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
