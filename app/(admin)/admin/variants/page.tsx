import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { Button } from '@/components/ui/Button';
import { Package } from 'lucide-react';
import { VariantsHeader } from '@/components/admin/VariantsHeader';
import { AdminVariantsTable } from '@/components/admin/AdminVariantsTable';

export default async function AdminVariantsPage() {
  const supabase = await createClient();

  if (!supabase) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-light tracking-widest uppercase mb-2">Variants</h1>
            <p className="text-gray-600">Manage product variants</p>
          </div>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 p-8">
          <h2 className="text-lg font-medium mb-4">Supabase Not Configured</h2>
          <p className="text-gray-700 mb-4">Please configure your Supabase credentials.</p>
        </div>
      </div>
    );
  }

  const [variantsRes, categoriesRes, productsRes] = await Promise.all([
    supabase
      .from('product_variants')
      .select(`*, category:product_categories(id, name), product:products(id, name, slug), assets:product_assets(id, file_url, type, sort_order, created_at)`)
      .order('code'),
    supabase.from('product_categories').select('id, name').order('sort_order'),
    supabase.from('products').select('id, name').order('name'),
  ]);

  const variants = variantsRes.data ?? [];
  const categories = categoriesRes.data ?? [];
  const products = productsRes.data ?? [];

  return (
    <div className="space-y-4">
      <VariantsHeader />

      {variants.length === 0 ? (
        <div className="bg-white border border-gray-200 text-center py-16">
          <Package className="w-12 h-12 mx-auto mb-4 text-gray-400" />
          <p className="text-gray-500 mb-4">No variants yet</p>
          <Link href="/admin/variants/new">
            <Button variant="primary">Create Your First Variant</Button>
          </Link>
        </div>
      ) : (
        <AdminVariantsTable
          variants={variants}
          categories={categories}
          products={products}
        />
      )}
    </div>
  );
}
