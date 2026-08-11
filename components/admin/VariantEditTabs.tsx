'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Eye, Save, Printer } from 'lucide-react';
import { getLatestAssetUrl } from '@/lib/assets';
import { Button } from '@/components/ui/Button';
import { VariantEditForm, type CommercialFields } from '@/components/admin/VariantEditForm';
import { FileUploadSection } from '@/components/admin/FileUploadSection';
import { VariantActionsMenu } from '@/components/admin/VariantActionsMenu';
import { VariantBuilderPanel } from '@/components/specsheet/VariantBuilderPanel';
import { IdentityFields } from '@/components/specsheet/IdentityFields';
import { useSpecSheetSync } from '@/components/specsheet/useSpecSheetSync';
import { SheetPreview } from '@/components/specsheet/SheetPreview';
import { LabelTab } from '@/components/label/LabelTab';
import { buildSku } from '@/lib/sku/skuRules';
import { saveVariantBuilder, updateVariant } from '@/app/(admin)/admin/variants/actions';
import { uploadSpecSheetPdfFromPreview } from '@/lib/specsheet/uploadSpecSheetPdf';
import { SHEET_WIDTH_PX } from '@/lib/specsheet/sheetGeometry';
import { toast } from '@/components/ui/Toast';
import type { ProductVariant, ProductCategory, Product, ProductAsset, AppSettings } from '@/lib/types';
import {
  applyFamilyName,
  deriveSeries,
  syncIdentityFromSku,
  type SpecSheetData,
} from '@/lib/sku/specSheet';
import { AdminSelect } from '@/components/ui/AdminSelect';

type Tab = 'builder' | 'product' | 'files' | 'preview' | 'label';

/** Asset slots the Spec Sheet renders — a new upload changes the PDF. */
const SHEET_IMAGE_TYPES = ['image', 'photometric_image', 'dimensions_image'];

/**
 * Fingerprint of everything the Spec Sheet renders. Save compares it against the
 * state captured at the last PDF generation and skips Chromium when nothing
 * changed, since regenerating on every Save made saving slow.
 *
 * `lastUpdate` is excluded on purpose: the save action bumps it every time, which
 * would leave the sheet looking permanently changed.
 */
function sheetSignature(
  sheet: SpecSheetData,
  assets: ProductAsset[],
  brandLogoUrl: string | null | undefined,
  familyOverview: string | null | undefined
): string {
  const { lastUpdate, ...content } = sheet;
  void lastUpdate;
  return JSON.stringify({
    content,
    images: SHEET_IMAGE_TYPES.map((type) => getLatestAssetUrl(assets, type) || ''),
    brandLogoUrl: brandLogoUrl || '',
    familyOverview: familyOverview || '',
  });
}

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
  // Commercial fields live here so Save always persists them — even when the
  // Product tab is not focused (FormData from a [hidden] panel was unreliable).
  const [commercial, setCommercial] = useState<CommercialFields>(() => ({
    manufacturer: variant.manufacturer || '',
    manufacturerSku: variant.manufacturer_sku || '',
    costUsd: variant.cost_usd ?? null,
    distributorPrice: variant.distributor_price ?? null,
    isActive: Boolean(variant.is_active),
  }));
  useEffect(() => {
    setCommercial({
      manufacturer: variant.manufacturer || '',
      manufacturerSku: variant.manufacturer_sku || '',
      costUsd: variant.cost_usd ?? null,
      distributorPrice: variant.distributor_price ?? null,
      isActive: Boolean(variant.is_active),
    });
    // Re-sync only when the server variant row changes (navigation / refresh after Save).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variant.id, variant.updated_at]);
  // Local assets so Save replaces the datasheet slot immediately in File & Assets.
  const [liveAssets, setLiveAssets] = useState<ProductAsset[]>(assets);
  useEffect(() => {
    setLiveAssets(assets);
  }, [assets]);

  const [pdfBusy, setPdfBusy] = useState(false);
  const product = products.find((p) => p.id === productId);
  const familyOverview = product?.description;
  const currentSignature = sheetSignature(
    data,
    liveAssets,
    settings.brand_logo_url,
    familyOverview
  );
  const hasDatasheet = liveAssets.some((a) => a.type === 'datasheet' && a.file_url);
  // Baseline = sheet state behind the stored PDF. Seeded on first render from the
  // saved data, so opening a variant and hitting Save does not rebuild the PDF.
  const pdfBaselineRef = useRef<string | null>(null);
  if (pdfBaselineRef.current === null) pdfBaselineRef.current = currentSignature;
  const pdfOutdated = !hasDatasheet || currentSignature !== pdfBaselineRef.current;

  // Live from Builder — name leads; Short/Long SKU sit under it.
  const liveBuilt = buildSku(data.sku);
  const liveShortCode = (liveBuilt.shortCode || '').trim();
  const liveLongCode = (liveBuilt.longCode || liveShortCode || data.code || variant.code || '').trim();
  const liveCode = liveLongCode;
  // Family / product name leads the page — not the Long SKU.
  const liveTitle = (data.productName || product?.name || data.name || variant.name || 'Variant').trim();
  const viewHref = product?.slug ? `/products/${product.slug}/${variant.slug}` : '#';

  // Keep sheet productName aligned with the selected family (e.g. after load or
  // a server-side family rename). Never overwrite a manually typed Series (PWS
  // instead of POW-SUP) — that lives behind seriesLinked === false.
  useEffect(() => {
    if (!productId || !product) return;
    const familyName = product.name;
    setData((prev) => {
      const wantSeries = deriveSeries(familyName);
      if (prev.productName === familyName) {
        if (prev.seriesLinked && prev.sku.series !== wantSeries) {
          return applyFamilyName(prev, familyName);
        }
        return prev;
      }
      // Family name drifted; keep a custom Series, only update productName.
      if (prev.seriesLinked === false) {
        return syncIdentityFromSku({ ...prev, productName: familyName });
      }
      return applyFamilyName(prev, familyName);
    });
  }, [productId, product?.name]);

  /** Regenerate datasheet from Preview → replace bucket object + product_assets row. */
  async function syncDatasheetPdf(sheet: SpecSheetData = data): Promise<boolean> {
    const code = (
      sheet.code ||
      buildSku(sheet.sku).longCode ||
      buildSku(sheet.sku).shortCode ||
      variant.code ||
      ''
    ).trim();
    // Ensure Preview DOM is painted before Chromium serializes it.
    const prevTab = tab;
    setTab('preview');
    await new Promise((r) => setTimeout(r, 350));
    try {
      const pdf = await uploadSpecSheetPdfFromPreview(variant.id, code);
      if (pdf?.error) {
        toast.error(`Saved, but Spec Sheet PDF failed: ${pdf.error}`);
        setTab(prevTab);
        return false;
      }
      if (pdf.asset) {
        setLiveAssets((prev) => [...prev.filter((a) => a.type !== 'datasheet'), pdf.asset!]);
      }
      pdfBaselineRef.current = sheetSignature(
        sheet,
        liveAssets,
        settings.brand_logo_url,
        familyOverview
      );
      setTab(prevTab);
      return true;
    } catch (err) {
      toast.error(
        `Saved, but Spec Sheet PDF failed: ${err instanceof Error ? err.message : 'unknown error'}`
      );
      setTab(prevTab);
      return false;
    }
  }

  /** Force a datasheet rebuild from the current Preview (PDF slot in File & Assets). */
  async function handleUpdatePdf() {
    setPdfBusy(true);
    const ok = await syncDatasheetPdf(data);
    if (ok) toast.success('Spec Sheet PDF updated.');
    router.refresh();
    setPdfBusy(false);
  }

  /**
   * Always-available Save: Builder identity + pricing form (if mounted). The
   * datasheet PDF is rebuilt only when the sheet actually changed — Chromium is
   * the slow part of saving, and most saves do not touch the sheet.
   */
  async function handleSave() {
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

    const formData = new FormData();
    formData.set('manufacturer', commercial.manufacturer);
    formData.set('manufacturer_sku', commercial.manufacturerSku);
    formData.set('cost_usd', commercial.costUsd == null ? '' : String(commercial.costUsd));
    formData.set(
      'distributor_price',
      commercial.distributorPrice == null ? '' : String(commercial.distributorPrice)
    );
    formData.set('is_active', 'false');
    if (commercial.isActive) formData.append('is_active', 'true');

    const pricing = await updateVariant(variant.id, formData);
    if (pricing.error) {
      toast.error(pricing.error);
      setSaving(false);
      return;
    }

    const nextSignature = sheetSignature(
      synced,
      liveAssets,
      settings.brand_logo_url,
      familyOverview
    );
    if (hasDatasheet && nextSignature === pdfBaselineRef.current) {
      toast.success('Saved · Spec Sheet unchanged, PDF kept.');
      router.refresh();
      setSaving(false);
      return;
    }

    const pdfOk = await syncDatasheetPdf(synced);
    if (pdfOk) toast.success('Saved · Spec Sheet PDF updated.');
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
        <Link
          href="/admin/variants"
          className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-3"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Variants
        </Link>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <h1 className="text-3xl font-light tracking-widest uppercase text-gray-900 truncate">
              {liveTitle}
            </h1>
            {liveShortCode ? (
              <p className="mt-1 font-mono text-sm text-gray-700 truncate">{liveShortCode}</p>
            ) : null}
            {liveLongCode && liveLongCode !== liveShortCode ? (
              <p className="mt-0.5 font-mono text-[11px] text-gray-400 break-all leading-snug">
                {liveLongCode}
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Button type="button" variant="primary" size="sm" onClick={handleSave} disabled={saving}>
              <Save className="w-4 h-4 mr-2" />
              {saving ? 'Saving…' : 'Save'}
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={handlePrint} disabled={saving}>
              <Printer className="w-4 h-4 mr-2" />
              Print
            </Button>
            <Link href={viewHref} target="_blank">
              <Button type="button" variant="secondary" size="sm" disabled={saving}>
                <Eye className="w-4 h-4 mr-2" />
                View
              </Button>
            </Link>
            <VariantActionsMenu
              variantId={variant.id}
              variantCode={liveShortCode || liveCode || variant.code}
              isActive={variant.is_active}
              viewHref={viewHref !== '#' ? viewHref : undefined}
              compact={false}
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 border-t border-gray-100 pt-3">
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
          <button type="button" onClick={() => setTab('label')} className={topTabBtn(tab === 'label')}>
            Label
          </button>
        </div>
      </div>

      {/* Scrolling content area */}
      <div className="flex-1 min-h-0 overflow-y-auto pt-6">
      {/* Builder */}
      <div hidden={tab !== 'builder'} className="space-y-4">
        <p className="text-[11px] text-gray-500">
          Generates the SKU, descriptions and the technical sheet. <strong>Save</strong> updates the
          variant (including Manufacturer SKU &amp; pricing from the Product tab) and rebuilds the
          public Spec Sheet PDF only when the sheet changed. Files live in{' '}
          <strong>File &amp; Assets</strong>.
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
          Identity above comes from the Builder. Manufacturer SKU, pricing and status below are
          saved together with the top <strong>Save</strong> button (from any tab).
        </p>
        <VariantEditForm
          variant={variant}
          categories={categories}
          products={products}
          settings={settings}
          embedded
          commercial={commercial}
          onCommercialChange={(patch) => setCommercial((prev) => ({ ...prev, ...patch }))}
        />
      </div>

      {/* File & Assets */}
      <div hidden={tab !== 'files'} className="bg-white border border-gray-200 p-6 space-y-5">
        <h2 className="text-lg font-medium uppercase tracking-wide border-b border-gray-200 pb-3">
          File &amp; Assets
        </h2>
        <p className="text-[11px] text-gray-500">
          Manuals, IES/photometric files, drawings, BIM and product images. Uploads save immediately.
          The <strong>Spec Sheet / Datasheet (PDF)</strong> is generated from Preview and rebuilt on{' '}
          <strong>Save</strong> whenever the sheet changed — use <strong>Update PDF</strong> to force a
          rebuild. The old file is replaced in storage, so the public site always links the newest.
        </p>
        <FileUploadSection
          productId={variant.id}
          assets={liveAssets}
          onUpdateDatasheet={handleUpdatePdf}
          datasheetBusy={pdfBusy || saving}
          datasheetOutdated={pdfOutdated}
        />
      </div>

      {/* Preview — kept laid out off-screen when inactive so Save can serialize
          the same DOM Chromium prints to PDF. */}
      <div
        className={
          tab === 'preview'
            ? 'bg-gray-100 p-6 border border-gray-200 overflow-x-auto'
            : 'fixed left-[-120vw] top-0 pointer-events-none opacity-0'
        }
        style={tab === 'preview' ? undefined : { width: SHEET_WIDTH_PX }}
        aria-hidden={tab !== 'preview'}
      >
        <SheetPreview
          data={data}
          assets={liveAssets}
          brandLogoUrl={settings.brand_logo_url}
          familyOverview={product?.description}
        />
      </div>

      {/* Label — like Preview, kept laid out off-screen rather than hidden: the
          label measures its own type to fit the panel, and `display: none` has
          no layout to measure. */}
      <div
        className={tab === 'label' ? undefined : 'fixed left-[-120vw] top-0 pointer-events-none opacity-0'}
        aria-hidden={tab !== 'label'}
      >
        <LabelTab
          variant={variant}
          family={liveTitle}
          name={(data.name || '').trim() || liveShortCode || variant.name}
          code={liveCode || variant.code}
          productId={productId || null}
          productSlug={product?.slug ?? null}
          initialTemplateId={product?.label_template_id ?? null}
          labelLogoUrl={settings.label_logo_url}
        />
      </div>
      </div>
    </div>
  );
}
