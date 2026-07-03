'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { ArrowLeft, Upload, Trash2, ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { updateProduct } from '@/app/(admin)/admin/products/actions';
import { createClient } from '@/lib/supabase/client';
import { slugify } from '@/lib/utils';
import { toast } from '@/components/ui/Toast';
import type { Product, ProductCategory } from '@/lib/types';

interface Props {
  product: Product;
  categories: ProductCategory[];
}

function ImageUploadSlot({
  label,
  hint,
  currentUrl,
  onUrlChange,
  productId,
  imageKey,
}: {
  label: string;
  hint: string;
  currentUrl: string;
  onUrlChange: (url: string) => void;
  productId: string;
  imageKey: string;
}) {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (file: File) => {
    setUploading(true);

    try {
      const supabase = createClient();
      if (!supabase) throw new Error('Supabase not configured');

      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const timestamp = Date.now();
      const filePath = `families/${productId}/${imageKey}-${timestamp}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw new Error(uploadError.message);

      const { data: urlData } = supabase.storage
        .from('product-images')
        .getPublicUrl(filePath);

      onUrlChange(urlData.publicUrl);
    } catch (err: any) {
      toast.error(err.message || 'Upload failed');
    }
    setUploading(false);
  };

  const handleDelete = async () => {
    if (!currentUrl) return;

    try {
      const supabase = createClient();
      if (!supabase) return;

      if (currentUrl.includes('/storage/v1/object/public/product-images/')) {
        const pathParts = currentUrl.split('/storage/v1/object/public/product-images/');
        if (pathParts[1]) {
          await supabase.storage.from('product-images').remove([decodeURIComponent(pathParts[1])]);
        }
      }
    } catch {
      // Storage deletion is best-effort
    }

    onUrlChange('');
  };

  const onFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
    e.target.value = '';
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
      <p className="text-xs text-gray-500 mb-3">{hint}</p>

      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept="image/*"
        onChange={onFileSelected}
      />

      {currentUrl ? (
        <div className="relative group border border-gray-200 inline-block">
          <img
            src={currentUrl}
            alt={label}
            className="w-48 h-36 object-cover"
          />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="p-2 bg-white rounded-full text-gray-700 hover:text-gray-900 shadow"
              title="Replace image"
            >
              <Upload className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleDelete}
              className="p-2 bg-white rounded-full text-red-600 hover:text-red-800 shadow"
              title="Remove image"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="w-48 h-36 border-2 border-dashed border-gray-300 hover:border-gray-400 flex flex-col items-center justify-center gap-2 text-gray-400 hover:text-gray-500 transition-colors"
        >
          {uploading ? (
            <span className="text-xs">Uploading...</span>
          ) : (
            <>
              <ImageIcon className="w-8 h-8" />
              <span className="text-xs">Click to upload</span>
            </>
          )}
        </button>
      )}
    </div>
  );
}

export function ProductEditForm({ product, categories }: Props) {
  const [name, setName] = useState(product.name);
  const [description, setDescription] = useState(product.description || '');
  const [categoryId, setCategoryId] = useState(product.category_id || '');
  const [environment, setEnvironment] = useState(product.environment || '');
  const [heroImageUrl, setHeroImageUrl] = useState(product.hero_image_url || '');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const formData = new FormData();
    formData.set('name', name.trim());
    formData.set('slug', slugify(name.trim()));
    formData.set('description', description.trim());
    formData.set('category_id', categoryId || '');
    formData.set('environment', environment || '');
    formData.set('hero_image_url', heroImageUrl.trim());
    formData.set('thumbnail_url', heroImageUrl.trim());

    const result = await updateProduct(product.id, formData);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success('Product saved.');
    }
    setSaving(false);
  };

  return (
    <div className="max-w-3xl">
      <div className="mb-8">
        <Link
          href="/admin/products"
          className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Products
        </Link>
        <h1 className="text-3xl font-light tracking-widest uppercase mb-2">
          Edit Product
        </h1>
        <p className="text-gray-600">{product.name}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 bg-white border border-gray-200 p-8">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
          <Input
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
          <select
            name="category_id"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
          >
            <option value="">— None —</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea
            name="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Environment</label>
          <select
            name="environment"
            value={environment}
            onChange={(e) => setEnvironment(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
          >
            <option value="">— None —</option>
            <option value="indoor">Indoor</option>
            <option value="outdoor">Outdoor</option>
          </select>
        </div>

        {/* Image upload */}
        <div className="border-t border-gray-200 pt-6">
          <h2 className="text-lg font-medium uppercase tracking-wide mb-6">Image</h2>
          <ImageUploadSlot
            label="Product Image"
            hint="Used on the product page and as thumbnail in the products grid"
            currentUrl={heroImageUrl}
            onUrlChange={setHeroImageUrl}
            productId={product.id}
            imageKey="hero"
          />
        </div>

        <div className="flex items-center gap-4">
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
          <Link
            href={`/products/${product.slug}`}
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            View on site →
          </Link>
        </div>
      </form>
    </div>
  );
}
