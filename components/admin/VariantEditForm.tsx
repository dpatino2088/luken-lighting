'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save, Eye } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { updateVariant } from '@/app/(admin)/admin/variants/actions';
import { ManufacturerSelect } from '@/components/admin/ManufacturerSelect';
import { PricingFields } from '@/components/admin/PricingFields';
import { toast } from '@/components/ui/Toast';
import type { ProductVariant, ProductCategory, Product, AppSettings } from '@/lib/types';

export type CommercialFields = {
  manufacturer: string;
  manufacturerSku: string;
  costUsd: number | null;
  distributorPrice: number | null;
  isActive: boolean;
};

interface Props {
  variant: ProductVariant;
  categories: ProductCategory[];
  products: Product[];
  settings: AppSettings;
  embedded?: boolean;
  /** When set (tabbed editor), commercial fields are controlled by the parent Save. */
  commercial?: CommercialFields;
  onCommercialChange?: (patch: Partial<CommercialFields>) => void;
}

export function VariantEditForm({
  variant,
  categories,
  products,
  settings,
  embedded = false,
  commercial,
  onCommercialChange,
}: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const controlled = Boolean(commercial && onCommercialChange);

  const [localManufacturer, setLocalManufacturer] = useState(variant.manufacturer || '');
  const [localManufacturerSku, setLocalManufacturerSku] = useState(variant.manufacturer_sku || '');
  const [localCostUsd, setLocalCostUsd] = useState<number | null>(variant.cost_usd ?? null);
  const [localDistributorPrice, setLocalDistributorPrice] = useState<number | null>(
    variant.distributor_price ?? null
  );
  const [localIsActive, setLocalIsActive] = useState(Boolean(variant.is_active));
  const [selectedProductId, setSelectedProductId] = useState(variant.product_id || '');
  const [categoryId, setCategoryId] = useState(variant.category_id || '');
  const [environment, setEnvironment] = useState(variant.environment || '');
  const selectedProduct = products.find((p) => p.id === selectedProductId);

  const manufacturer = controlled ? commercial!.manufacturer : localManufacturer;
  const manufacturerSku = controlled ? commercial!.manufacturerSku : localManufacturerSku;
  const costUsd = controlled ? commercial!.costUsd : localCostUsd;
  const distributorPrice = controlled ? commercial!.distributorPrice : localDistributorPrice;
  const isActive = controlled ? commercial!.isActive : localIsActive;

  const setManufacturer = (v: string) =>
    controlled ? onCommercialChange!({ manufacturer: v }) : setLocalManufacturer(v);
  const setManufacturerSku = (v: string) =>
    controlled ? onCommercialChange!({ manufacturerSku: v }) : setLocalManufacturerSku(v);
  const setPricing = (cost: number | null, price: number | null) => {
    if (controlled) onCommercialChange!({ costUsd: cost, distributorPrice: price });
    else {
      setLocalCostUsd(cost);
      setLocalDistributorPrice(price);
    }
  };
  const setIsActive = (v: boolean) =>
    controlled ? onCommercialChange!({ isActive: v }) : setLocalIsActive(v);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);

    const formData = new FormData(e.currentTarget);
    // Prefer live commercial state over any stale DOM defaultValue.
    formData.set('manufacturer', manufacturer);
    formData.set('manufacturer_sku', manufacturerSku);
    formData.set('cost_usd', costUsd == null ? '' : String(costUsd));
    formData.set('distributor_price', distributorPrice == null ? '' : String(distributorPrice));
    formData.set('is_active', 'false');
    if (isActive) formData.append('is_active', 'true');

    const result = await updateVariant(variant.id, formData);

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success('Variant saved successfully.');
      router.refresh();
    }
    setSaving(false);
  };

  return (
    <div className={embedded ? '' : 'max-w-5xl'}>
      {!embedded && (
        <div className="flex items-center justify-between mb-8">
          <div>
            <Link
              href="/admin/variants"
              className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-2"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back to Variants
            </Link>
            <h1 className="text-3xl font-light tracking-widest uppercase">
              {variant.code}
            </h1>
          </div>
          <Link href={variant.product?.slug ? `/products/${variant.product.slug}/${variant.slug}` : '#'} target="_blank">
            <Button type="button" variant="secondary" size="sm">
              <Eye className="w-4 h-4 mr-2" />
              View on Site
            </Button>
          </Link>
        </div>
      )}

      <form id="variant-product-form" onSubmit={handleSubmit} className="space-y-8">
        {/* Relationships (family / category / environment) are edited in the
            Builder tab when embedded; only the standalone form shows them here. */}
        {!embedded && (
        <section className="bg-white border border-gray-200 p-6 space-y-5">
          <h2 className="text-lg font-medium uppercase tracking-wide border-b border-gray-200 pb-3">
            Basic Information
          </h2>
          <p className="text-xs text-gray-500 -mt-2">
            Relationships, pricing and status. SKU code, technical specs and dimensions are managed in the <strong>Builder</strong> tab.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Product</label>
              <select
                name="product_id"
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-none focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent text-gray-900 bg-white"
              >
                <option value="">— None —</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Category</label>
              <input
                type="hidden"
                name="category_id"
                value={selectedProductId ? selectedProduct?.category_id || '' : categoryId}
              />
              <select
                value={selectedProductId ? selectedProduct?.category_id || '' : categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                disabled={Boolean(selectedProductId)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-none focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent text-gray-900 bg-white disabled:bg-gray-100 disabled:text-gray-500"
              >
                <option value="">— None —</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              {selectedProductId && (
                <p className="text-xs text-gray-500">
                  Inherited from the selected product.
                </p>
              )}
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Environment</label>
              <input
                type="hidden"
                name="environment"
                value={selectedProductId ? selectedProduct?.environment || '' : environment}
              />
              <select
                value={selectedProductId ? selectedProduct?.environment || '' : environment}
                onChange={(e) => setEnvironment(e.target.value)}
                disabled={Boolean(selectedProductId)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-none focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent text-gray-900 bg-white disabled:bg-gray-100 disabled:text-gray-500"
              >
                <option value="">— None —</option>
                <option value="indoor">Indoor</option>
                <option value="outdoor">Outdoor</option>
              </select>
              {selectedProductId && (
                <p className="text-xs text-gray-500">
                  Inherited from the selected product.
                </p>
              )}
            </div>
          </div>
        </section>
        )}

        <section className="bg-white border border-gray-200 p-6 space-y-5">
          <h2 className="text-lg font-medium uppercase tracking-wide border-b border-gray-200 pb-3">
            Manufacturer & Pricing
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Manufacturer</label>
              <ManufacturerSelect value={manufacturer} onChange={setManufacturer} name="manufacturer" />
            </div>
            <Input
              label="Manufacturer SKU"
              name="manufacturer_sku"
              value={manufacturerSku}
              onChange={(e) => setManufacturerSku(e.target.value)}
              placeholder="Factory product code"
            />
          </div>

          <PricingFields
            key={`pricing-${variant.id}-${variant.updated_at}`}
            initialCostUsd={costUsd}
            initialDistributorPrice={distributorPrice}
            eurToUsdRate={settings.eur_to_usd_rate}
            costName="cost_usd"
            priceName="distributor_price"
            onChange={setPricing}
          />

          <p className="text-xs text-gray-400">
            Cost → markup / margin → Distributor Price → ×2 → MSRP. 1 EUR = {settings.eur_to_usd_rate} USD.
          </p>
        </section>

        <section className="bg-white border border-gray-200 p-6 space-y-4">
          <h2 className="text-lg font-medium uppercase tracking-wide border-b border-gray-200 pb-3">
            Status
          </h2>
          <div className="flex gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="hidden" name="is_active" value="false" />
              <input
                type="checkbox"
                name="is_active"
                value="true"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="w-4 h-4"
              />
              <span className="text-sm font-medium text-gray-700">Active (visible on site)</span>
            </label>
          </div>
        </section>

        {/* When embedded in the tabbed editor the Save button lives in the top
            toolbar (unified with "Save builder"); only show a bottom button in
            the standalone form. */}
        {!embedded && (
          <div className="flex items-center gap-4 pt-2 pb-8">
            <Button type="submit" variant="primary" disabled={saving}>
              <Save className="w-4 h-4 mr-2" />
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
            <Link href="/admin/variants">
              <Button type="button" variant="secondary">Cancel</Button>
            </Link>
          </div>
        )}
      </form>
    </div>
  );
}
