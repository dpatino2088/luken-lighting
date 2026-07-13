'use client';

import { useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { SkuFields } from '@/components/specsheet/SkuFields';
import { DEFAULT_TECH_ROWS, SUBCATEGORY_OPTIONS, type ConfigRow, type SpecSheetData, type TechRow } from '@/lib/sku/specSheet';
import { buildSku, cctKelvinFromCustom } from '@/lib/sku/skuRules';
import { cctRange, criValue, beamValue, wattsValue } from '@/lib/sku/mapToLuken';
import type { SpecSheetSync } from '@/components/specsheet/useSpecSheetSync';

type SubTab = 'general' | 'config' | 'tech' | 'notes';
const SUBTABS: { id: SubTab; label: string }[] = [
  { id: 'general', label: 'General data' },
  { id: 'config', label: 'Configurations' },
  { id: 'tech', label: 'Technical data' },
  { id: 'notes', label: 'Notes' },
];

const MATERIAL_OPTIONS = [
  'Aluminum',
  'Steel',
  'Stainless steel',
  'Metal',
  'Plastic',
  'Polycarbonate',
  'Brass',
  'Copper',
  'Bronze',
  'Zinc alloy',
  'Glass',
  'Wood',
  'Ceramic',
];

// Technical-data fields that are auto-derived from the Builder (Light quality /
// Power). They must not appear as editable manual rows (single source of truth).
const DERIVED_TECH_ALIASES = new Set([
  'color temperature', 'cct', 'cri', 'cri (minimum)', 'beam angle', 'beam',
  'system wattage', 'power', 'wattage',
]);
const isDerivedField = (campo: string) => DERIVED_TECH_ALIASES.has((campo || '').trim().toLowerCase());

const fieldClass =
  'w-full px-3 py-2 border border-gray-300 rounded-none bg-white text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent';
const labelClass = 'block text-xs font-medium uppercase tracking-wide text-gray-500 mb-1.5';
const subTabBtn = (active: boolean) =>
  'px-3 py-1.5 text-xs font-medium uppercase tracking-wide transition-colors ' +
  (active ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200');

/**
 * Controlled SKU + spec-sheet builder (construction inputs). Parent owns `data`
 * and the `sync` (SKU↔identity auto-sync via useSpecSheetSync). The built
 * identity (Name / Code / descriptions) is shown in the Product tab, not here.
 * `productNameEditable` lets the New flow type a name when no family is chosen;
 * the Edit/family flows pass a fixed name.
 */
export function VariantBuilderPanel({
  data,
  onChange,
  sync,
  productNameEditable = true,
}: {
  data: SpecSheetData;
  onChange: Dispatch<SetStateAction<SpecSheetData>>;
  sync: SpecSheetSync;
  productNameEditable?: boolean;
}) {
  const [tab, setTab] = useState<SubTab>('general');

  const { setSku, relinkAll } = sync;

  const set = <K extends keyof SpecSheetData>(key: K, value: SpecSheetData[K]) =>
    onChange((prev) => ({ ...prev, [key]: value }));

  // ── repeaters ──
  const updateConfig = (i: number, patch: Partial<ConfigRow>) =>
    onChange((prev) => ({ ...prev, configuraciones: prev.configuraciones.map((r, idx) => (idx === i ? { ...r, ...patch } : r)) }));
  const addConfig = () =>
    onChange((prev) => ({ ...prev, configuraciones: [...prev.configuraciones, { codigo: '', descripcion: '', componente: '' }] }));
  const removeConfig = (i: number) =>
    onChange((prev) => ({ ...prev, configuraciones: prev.configuraciones.filter((_, idx) => idx !== i) }));

  const updateTech = (i: number, patch: Partial<TechRow>) =>
    onChange((prev) => ({ ...prev, datosTecnicos: prev.datosTecnicos.map((r, idx) => (idx === i ? { ...r, ...patch } : r)) }));
  const addTech = () =>
    onChange((prev) => ({ ...prev, datosTecnicos: [...prev.datosTecnicos, { campo: '', valor: '', unidad: '' }] }));
  const removeTech = (i: number) =>
    onChange((prev) => ({ ...prev, datosTecnicos: prev.datosTecnicos.filter((_, idx) => idx !== i) }));
  const resetTech = () =>
    onChange((prev) => ({ ...prev, datosTecnicos: DEFAULT_TECH_ROWS.map((r) => ({ ...r })) }));

  const skuPreview = useMemo(() => buildSku(data.sku), [data.sku]);

  // Values the sheet auto-fills from the Builder (Light quality). Shown here as
  // read-only rows so the Technical data tab is never blank/confusing and the
  // user can see exactly what will appear on the ficha without retyping it.
  const derivedTech = useMemo(() => {
    const rows: { campo: string; valor: string; unidad: string }[] = [];
    const cct = data.sku.cct === 'CUSTOM' ? cctKelvinFromCustom(data.sku.cctCustom) : cctRange(data.sku.cct);
    if (cct.min != null) {
      rows.push({
        campo: 'Color temperature',
        valor: cct.max != null && cct.max !== cct.min ? `${cct.min}–${cct.max}` : `${cct.min}`,
        unidad: 'K',
      });
    }
    const cri = criValue(data.sku.cri === 'CUSTOM' ? data.sku.criCustom : data.sku.cri);
    if (cri != null) rows.push({ campo: 'CRI', valor: `${cri}+`, unidad: 'Ra' });
    const beam = beamValue(data.sku.optic === 'CUSTOM' ? data.sku.opticCustom : data.sku.optic);
    if (beam != null) rows.push({ campo: 'Beam angle', valor: `${beam}`, unidad: '°' });
    const watts = wattsValue(data.sku.watts === 'CUSTOM' ? data.sku.wattsCustom : data.sku.watts);
    if (watts != null) rows.push({ campo: 'System wattage', valor: `${watts}`, unidad: 'W' });
    return rows;
  }, [data.sku]);

  // Manual rows shown in "Additional measured values", excluding any that are
  // already auto-derived from the Builder (CCT/CRI/beam/System wattage) so the
  // same value is never editable in two places. Keep the original index so the
  // update/remove handlers still target the right row in datosTecnicos.
  const extraTechRows = data.datosTecnicos
    .map((t, i) => ({ t, i }))
    .filter(({ t }) => !isDerivedField(t.campo));

  return (
    <div className="space-y-6">
      {/* Subcategory — classifies the variant and drives the grouping / ordering
          / filtering of the public Product Codes list. Placed first (its own card,
          matching "Belongs to (family)"): start by choosing the subcategory, then
          continue. Field width ~1/3 to match the "Product (family)" field. */}
      <div className="bg-white border border-gray-200 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide mb-4">Subcategory</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className={labelClass}>Subcategory</label>
            <select className={fieldClass} value={data.subcategory} onChange={(e) => set('subcategory', e.target.value)}>
              <option value="">— choose —</option>
              {data.subcategory && !SUBCATEGORY_OPTIONS.includes(data.subcategory as (typeof SUBCATEGORY_OPTIONS)[number]) && (
                <option value={data.subcategory}>{data.subcategory}</option>
              )}
              {SUBCATEGORY_OPTIONS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>
        <p className="mt-3 text-[11px] text-gray-500">
          Groups, orders &amp; filters this code in the public <strong>Product Codes</strong> list (e.g. Downlights, Track Line Voltage, Accessories).
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5">
          {SUBTABS.map((t) => (
            <button key={t.id} type="button" onClick={() => setTab(t.id)} className={subTabBtn(tab === t.id)}>
              {t.label}
            </button>
          ))}
        </div>

        {/* General data (SKU generator + general fields + dimensions) */}
        <div hidden={tab !== 'general'} className="bg-white border border-gray-200 p-6 sm:p-8 space-y-8">
          {/* SKU generator */}
          <div className="space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wide">SKU generator</h3>
                <p className="mt-0.5 text-[11px] text-gray-500">
                  Builds the SKU, name and descriptions (shown in the <strong>Product</strong> tab). SKU:{' '}
                  <span className="font-mono">{skuPreview.shortCode || '—'}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={relinkAll}
                className="shrink-0 border border-gray-300 px-2.5 py-1 text-[11px] font-medium text-gray-600 hover:border-gray-400"
              >
                Re-apply
              </button>
            </div>
            <SkuFields state={data.sku} onChange={setSku} />
          </div>

          {/* General fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5 border-t border-gray-100 pt-8">
            <div className="sm:col-span-2">
              <label className={labelClass}>Product name (drives series: Draco → DRA)</label>
              <input
                className={fieldClass + (productNameEditable ? '' : ' bg-gray-100 text-gray-500')}
                value={data.productName}
                onChange={(e) => set('productName', e.target.value)}
                readOnly={!productNameEditable}
              />
            </div>
            <div>
              <label className={labelClass}>Brand / Line</label>
              <input className={fieldClass} value={data.brand} onChange={(e) => set('brand', e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Last updated</label>
              <input className={fieldClass} value={data.lastUpdate} onChange={(e) => set('lastUpdate', e.target.value)} placeholder="e.g. 30/06/2026" />
            </div>
            <div>
              <label className={labelClass}>IP rating</label>
              <select className={fieldClass} value={data.ipRating} onChange={(e) => set('ipRating', e.target.value)}>
                <option value="">— choose —</option>
                {['IP20', 'IP44', 'IP54', 'IP65', 'IP67', 'IP68'].map((ip) => (
                  <option key={ip} value={ip}>{ip}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Electrical class</label>
              <select className={fieldClass} value={data.electricalClass} onChange={(e) => set('electricalClass', e.target.value)}>
                <option value="">— choose —</option>
                <option value="Class I">Class I</option>
                <option value="Class II">Class II</option>
                <option value="Class III">Class III</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Material</label>
              <select className={fieldClass} value={data.material} onChange={(e) => set('material', e.target.value)}>
                <option value="">— choose —</option>
                {data.material && !MATERIAL_OPTIONS.includes(data.material) && (
                  <option value={data.material}>{data.material}</option>
                )}
                {MATERIAL_OPTIONS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Main image URL</label>
              <input className={fieldClass} value={data.photoUrl} onChange={(e) => set('photoUrl', e.target.value)} placeholder="https://…" />
            </div>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-4 border-t border-gray-100 pt-8">
              Dimensions
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-5">
              <div>
                <label className={labelClass}>Width (mm)</label>
                <input className={fieldClass} type="number" value={data.ancho} onChange={(e) => set('ancho', e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>Height (mm)</label>
                <input className={fieldClass} type="number" value={data.alto} onChange={(e) => set('alto', e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>Depth (mm)</label>
                <input className={fieldClass} type="number" value={data.fondo} onChange={(e) => set('fondo', e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>Weight (kg)</label>
                <input className={fieldClass} type="number" value={data.peso} onChange={(e) => set('peso', e.target.value)} />
              </div>
            </div>
          </div>

        </div>

        {/* Configurations */}
        <div hidden={tab !== 'config'} className="bg-white border border-gray-200 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wide">Configurations</h3>
            <button type="button" onClick={addConfig} className="bg-gray-900 text-white px-2.5 py-1 text-[11px] font-medium hover:bg-gray-700">
              + Configuration
            </button>
          </div>
          {data.configuraciones.map((c, i) => (
            <div key={i} className="flex items-end gap-2">
              <div className="grid flex-1 grid-cols-1 sm:grid-cols-3 gap-3">
                <input className={fieldClass} placeholder="Code" value={c.codigo} onChange={(e) => updateConfig(i, { codigo: e.target.value })} />
                <input className={fieldClass} placeholder="Description" value={c.descripcion} onChange={(e) => updateConfig(i, { descripcion: e.target.value })} />
                <input className={fieldClass} placeholder="Component" value={c.componente} onChange={(e) => updateConfig(i, { componente: e.target.value })} />
              </div>
              <button type="button" onClick={() => removeConfig(i)} className="mb-0.5 shrink-0 border border-red-200 bg-red-50 px-2 py-2 text-[11px] text-red-600 hover:border-red-300">
                Remove
              </button>
            </div>
          ))}
        </div>

        {/* Technical data */}
        <div hidden={tab !== 'tech'} className="bg-white border border-gray-200 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wide">Technical data (sheet)</h3>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={resetTech}
                className="border border-gray-300 px-2.5 py-1 text-[11px] font-medium text-gray-600 hover:border-gray-400"
              >
                Load default fields
              </button>
              <button type="button" onClick={addTech} className="bg-gray-900 text-white px-2.5 py-1 text-[11px] font-medium hover:bg-gray-700">
                + Row
              </button>
            </div>
          </div>
          <p className="text-[11px] text-gray-500">
            <strong>CCT, CRI, beam angle and System wattage are added to the sheet automatically</strong> from
            your Builder choices (Light quality / Power) — no need to retype them here. Use this table only for
            <strong> extra measured</strong> values (system / source lumens, source wattage, efficacy, MacAdam
            step, lifetime).
          </p>

          {/* Read-only preview of the values auto-filled from the Builder. */}
          {derivedTech.length > 0 && (
            <div className="border border-gray-200 bg-gray-50 p-3 space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                From Builder (auto-added to sheet)
              </p>
              {derivedTech.map((t, i) => (
                <div key={`d-${i}`} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input className={`${fieldClass} bg-gray-100 text-gray-500`} value={t.campo} readOnly tabIndex={-1} />
                  <input className={`${fieldClass} bg-gray-100 text-gray-500`} value={t.valor} readOnly tabIndex={-1} />
                  <input className={`${fieldClass} bg-gray-100 text-gray-500`} value={t.unidad} readOnly tabIndex={-1} />
                </div>
              ))}
            </div>
          )}

          <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 pt-1">
            Additional measured values
          </p>
          {extraTechRows.length === 0 && (
            <p className="text-[11px] text-gray-400 italic">
              None yet. Click <strong>“Load default fields”</strong> for the standard template, or “+ Row” to add your own.
            </p>
          )}
          {extraTechRows.map(({ t, i }) => (
            <div key={i} className="flex items-end gap-2">
              <div className="grid flex-1 grid-cols-1 sm:grid-cols-3 gap-3">
                <input className={fieldClass} placeholder="Field" value={t.campo} onChange={(e) => updateTech(i, { campo: e.target.value })} readOnly={t.locked} />
                <input className={fieldClass} placeholder="Value" value={t.valor} onChange={(e) => updateTech(i, { valor: e.target.value })} />
                <input className={fieldClass} placeholder="Unit" value={t.unidad} onChange={(e) => updateTech(i, { unidad: e.target.value })} readOnly={t.locked} />
              </div>
              <button type="button" onClick={() => removeTech(i)} className="mb-0.5 shrink-0 border border-red-200 bg-red-50 px-2 py-2 text-[11px] text-red-600 hover:border-red-300">
                Remove
              </button>
            </div>
          ))}
        </div>

        {/* Notes */}
        <div hidden={tab !== 'notes'} className="bg-white border border-gray-200 p-5 space-y-4">
          <div>
            <label className={labelClass}>Certifications (comma separated: IP20, CE…)</label>
            <input className={fieldClass} value={data.iconList} onChange={(e) => set('iconList', e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Control notes</label>
            <textarea rows={3} className={fieldClass} value={data.controlNotes} onChange={(e) => set('controlNotes', e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Legal note / footer</label>
            <input className={fieldClass} value={data.footerNote} onChange={(e) => set('footerNote', e.target.value)} />
          </div>
        </div>
    </div>
  );
}
