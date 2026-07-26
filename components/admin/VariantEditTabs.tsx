'use client';

import { useEffect, useState } from 'react';
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
import { saveVariantBuilder, updateVariant } from '@/app/(admin)/admin/variants/actions';
import { uploadSpecSheetPdfFromPreview } from '@/lib/specsheet/uploadSpecSheetPdf';
import { toast } from '@/components/ui/Toast';
import type { ProductVariant, ProductCategory, Product, ProductAsset, AppSettings } from '@/lib/types';
import {
  applyFamilyName,
  deriveSeries,
  syncIdentityFromSku,
  type SpecSheetData,
} from '@/lib/sku/specSheet';
import { AdminSelect } from '@/components/ui/AdminSelect';

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
  // Live from Builder — never show the stale DB code while editing.
  const liveCode = (data.code || buildSku(data.sku).shortCode || variant.code || '').trim();
  const viewHref = product?.slug ? `/products/${product.slug}/${variant.slug}` : '#';

  // Keep sheet productName + SKU series aligned with the selected family even when
  // the family was already chosen before this page loaded (onChange alone won't fire).
  useEffect(() => {
    if (!productId || !product) return;
    const wantSeries = deriveSeries(product.name);
    setData((prev) => {
      if (prev.productName === product.name && prev.sku.series === wantSeries) return prev;
      return applyFamilyName(prev, product.name);
    });
  }, [productId, product]);

  async function syncDatasheetPdf(okMessage: string, sheet: SpecSheetData = data) {
    const code = (sheet.code || buildSku(sheet.sku).shortCode || variant.code || '').trim();
    // Give React a tick so lastUpdate / identity fields are painted on the Preview.
    await new Promise((r) => setTimeout(r, 80));
    try {
      const pdf = await uploadSpecSheetPdfFromPreview(variant.id, code);
      if (pdf.error) {
        toast.error(`Saved, but Spec Sheet PDF failed: ${pdf.error}`);
        return;
      }
      toast.success(okMessage);
    } catch (err) {
      toast.error(
        `Saved, but Spec Sheet PDF failed: ${err instanceof Error ? err.message : 'unknown error'}`
      );
    }
  }

  async function handleSaveBuilder() {
    setSaving(true);
    // Force identity from current SKU before persist + PDF (no stale previous code).
    const synced = syncIdentityFromSku(data);
    setData(synced);
    const result = await saveVariantBuilder(variant.id, synced, {
      product_id: productId || null,
      category_id: categoryId || null,
      environment: environment || null,
    });
    if (result.error) {
      toast.error(result.error);
      setSaving(false);
      return;
    }
    if (result.lastUpdate) {
      setData((prev) => ({ ...prev, lastUpdate: result.lastUpdate! }));
    }
    await syncDatasheetPdf('Builder saved · Spec Sheet PDF updated.', synced);
    router.refresh();
    setSaving(false);
  }

  // The Product tab shows the built Identity (name / code / descriptions) AND
  // the Manufacturer / Pricing / Status form. "Save changes" must persist BOTH:
  // the identity + spec sheet (owned by the Builder data) and the pricing form.
  // Otherwise identity edits made here silently revert on reload.
  async function handleSaveProduct() {
    setSaving(true);

    const synced = syncIdentityFromSku(data);
    setData(synced);
    const identity = await saveVariantBuilder(variant.id, synced, {
      product_id: productId || null,
      category_id: categoryId || null,
      environment: environment || null,
    });
    if (identity.error) {
      toast.error(identity.error);
      setSaving(false);
      return;
    }
    if (identity.lastUpdate) {
      setData((prev) => ({ ...prev, lastUpdate: identity.lastUpdate! }));
    }

    const form = document.getElementById('variant-product-form') as HTMLFormElement | null;
    if (form) {
      const pricing = await updateVariant(variant.id, new FormData(form));
      if (pricing.error) {
        toast.error(pricing.error);
        setSaving(false);
        return;
      }
    }

    await syncDatasheetPdf('Product saved · Spec Sheet PDF updated.', synced);
    router.refresh();
    setSaving(false);
  }

  function handlePrint() {
    setTab('preview');
    // Chrome's "Save as PDF" uses document.title as the default filename.
    const code = liveCode;
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
            <h1 className="text-3xl font-light tracking-widest uppercase">{liveCode || '—'}</h1>
          </div>
          <div className="flex items-center gap-3">
            {tab === 'builder' && (
              <Button type="button" variant="primary" size="sm" onClick={handleSaveBuilder} disabled={saving}>
                <Save className="w-4 h-4 mr-2" />
                {saving ? 'Saving...' : 'Save builder'}
              </Button>
            )}
            {tab === 'product' && (
              <Button type="button" variant="primary" size="sm" onClick={handleSaveProduct} disabled={saving}>
                <Save className="w-4 h-4 mr-2" />
                {saving ? 'Saving...' : 'Save changes'}
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
              <AdminSelect
                aria-label="Product family"
                value={productId}
                placeholder="— None —"
                onChange={(id) => {
                  setProductId(id);
                  const p = products.find((x) => x.id === id);
                  // Keep SKU series / productName in sync with the family (Prueba → PRU).
                  // Otherwise only product_id changes and Re-apply keeps the old ORI prefix.
                  if (p) setData((prev) => applyFamilyName(prev, p.name));
                }}
                options={products.map((p) => ({ value: p.id, label: p.name }))}
              />
            </div>
            <div>
              <label className={labelCls}>Category {productId ? '(inherited)' : ''}</label>
              <AdminSelect
                aria-label="Category"
                value={productId ? product?.category_id || '' : categoryId}
                placeholder="— None —"
                disabled={Boolean(productId)}
                onChange={setCategoryId}
                options={categories.map((c) => ({ value: c.id, label: c.name }))}
              />
            </div>
            <div>
              <label className={labelCls}>Environment {productId ? '(inherited)' : ''}</label>
              <AdminSelect
                aria-label="Environment"
                value={productId ? product?.environment || '' : environment}
                placeholder="— None —"
                disabled={Boolean(productId)}
                onChange={setEnvironment}
                options={[
                  { value: 'indoor', label: 'Indoor' },
                  { value: 'outdoor', label: 'Outdoor' },
                ]}
              />
            </div>
          </div>
          <p className="mt-3 text-[11px] text-gray-500">
            Saved with “Save builder”. Category &amp; environment are inherited from the selected family.
          </p>
        </div>

        <VariantBuilderPanel
          data={data}
          onChange={setData}
          sync={sync}
          // Family dropdown owns the name when a family is selected (same as New variant).
          productNameEditable={!productId}
          familyName={product?.name ?? null}
          products={products.map((p) => ({ id: p.id, name: p.name }))}
          currentProductId={productId || null}
          currentVariantId={variant.id}
        />
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
          Manuals, IES/photometric files, drawings, BIM and product images. Uploads save immediately.
          The <strong>Spec Sheet / Datasheet (PDF)</strong> is auto-generated from Preview whenever you
          save the Builder or Product tab.
        </p>
        <FileUploadSection productId={variant.id} assets={assets} />
      </div>

      {/* Preview — kept laid out off-screen when inactive so Save can export PDF
          without flashing the tab (html2canvas needs real dimensions). */}
      <div
        className={
          tab === 'preview'
            ? 'bg-white p-4 border border-gray-200 overflow-x-auto'
            : 'fixed left-[-120vw] top-0 w-[8.5in] pointer-events-none opacity-0'
        }
        aria-hidden={tab !== 'preview'}
      >
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
