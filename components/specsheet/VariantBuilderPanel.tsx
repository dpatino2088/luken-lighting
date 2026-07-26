'use client';

import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { SkuFields } from '@/components/specsheet/SkuFields';
import { RelatedVariantsEditor } from '@/components/specsheet/RelatedVariantsEditor';
import {
  applyFamilyName,
  DEFAULT_TECH_ROWS,
  SUBCATEGORY_OPTIONS,
  isAccessoriesType,
  isTrackType,
  isProfileType,
  syncIdentityFromSku,
  type SpecSheetData,
  type TechRow,
} from '@/lib/sku/specSheet';
import {
  buildSku,
  cctKelvinFromCustom,
  enterAccessorySkuMode,
  leaveAccessorySkuMode,
  isTrackCodeAllowed,
  type SkuState,
} from '@/lib/sku/skuRules';
import { cctRange, criValue, beamValue, wattsValue } from '@/lib/sku/mapToLuken';
import type { SpecSheetSync } from '@/components/specsheet/useSpecSheetSync';
import { AdminSelect } from '@/components/ui/AdminSelect';

type SubTab = 'general' | 'config' | 'tech' | 'notes';
const SUBTABS: { id: SubTab; label: string }[] = [
  { id: 'general', label: 'General data' },
  { id: 'config', label: 'Related Variant' },
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
  /** Selected product-family name — Re-apply uses this so the series follows the family. */
  familyName = null,
  /** Families for the Related Variant picker. */
  products = [],
  /** Current family id — Related Variant filter defaults to this. */
  currentProductId = null,
  /** Exclude this variant from the Related Variant checkbox list. */
  currentVariantId = null,
}: {
  data: SpecSheetData;
  onChange: Dispatch<SetStateAction<SpecSheetData>>;
  sync: SpecSheetSync;
  productNameEditable?: boolean;
  familyName?: string | null;
  products?: { id: string; name: string }[];
  currentProductId?: string | null;
  currentVariantId?: string | null;
}) {
  const [tab, setTab] = useState<SubTab>('general');

  const { setSku, relinkAll } = sync;
  const accessoryMode = isAccessoriesType(data.subcategory);
  const trackMode = isTrackType(data.subcategory);
  const profileMode = isProfileType(data.subcategory);

  // Type = Accessories owns accessory SKU mode (SERIES-ACC-…). Shape stays geometry-only.
  useEffect(() => {
    if (accessoryMode && data.sku.shape !== 'ACC') {
      setSku(enterAccessorySkuMode(data.sku));
    } else if (!accessoryMode && data.sku.shape === 'ACC') {
      setSku(leaveAccessorySkuMode(data.sku));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessoryMode]);

  const handleReapply = () => {
    if (familyName?.trim()) {
      onChange((prev) => applyFamilyName(prev, familyName));
      return;
    }
    relinkAll();
  };

  const set = <K extends keyof SpecSheetData>(key: K, value: SpecSheetData[K]) =>
    onChange((prev) => ({ ...prev, [key]: value }));

  /** Clear fixture photometrics — tracks are not light engines. Keep trim (TRM/TRL). */
  const clearPhotometrics = (sku: SkuState): SkuState => ({
    ...sku,
    source: '',
    socket: '',
    socketCustom: '',
    cri: '',
    criCustom: '',
    cct: '',
    cctCustom: '',
    optic: '',
    opticCustom: '',
    watts: '',
    wattsCustom: '',
  });

  const setType = (subcategory: string) => {
    onChange((prev) => {
      const wasAcc = isAccessoriesType(prev.subcategory);
      const nowAcc = isAccessoriesType(subcategory);
      const nowTrack = isTrackType(subcategory);
      const nowProfile = isProfileType(subcategory);
      let sku = prev.sku;

      if (nowAcc && !wasAcc) sku = enterAccessorySkuMode(sku);
      else if (!nowAcc && wasAcc) sku = leaveAccessorySkuMode(sku);

      if (nowTrack) {
        sku = clearPhotometrics({
          ...sku,
          profile: '',
          profileKind: '',
          // Size / format and linear shape do not apply — length (mm) stays (1 m / 2 m / …).
          dim: '',
          dimCustom: '',
          shape: sku.shape === 'L' ? '' : sku.shape,
          track: isTrackCodeAllowed(sku.track, subcategory) ? sku.track : '',
        });
      } else if (nowProfile) {
        sku = clearPhotometrics({
          ...sku,
          track: '',
          dim: '',
          dimCustom: '',
          mounting: '', // Hidden in Profiles — Profile type owns SUR/REC/PEN in the SKU
          shape: sku.shape === 'L' ? '' : sku.shape,
          // Length stays (1 m / 2 m / …). Default kind to Profile if extrusion style already set.
          profileKind: sku.profileKind || (sku.profile ? 'PRF' : ''),
        });
      } else if (!nowAcc) {
        // Normal fixture: drop track/profile identity leftovers (keep length only if shape L).
        sku = {
          ...sku,
          track: '',
          profile: '',
          profileKind: '',
          length: sku.shape === 'L' ? sku.length : '',
        };
      }

      return syncIdentityFromSku({ ...prev, subcategory, sku });
    });
  };

  // ── repeaters ──
  const updateTech = (i: number, patch: Partial<TechRow>) =>
    onChange((prev) => ({ ...prev, datosTecnicos: prev.datosTecnicos.map((r, idx) => (idx === i ? { ...r, ...patch } : r)) }));
  const addTech = () =>
    onChange((prev) => ({ ...prev, datosTecnicos: [...prev.datosTecnicos, { campo: '', valor: '', unidad: '' }] }));
  const removeTech = (i: number) =>
    onChange((prev) => ({ ...prev, datosTecnicos: prev.datosTecnicos.filter((_, idx) => idx !== i) }));
  const resetTech = () =>
    onChange((prev) => ({ ...prev, datosTecnicos: DEFAULT_TECH_ROWS.map((r) => ({ ...r })) }));

  const skuPreview = useMemo(() => buildSku(data.sku), [data.sku]);

  // Lumen (system luminous flux) is a General-data attribute, edited here and
  // stored in the "System lumens" Technical-data row (→ variant.lumens_system).
  // It is intentionally NOT part of the SKU.
  const systemLumens =
    data.datosTecnicos.find((t) => (t.campo || '').trim().toLowerCase() === 'system lumens')?.valor ?? '';
  const setSystemLumens = (value: string) =>
    onChange((prev) => {
      const idx = prev.datosTecnicos.findIndex(
        (t) => (t.campo || '').trim().toLowerCase() === 'system lumens'
      );
      if (idx >= 0) {
        return {
          ...prev,
          datosTecnicos: prev.datosTecnicos.map((r, i) => (i === idx ? { ...r, valor: value } : r)),
        };
      }
      return {
        ...prev,
        datosTecnicos: [...prev.datosTecnicos, { campo: 'System lumens', valor: value, unidad: 'lm', locked: true }],
      };
    });

  // Values the sheet auto-fills from the Builder (Light quality / Power).
  // Always show the four rows (filled or "—") so Technical data is never blank
  // and the user can see what is still missing in General data.
  const derivedTech = useMemo(() => {
    const cct = data.sku.cct === 'CUSTOM' ? cctKelvinFromCustom(data.sku.cctCustom) : cctRange(data.sku.cct);
    const cctValor =
      cct.min != null
        ? cct.max != null && cct.max !== cct.min
          ? `${cct.min}–${cct.max}`
          : `${cct.min}`
        : '—';
    const cri = criValue(data.sku.cri === 'CUSTOM' ? data.sku.criCustom : data.sku.cri);
    const beam = beamValue(data.sku.optic === 'CUSTOM' ? data.sku.opticCustom : data.sku.optic);
    const watts = wattsValue(data.sku.watts === 'CUSTOM' ? data.sku.wattsCustom : data.sku.watts);
    return [
      { campo: 'Color temperature', valor: cctValor, unidad: 'K' },
      { campo: 'CRI', valor: cri != null ? `${cri}+` : '—', unidad: 'Ra' },
      { campo: 'Beam angle', valor: beam != null ? `${beam}` : '—', unidad: '°' },
      { campo: 'System wattage', valor: watts != null ? `${watts}` : '—', unidad: 'W' },
    ];
  }, [data.sku]);

  // Manual rows shown in "Additional measured values", excluding any that are
  // already auto-derived from the Builder (CCT/CRI/beam/System wattage) so the
  // same value is never editable in two places. Keep the original index so the
  // update/remove handlers still target the right row in datosTecnicos.
  const extraTechRows = data.datosTecnicos
    .map((t, i) => ({ t, i }))
    // "System lumens" is edited in General data (Lumen field), so hide it here
    // to avoid a confusing double entry of the same value.
    .filter(({ t }) => !isDerivedField(t.campo) && (t.campo || '').trim().toLowerCase() !== 'system lumens');

  return (
    <div className="space-y-6">
      {/* Type (stored as subcategory) — classifies the variant and drives the
          grouping / ordering / filtering of the public Product Codes list.
          Placed first (its own card, matching "Belongs to (family)"): start by
          choosing the type, then continue. Field width ~1/3 to match family. */}
      <div className="bg-white border border-gray-200 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide mb-4">Type</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className={labelClass}>Type</label>
            <AdminSelect
              aria-label="Type"
              value={data.subcategory}
              onChange={setType}
              placeholder="— choose —"
              options={[
                ...(data.subcategory &&
                !SUBCATEGORY_OPTIONS.includes(data.subcategory as (typeof SUBCATEGORY_OPTIONS)[number])
                  ? [{ value: data.subcategory, label: data.subcategory }]
                  : []),
                ...SUBCATEGORY_OPTIONS.map((s) => ({ value: s, label: s })),
              ]}
            />
          </div>
        </div>
        <p className="mt-3 text-[11px] text-gray-500">
          {accessoryMode ? (
            <>
              Type <strong>Accessories</strong> unlocks accessory fields and builds SKUs like{' '}
              <span className="font-mono">ORI-ACC-CLIP-WH</span>.
            </>
          ) : trackMode ? (
            <>
              Type <strong>Track</strong> shows track-system identity only — no Profile, Light Source or Light
              Quality.
            </>
          ) : profileMode ? (
            <>
              Type <strong>LED Profiles</strong>: choose Diffuser or Profile, then length (like Track).
            </>
          ) : (
            <>
              Groups, orders &amp; filters this code in the public <strong>Product Codes</strong> list. Choose{' '}
              <strong>Track</strong> / <strong>LED Profiles</strong> / <strong>Accessories</strong> for those
              builders.
            </>
          )}
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
                onClick={handleReapply}
                className="shrink-0 border border-gray-300 px-2.5 py-1 text-[11px] font-medium text-gray-600 hover:border-gray-400"
                title={
                  familyName
                    ? `Re-derive series from family “${familyName}”`
                    : 'Re-derive series from product name'
                }
              >
                Re-apply
              </button>
            </div>
            <SkuFields
              state={data.sku}
              onChange={setSku}
              lumen={systemLumens}
              onLumenChange={setSystemLumens}
              accessoryMode={accessoryMode}
              trackMode={trackMode}
              profileMode={profileMode}
              subcategory={data.subcategory}
            />
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
              <input
                className={fieldClass + ' bg-gray-100 text-gray-500'}
                value={data.lastUpdate || '— set automatically on save —'}
                readOnly
                tabIndex={-1}
                title="Updated automatically when you save the builder"
              />
            </div>
            <div>
              <label className={labelClass}>IP rating</label>
              <AdminSelect
                aria-label="IP rating"
                value={data.ipRating}
                onChange={(v) => set('ipRating', v)}
                options={['IP20', 'IP44', 'IP54', 'IP65', 'IP67', 'IP68'].map((ip) => ({
                  value: ip,
                  label: ip,
                }))}
              />
            </div>
            <div>
              <label className={labelClass}>Electrical class</label>
              <AdminSelect
                aria-label="Electrical class"
                value={data.electricalClass}
                onChange={(v) => set('electricalClass', v)}
                options={[
                  { value: 'Class I', label: 'Class I' },
                  { value: 'Class II', label: 'Class II' },
                  { value: 'Class III', label: 'Class III' },
                ]}
              />
            </div>
            <div>
              <label className={labelClass}>Material</label>
              <AdminSelect
                aria-label="Material"
                value={data.material}
                onChange={(v) => set('material', v)}
                options={[
                  ...(data.material && !MATERIAL_OPTIONS.includes(data.material)
                    ? [{ value: data.material, label: data.material }]
                    : []),
                  ...MATERIAL_OPTIONS.map((m) => ({ value: m, label: m })),
                ]}
              />
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

        {/* Related variants (stored as configuraciones in the sheet model) */}
        <div hidden={tab !== 'config'} className="bg-white border border-gray-200 p-5">
          <RelatedVariantsEditor
            products={products}
            currentProductId={currentProductId}
            currentVariantId={currentVariantId}
            rows={data.configuraciones}
            onChange={(configuraciones) => onChange((prev) => ({ ...prev, configuraciones }))}
          />
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
            {trackMode || profileMode ? (
              <>
                {trackMode ? 'Track' : 'LED Profile'} products do not use Light Source / Light Quality. Add any
                measured values (e.g. voltage, circuit rating) in the table below.
              </>
            ) : (
              <>
                <strong>CCT, CRI, beam angle and System wattage</strong> come from{' '}
                <strong>General data → Light quality / Power</strong> (set them there). Values marked “—” are
                not filled yet. Use the table below only for <strong>extra measured</strong> values.
                <strong> Lumen (system)</strong> is set in <strong>General data</strong>.
              </>
            )}
          </p>

          {/* Auto fields from Builder — hidden for track / profile (no photometrics). */}
          <div
            className="border border-gray-200 bg-gray-50 p-3 space-y-2"
            hidden={trackMode || profileMode}
          >
            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
              From Builder (auto-added to sheet)
            </p>
            {derivedTech.map((t, i) => (
              <div key={`d-${i}`} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input className={`${fieldClass} bg-gray-100 text-gray-500`} value={t.campo} readOnly tabIndex={-1} />
                <input
                  className={`${fieldClass} bg-gray-100 ${t.valor === '—' ? 'text-gray-400 italic' : 'text-gray-700'}`}
                  value={t.valor}
                  readOnly
                  tabIndex={-1}
                  title={t.valor === '—' ? 'Set this in General data → Light quality / Power' : undefined}
                />
                <input className={`${fieldClass} bg-gray-100 text-gray-500`} value={t.unidad} readOnly tabIndex={-1} />
              </div>
            ))}
          </div>

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
