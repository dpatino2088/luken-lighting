import Link from 'next/link';
import { Plus, Package } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { Button } from '@/components/ui/Button';
import { AdminProductsTable } from '@/components/admin/AdminProductsTable';
import type { Product, ProductCategory } from '@/lib/types';

export default async function AdminProductsPage() {
  const supabase = await createClient();

  if (!supabase) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-light tracking-widest uppercase mb-2">
            Products
          </h1>
          <p className="text-gray-600">Manage products</p>
        </div>
        <div className="p-6 bg-yellow-50 border border-yellow-200 text-yellow-800">
          <p className="font-medium">Supabase not configured</p>
          <p className="text-sm mt-1">Configure your Supabase environment variables.</p>
        </div>
      </div>
    );
  }

  const [productsRes, categoriesRes] = await Promise.all([
    supabase.from('products').select('*').order('name'),
    supabase.from('product_categories').select('*').order('sort_order'),
  ]);

  const products = (productsRes.data ?? []) as Product[];
  const categories = (categoriesRes.data ?? []) as ProductCategory[];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-light tracking-widest uppercase mb-2">
            Products
          </h1>
          <p className="text-gray-600">Manage products</p>
        </div>
        <Link href="/admin/products/new">
          <Button variant="primary">
            <Plus className="w-4 h-4 mr-2" />
            Add Product
          </Button>
        </Link>
      </div>

      {products.length === 0 ? (
        <div className="bg-white border border-gray-200 text-center py-16">
          <Package className="w-12 h-12 mx-auto mb-4 text-gray-400" />
          <p className="text-gray-500 mb-4">No products yet</p>
          <Link href="/admin/products/new">
            <Button variant="primary">Create Your First Product</Button>
          </Link>
        </div>
      ) : (
        <AdminProductsTable
          products={products}
          categories={categories}
        />
      )}
    </div>
  );
}
