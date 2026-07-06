'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Eye, Save, Printer } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { VariantEditForm } from '@/components/admin/VariantEditForm';
import { FileUploadSection } from '@/components/admin/FileUploadSection';
import { VariantBuilderPanel } from '@/components/specsheet/VariantBuilderPanel';
import { IdentityFields } from '@/components/specsheet/IdentityFields';
import { useSpecSheetSync } from '@/components/specsheet/useSpecSheetSync';
import { SheetPreview } from '@/components/specsheet/SheetPreview';
import { buildSku } from '@/lib/sku/skuRules';
import { saveVariantBuilder } from '@/app/(admin)/admin/variants/actions';
import { toast } from '@/components/ui/Toast';
import type { ProductVariant, ProductCategory, Product, ProductAsset, AppSettings } from '@/lib/types';
import type { SpecSheetData } from '@/lib/sku/specSheet';

type Tab = 'builder' | 'product' | 'files' | 'preview';

const topTabBtn = (active: boolean) =>
  'px-4 py-2 text-sm font-medium uppercase tracking-wide border-b-2 transition-colors ' +
  (active ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-400 hover:text-gray-600');

const fieldCls =
  'w-full px-3 py-2 border border-gray-300 rounded-none bg-white text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent disabled:bg-gray-100 disabled:text-gray-500';
const labelCls = 'block text-xs font-medium uppercase tracking-wide text-gray-500 mb-1';

export function VariantEditTabs({
  variant,
  categories,
  products,
  assets,
  settings,
  initialData,
}: {
  variant: ProductVariant;
  categories: ProductCategory[];
  products: Product[];
  assets: ProductAsset[];
  settings: AppSettings;
  initialData: SpecSheetData;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('builder');
  const [data, setData] = useState<SpecSheetData>(initialData);
  const sync = useSpecSheetSync(data, setData);
  const [saving, setSaving] = useState(false);
  const [productId, setProductId] = useState(variant.product_id || '');
  const [categoryId, setCategoryId] = useState(variant.category_id || '');
  const [environment, setEnvironment] = useState(variant.environment || '');

  const product = products.find((p) => p.id === productId);
  const viewHref = product?.slug ? `/products/${product.slug}/${variant.slug}` : '#';

  async function handleSaveBuilder() {
    setSaving(true);
    const result = await saveVariantBuilder(variant.id, data, {
      product_id: productId || null,
      category_id: categoryId || null,
      environment: environment || null,
    });
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success('Builder & spec sheet saved.');
      router.refresh();
    }
    setSaving(false);
  }

  function handlePrint() {
    setTab('preview');
    // Chrome's "Save as PDF" uses document.title as the default filename.
    const code = (data.code || buildSku(data.sku).shortCode || variant.code || '').trim();
    const fileName = code ? `Luken Lighting - ${code}` : 'Luken Lighting - Spec Sheet';
    // Wait for the preview tab to render before invoking the print engine.
    setTimeout(() => {
      const prevTitle = document.title;
      document.title = fileName;
      const restore = () => {
        document.title = prevTitle;
        window.removeEventListener('afterprint', restore);
      };
      window.addEventListener('afterprint', restore);
      window.print();
    }, 150);
  }

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar: fixed flex item (does not scroll); only the content area below scrolls */}
      <div className="shrink-0 bg-white border-b border-gray-200 pb-3">
        <div className="flex items-center justify-between">
          <div>
            <Link href="/admin/variants" className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-2">
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back to Variants
            </Link>
            <h1 className="text-3xl font-light tracking-widest uppercase">{variant.code}</h1>
          </div>
          <div className="flex items-center gap-3">
            {tab === 'builder' && (
              <Button type="button" variant="primary" size="sm" onClick={handleSaveBuilder} disabled={saving}>
                <Save className="w-4 h-4 mr-2" />
                {saving ? 'Saving...' : 'Save builder'}
              </Button>
            )}
            {tab === 'product' && (
              <Button type="submit" form="variant-product-form" variant="primary" size="sm">
                <Save className="w-4 h-4 mr-2" />
                Save changes
              </Button>
            )}
            <Button type="button" variant="secondary" size="sm" onClick={handlePrint}>
              <Printer className="w-4 h-4 mr-2" />
              Print / PDF
            </Button>
            <Link href={viewHref} target="_blank">
              <Button type="button" variant="secondary" size="sm">
                <Eye className="w-4 h-4 mr-2" />
                View on Site
              </Button>
            </Link>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={() => setTab('builder')} className={topTabBtn(tab === 'builder')}>
            Builder
          </button>
          <button type="button" onClick={() => setTab('product')} className={topTabBtn(tab === 'product')}>
            Product
          </button>
          <button type="button" onClick={() => setTab('files')} className={topTabBtn(tab === 'files')}>
            File &amp; Assets
          </button>
          <button type="button" onClick={() => setTab('preview')} className={topTabBtn(tab === 'preview')}>
            Preview
          </button>
        </div>
      </div>

      {/* Scrolling content area */}
      <div className="flex-1 min-h-0 overflow-y-auto pt-6">
      {/* Builder */}
      <div hidden={tab !== 'builder'} className="space-y-4">
        <p className="text-[11px] text-gray-500">
          Generates the SKU, descriptions and the technical sheet. Saving here updates the variant code, name and
          descriptions (+ the spec sheet). Pricing and files live in the <strong>Product</strong> / <strong>File &amp; Assets</strong> tabs.
        </p>

        {/* Belongs to (family) — same as the create flow; saved with "Save builder" */}
        <div className="bg-white border border-gray-200 p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide mb-4">Belongs to (family)</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>Product (family)</label>
              <select className={fieldCls} value={productId} onChange={(e) => setProductId(e.target.value)}>
                <option value="">— None —</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Category {productId ? '(inherited)' : ''}</label>
              <select
                className={fieldCls}
                value={productId ? product?.category_id || '' : categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                disabled={Boolean(productId)}
              >
                <option value="">— None —</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Environment {productId ? '(inherited)' : ''}</label>
              <select
                className={fieldCls}
                value={productId ? product?.environment || '' : environment}
                onChange={(e) => setEnvironment(e.target.value)}
                disabled={Boolean(productId)}
              >
                <option value="">— None —</option>
                <option value="indoor">Indoor</option>
                <option value="outdoor">Outdoor</option>
              </select>
            </div>
          </div>
          <p className="mt-3 text-[11px] text-gray-500">
            Saved with “Save builder”. Category &amp; environment are inherited from the selected family.
          </p>
        </div>

        <VariantBuilderPanel data={data} onChange={setData} sync={sync} productNameEditable />
      </div>

      {/* Product */}
      <div hidden={tab !== 'product'} className="space-y-6">
        <IdentityFields data={data} sync={sync} />
        <p className="text-[11px] text-gray-500">
          Identity above, the family relationship and all technical specs & dimensions are built and saved from the{' '}
          <strong>Builder</strong> tab (“Save builder”). Only pricing and status below are saved with “Save changes”.
        </p>
        <VariantEditForm
          variant={variant}
          categories={categories}
          products={products}
          settings={settings}
          embedded
        />
      </div>

      {/* File & Assets */}
      <div hidden={tab !== 'files'} className="bg-white border border-gray-200 p-6 space-y-5">
        <h2 className="text-lg font-medium uppercase tracking-wide border-b border-gray-200 pb-3">
          File &amp; Assets
        </h2>
        <p className="text-[11px] text-gray-500">
          Manuals, spec sheets, IES/photometric files, drawings, BIM and product images. Uploads save immediately.
        </p>
        <FileUploadSection productId={variant.id} assets={assets} />
      </div>

      {/* Preview */}
      <div hidden={tab !== 'preview'} className="bg-white p-4 border border-gray-200 overflow-x-auto">
        <SheetPreview
          data={data}
          assets={assets}
          brandLogoUrl={settings.brand_logo_url}
          familyOverview={product?.description}
        />
      </div>
      </div>
    </div>
  );
}
