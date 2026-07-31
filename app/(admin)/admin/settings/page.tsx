'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Save, Upload, Trash2, Image as ImageIcon } from 'lucide-react';
import { getSettings, updateSettings } from './actions';
import { convertToEur, formatUsd, formatEur } from '@/lib/pricing';
import { createClient } from '@/lib/supabase/client';
import { toast } from '@/components/ui/Toast';
import { LabelTemplatesManager } from '@/components/label/LabelTemplatesManager';
import type { AppSettings } from '@/lib/types';

const EXAMPLE_USD = 10;

type Tab = 'currency' | 'logo' | 'labels' | 'sheet';

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<Tab>('currency');
  const [eurRate, setEurRate] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [labelLogoUrl, setLabelLogoUrl] = useState('');
  const [sheetFooter, setSheetFooter] = useState('');
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingLabelLogo, setUploadingLabelLogo] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const labelLogoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getSettings().then((s) => {
      setSettings(s);
      setEurRate(String(s.eur_to_usd_rate));
      setLogoUrl(s.brand_logo_url || '');
      setLabelLogoUrl(s.label_logo_url || '');
      setSheetFooter(s.sheet_footer_note || '');
    });
  }, []);

  const uploadLogo = async (file: File, prefix: string): Promise<string> => {
    const supabase = createClient();
    if (!supabase) throw new Error('Supabase not configured');
    const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
    const filePath = `brand/${prefix}-${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from('product-images')
      .upload(filePath, file, { upsert: true });
    if (uploadError) throw new Error(uploadError.message);
    const { data: urlData } = supabase.storage.from('product-images').getPublicUrl(filePath);
    return urlData.publicUrl;
  };

  const handleLogoFile = async (file: File) => {
    setUploadingLogo(true);
    try {
      setLogoUrl(await uploadLogo(file, 'logo'));
    } catch (err: any) {
      toast.error(err.message || 'Upload failed');
    }
    setUploadingLogo(false);
  };

  const handleLabelLogoFile = async (file: File) => {
    setUploadingLabelLogo(true);
    try {
      setLabelLogoUrl(await uploadLogo(file, 'label-logo'));
    } catch (err: any) {
      toast.error(err.message || 'Upload failed');
    }
    setUploadingLabelLogo(false);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);

    const formData = new FormData();
    formData.set('eur_to_usd_rate', eurRate || '1.2');
    formData.set('brand_logo_url', logoUrl);
    formData.set('label_logo_url', labelLogoUrl);
    formData.set('sheet_footer_note', sheetFooter);
    const result = await updateSettings(formData);

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success('Settings saved successfully.');
    }
    setSaving(false);
  };

  const rate = Number(eurRate) || 0;

  if (!settings) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-light tracking-widest uppercase mb-2">Settings</h1>
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  const tabClass = (t: Tab) =>
    `px-4 py-2 text-sm border-b-2 -mb-px transition-colors ${
      tab === t
        ? 'border-gray-900 text-gray-900 font-medium'
        : 'border-transparent text-gray-500 hover:text-gray-800'
    }`;

  return (
    // Labels get the full width: that tab is a drawing board, and the artwork
    // preview is only useful at a size you can actually judge type against.
    <div className={`space-y-6 ${tab === 'labels' ? 'max-w-6xl' : 'max-w-3xl'}`}>
      <div>
        <h1 className="text-3xl font-light tracking-widest uppercase mb-2">Settings</h1>
        <p className="text-gray-600">Currency conversion and brand assets</p>
      </div>

      <div className="flex gap-1 border-b border-gray-200">
        <button type="button" className={tabClass('currency')} onClick={() => setTab('currency')}>
          Currency
        </button>
        <button type="button" className={tabClass('logo')} onClick={() => setTab('logo')}>
          Brand Logo
        </button>
        <button type="button" className={tabClass('labels')} onClick={() => setTab('labels')}>
          Labels
        </button>
        <button type="button" className={tabClass('sheet')} onClick={() => setTab('sheet')}>
          Spec Sheet
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {tab === 'currency' && (
          <>
            <section className="bg-white border border-gray-200 p-6 space-y-5">
              <h2 className="text-lg font-medium uppercase tracking-wide border-b border-gray-200 pb-3">
                Currency Conversion
              </h2>
              <div className="max-w-xs">
                <label className="block text-sm font-medium text-gray-700 mb-1">EUR to USD Rate</label>
                <input
                  name="eur_to_usd_rate"
                  type="number"
                  step="0.0001"
                  min="0.0001"
                  value={eurRate}
                  onChange={(e) => setEurRate(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-none focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent text-gray-900"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">1 EUR = {eurRate || '—'} USD</p>
              </div>
            </section>

            {/* Live Preview */}
            <section className="bg-gray-50 border border-gray-200 p-6 space-y-3">
              <h2 className="text-sm font-medium uppercase tracking-wide text-gray-500">Preview</h2>
              <p className="text-sm text-gray-700">
                {formatUsd(EXAMPLE_USD)} = {rate > 0 ? formatEur(convertToEur(EXAMPLE_USD, rate)) : '—'}
              </p>
            </section>
          </>
        )}

        {tab === 'logo' && (
          <section className="bg-white border border-gray-200 p-6 space-y-5">
            <h2 className="text-lg font-medium uppercase tracking-wide border-b border-gray-200 pb-3">
              Brand Logo
            </h2>
            <p className="text-sm text-gray-600">
              This logo appears in the top-right of every spec sheet header, both in the live Preview
              and the exported PDF. Use a transparent PNG or SVG for best results.
            </p>

            <input
              type="file"
              ref={logoInputRef}
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleLogoFile(file);
                e.target.value = '';
              }}
            />

            <div className="flex items-center gap-6">
              <div className="w-56 h-28 border border-gray-200 bg-white flex items-center justify-center overflow-hidden">
                {logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logoUrl} alt="Brand logo" className="max-h-full max-w-full object-contain p-2" />
                ) : (
                  <div className="flex flex-col items-center text-gray-400">
                    <ImageIcon className="w-6 h-6 mb-1" />
                    <span className="text-xs">No logo</span>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={uploadingLogo}
                  onClick={() => logoInputRef.current?.click()}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  {uploadingLogo ? 'Uploading...' : logoUrl ? 'Replace logo' : 'Upload logo'}
                </Button>
                {logoUrl && (
                  <button
                    type="button"
                    onClick={() => setLogoUrl('')}
                    className="flex items-center gap-1 text-sm text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4" />
                    Remove logo
                  </button>
                )}
              </div>
            </div>
            <p className="text-xs text-gray-500">
              Changes take effect after you click “Save Settings”.
            </p>
          </section>
        )}

        {tab === 'labels' && (
          <section className="bg-white border border-gray-200 p-6 space-y-5">
            <h2 className="text-lg font-medium uppercase tracking-wide border-b border-gray-200 pb-3">
              Label Logo
            </h2>
            <p className="text-sm text-gray-600">
              Printed on every product label, at the same size on all templates. Upload it as{' '}
              <strong>SVG</strong>: the rest of the label is vector, so a bitmap logo would be the one
              element that blurs when the factory scales the artwork.
            </p>

            <input
              type="file"
              ref={labelLogoInputRef}
              accept=".svg,image/svg+xml,image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleLabelLogoFile(file);
                e.target.value = '';
              }}
            />

            <div className="flex items-center gap-6">
              <div className="w-56 h-28 border border-gray-200 bg-[#231F20] flex items-center justify-center overflow-hidden">
                {labelLogoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={labelLogoUrl} alt="Label logo" className="max-h-full max-w-full object-contain p-3" />
                ) : (
                  <div className="flex flex-col items-center text-gray-500">
                    <ImageIcon className="w-6 h-6 mb-1" />
                    <span className="text-xs">No logo</span>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={uploadingLabelLogo}
                  onClick={() => labelLogoInputRef.current?.click()}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  {uploadingLabelLogo ? 'Uploading...' : labelLogoUrl ? 'Replace logo' : 'Upload logo'}
                </Button>
                {labelLogoUrl && (
                  <button
                    type="button"
                    onClick={() => setLabelLogoUrl('')}
                    className="flex items-center gap-1 text-sm text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4" />
                    Remove logo
                  </button>
                )}
              </div>
            </div>
            <p className="text-xs text-gray-500">
              Shown on a dark swatch because labels print on the near-black brand field.
            </p>
          </section>
        )}

        {tab === 'sheet' && (
          <section className="bg-white border border-gray-200 p-6 space-y-5">
            <h2 className="text-lg font-medium uppercase tracking-wide border-b border-gray-200 pb-3">
              Spec Sheet
            </h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Footer web</label>
              <input
                type="text"
                value={sheetFooter}
                onChange={(e) => setSheetFooter(e.target.value)}
                placeholder="www.lukenlighting.com"
                className="w-full max-w-md px-4 py-2.5 border border-gray-300 rounded-none focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent text-gray-900"
              />
              <p className="text-xs text-gray-500 mt-2">
                Printed at the bottom of every spec sheet. Variants that never overrode it pick up
                changes made here, so updating the address once reaches every sheet. A variant can
                still be given different wording from its <strong>Builder → Notes</strong> tab.
              </p>
            </div>
          </section>
        )}

        <div className={`flex items-center gap-4 pt-2 ${tab === 'labels' ? '' : 'pb-8'}`}>
          <Button type="submit" variant="primary" disabled={saving}>
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      </form>

      {/* Outside the settings form on purpose: a template is a row of its own that
          saves immediately, and nesting its inputs here would let Enter submit the
          surrounding form instead. */}
      {tab === 'labels' && (
        <div className="pb-8">
          <LabelTemplatesManager labelLogoUrl={labelLogoUrl || null} />
        </div>
      )}
    </div>
  );
}
