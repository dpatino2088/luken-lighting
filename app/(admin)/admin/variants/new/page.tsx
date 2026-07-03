'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Printer } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { slugify } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { VariantBuilderPanel } from '@/components/specsheet/VariantBuilderPanel';
import { ManufacturerSelect } from '@/components/admin/ManufacturerSelect';
import { PricingFields } from '@/components/admin/PricingFields';
import { IdentityFields } from '@/components/specsheet/IdentityFields';
import { useSpecSheetSync } from '@/components/specsheet/useSpecSheetSync';
import { SheetPreview } from '@/components/specsheet/SheetPreview';
import { createDefaultSpecSheet, type SpecSheetData } from '@/lib/sku/specSheet';
import { buildSku } from '@/lib/sku/skuRules';
import { specSheetToVariantFields, cctRange } from '@/lib/sku/mapToLuken';
import { getSettings } from '@/app/(admin)/admin/settings/actions';
import { toast } from '@/components/ui/Toast';

interface SimpleCategory { id: string; name: string; }
interface SimpleProduct { id: string; name: string; category_id: string | null; environment: 'indoor' | 'outdoor' | null; description: string | null; }

type TopTab = 'builder' | 'product' | 'files' | 'preview';

const fieldClass =
  'w-full px-3 py-2 border border-gray-300 rounded-none bg-white text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent disabled:bg-gray-100 disabled:text-gray-500';
const labelClass = 'block text-xs font-medium uppercase tracking-wide text-gray-500 mb-1';
const topTabBtn = (active: boolean) =>
  'px-4 py-2 text-sm font-medium uppercase tracking-wide border-b-2 transition-colors ' +
  (active ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-400 hover:text-gray-600');

export default function NewVariantPage() {
  const router = useRouter();

  const [categories, setCategories] = useState<SimpleCategory[]>([]);
  const [products, setProducts] = useState<SimpleProduct[]>([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [environment, setEnvironment] = useState('');
  const selectedProduct = products.find((p) => p.id === selectedProductId);

  const [data, setData] = useState<SpecSheetData>(() => createDefaultSpecSheet());
  const sync = useSpecSheetSync(data, setData);
  const [topTab, setTopTab] = useState<TopTab>('builder');

  const [manufacturer, setManufacturer] = useState('');
  const [manufacturerSku, setManufacturerSku] = useState('');
  const [costUsd, setCostUsd] = useState('');
  const [distributorPrice, setDistributorPrice] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [isFeatured, setIsFeatured] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [brandLogoUrl, setBrandLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) return;
    Promise.all([
      supabase.from('product_categories').select('id, name').order('sort_order'),
      supabase.from('products').select('id, name, category_id, environment, description').order('sort_order'),
    ]).then(([catRes, prodRes]) => {
      setCategories(catRes.data ?? []);
      setProducts(prodRes.data ?? []);
    });
    getSettings().then((s) => setBrandLogoUrl(s.brand_logo_url));
  }, []);

  // When a family is chosen, preload its name so the SKU series derives from it.
  useEffect(() => {
    if (!selectedProductId) return;
    const p = products.find((x) => x.id === selectedProductId);
    if (p) setData((prev) => (prev.productName === p.name ? prev : { ...prev, productName: p.name }));
  }, [selectedProductId, products]);

  const skuPreview = useMemo(() => buildSku(data.sku), [data.sku]);

  const effectiveCategoryId = selectedProductId ? (selectedProduct?.category_id ?? categoryId) || null : categoryId || null;
  const effectiveEnvironment = selectedProductId ? (selectedProduct?.environment ?? environment) || null : environment || null;

  async function handleSubmit() {
    if (!data.productName.trim()) {
      toast.error('Choose a product family (or type a product name) first.');
      setTopTab('builder');
      return;
    }
    if (!skuPreview.shortCode) {
      toast.error('Complete the SKU generator (at least the Series) to generate a code.');
      setTopTab('builder');
      return;
    }

    setIsSubmitting(true);
    try {
      const supabase = createClient();
      if (!supabase) throw new Error('Supabase not configured');

      const vf = specSheetToVariantFields(data, effectiveEnvironment);
      const slug = slugify(vf.code) || slugify(vf.name);

      const { data: variant, error: vErr } = await supabase
        .from('product_variants')
        .insert({
          ...vf,
          slug,
          product_id: selectedProductId || null,
          category_id: effectiveCategoryId,
          manufacturer: manufacturer || null,
          manufacturer_sku: manufacturerSku || null,
          cost_usd: costUsd ? Number(costUsd) : null,
          distributor_price: distributorPrice ? Number(distributorPrice) : null,
          is_active: isActive,
          is_featured: isFeatured,
        })
        .select()
        .single();
      if (vErr) throw vErr;

      const { min: cctSingle } = cctRange(data.sku.cct);
      await supabase.from('product_skus').insert({
        variant_id: variant.id,
        code: vf.code,
        name: vf.name,
        finish: vf.finish,
        cct: cctSingle,
      });

      const { data: userData } = await supabase.auth.getUser();
      await supabase.from('spec_sheets').insert({
        product_id: selectedProductId || null,
        variant_id: variant.id,
        product_name: data.productName.trim(),
        code: vf.code,
        data,
        created_by: userData.user?.id ?? null,
      });

      toast.success(`Variant "${vf.name}" created.`);
      router.push(`/admin/variants/${variant.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'An error occurred');
      setIsSubmitting(false);
    }
  }

  function handlePrint() {
    setTopTab('preview');
    setTimeout(() => window.print(), 150);
  }

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar: fixed flex item (does not scroll); only the content area below scrolls */}
      <div className="shrink-0 bg-white border-b border-gray-200 pb-3">
        <Link href="/admin/variants" className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-3">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Variants
        </Link>
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-light tracking-widest uppercase">Add New Variant</h1>
            <p className="mt-1 text-[11px] text-gray-500">
              Series: <span className="font-mono">{data.sku.series || '—'}</span> · SKU:{' '}
              <span className="font-mono">{skuPreview.shortCode || '—'}</span>
            </p>
          </div>
          <div className="flex items-center gap-3 mb-1">
            <Button type="button" variant="secondary" onClick={handlePrint}>
              <Printer className="w-4 h-4 mr-2" />
              Print / PDF
            </Button>
            <Link href="/admin/variants">
              <Button type="button" variant="secondary">Cancel</Button>
            </Link>
            <Button type="button" variant="primary" onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create Variant'}
            </Button>
          </div>
        </div>
        {/* Top tabs */}
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={() => setTopTab('builder')} className={topTabBtn(topTab === 'builder')}>
            Builder
          </button>
          <button type="button" onClick={() => setTopTab('product')} className={topTabBtn(topTab === 'product')}>
            Product
          </button>
          <button type="button" onClick={() => setTopTab('files')} className={topTabBtn(topTab === 'files')}>
            File &amp; Assets
          </button>
          <button type="button" onClick={() => setTopTab('preview')} className={topTabBtn(topTab === 'preview')}>
            Preview
          </button>
        </div>
      </div>

      {/* Scrolling content area */}
      <div className="flex-1 min-h-0 overflow-y-auto pt-6 space-y-6">

      {/* Builder tab */}
      <div hidden={topTab !== 'builder'} className="space-y-6">
        <div className="bg-white border border-gray-200 p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide mb-4">Belongs to (family)</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className={labelClass}>Product (family)</label>
              <select className={fieldClass} value={selectedProductId} onChange={(e) => setSelectedProductId(e.target.value)}>
                <option value="">— None —</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Category {selectedProductId ? '(inherited)' : ''}</label>
              <select
                className={fieldClass}
                value={selectedProductId ? selectedProduct?.category_id || '' : categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                disabled={Boolean(selectedProductId)}
              >
                <option value="">— None —</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Environment {selectedProductId ? '(inherited)' : ''}</label>
              <select
                className={fieldClass}
                value={selectedProductId ? selectedProduct?.environment || '' : environment}
                onChange={(e) => setEnvironment(e.target.value)}
                disabled={Boolean(selectedProductId)}
              >
                <option value="">— None —</option>
                <option value="indoor">Indoor</option>
                <option value="outdoor">Outdoor</option>
              </select>
            </div>
          </div>
        </div>

        <VariantBuilderPanel data={data} onChange={setData} sync={sync} productNameEditable={!selectedProductId} />
      </div>

      {/* File & Assets tab */}
      <div hidden={topTab !== 'files'} className="bg-white border border-gray-200 p-6 space-y-4 max-w-3xl">
        <h2 className="text-lg font-medium uppercase tracking-wide border-b border-gray-200 pb-3">File &amp; Assets</h2>
        <div className="border border-dashed border-gray-300 bg-gray-50 p-6 text-center">
          <p className="text-sm text-gray-600">Create the variant first to upload files.</p>
          <p className="mt-1 text-[11px] text-gray-400">
            Manuals, spec sheets, IES/photometric files, drawings, BIM and images can be uploaded here right after you press
            “Create Variant”.
          </p>
        </div>
      </div>

      {/* Preview tab */}
      <div hidden={topTab !== 'preview'} className="bg-white p-4 border border-gray-200 overflow-x-auto">
        <SheetPreview data={data} brandLogoUrl={brandLogoUrl} familyOverview={selectedProduct?.description} />
      </div>

      {/* Product tab */}
      <div hidden={topTab !== 'product'} className="space-y-6 max-w-3xl">
        <IdentityFields data={data} sync={sync} />

        <div className="bg-white border border-gray-200 p-6 space-y-5">
        <h2 className="text-lg font-medium uppercase tracking-wide border-b border-gray-200 pb-3">Manufacturer &amp; Pricing</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Manufacturer</label>
            <ManufacturerSelect value={manufacturer} onChange={setManufacturer} />
          </div>
          <div>
            <label className={labelClass}>Manufacturer SKU</label>
            <input className={fieldClass} value={manufacturerSku} onChange={(e) => setManufacturerSku(e.target.value)} placeholder="Factory product code" />
          </div>
        </div>
        <PricingFields
          initialCostUsd={null}
          initialDistributorPrice={null}
          onChange={(c, p) => {
            setCostUsd(c == null ? '' : String(c));
            setDistributorPrice(p == null ? '' : String(p));
          }}
        />
        <p className="text-[11px] text-gray-500">
          MSRP is always 2x the distributor price. You can refine margin and pricing (and upload files / photos) on the edit page after creating.
        </p>
        <div className="border-t border-gray-100 pt-4 space-y-3">
          <div className="flex items-center gap-2">
            <input type="checkbox" id="is_active" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="w-4 h-4" />
            <label htmlFor="is_active" className="text-sm font-medium text-gray-700">Active (visible on public site)</label>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="is_featured" checked={isFeatured} onChange={(e) => setIsFeatured(e.target.checked)} className="w-4 h-4" />
            <label htmlFor="is_featured" className="text-sm font-medium text-gray-700">Featured</label>
          </div>
        </div>
        </div>
      </div>
      </div>
    </div>
  );
}
