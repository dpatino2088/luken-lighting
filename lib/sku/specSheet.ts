// ──────────────────────────────────────────────────────────────────────────
//  Spec Sheet model — ported from the SpecBuilder project.
//  Single source of truth for the technical data sheet shape, default data
//  and helpers shared by the editor, the live preview and the PDF export.
// ──────────────────────────────────────────────────────────────────────────

import type { SkuResult, SkuState } from './skuRules';
import { EMPTY_SKU_STATE, buildSku, copyMarker, hasCopyMarker } from './skuRules';

export interface ConfigRow {
  /** Long/Short SKU — used for matching; not the primary UI label. */
  codigo: string;
  /** Product / variant display name (first field in Builder + Spec Sheet). */
  nombre?: string;
  /** Short / commercial description (second field). */
  descripcion: string;
  componente: string;
  /** Stable link to product_variants. */
  variantId?: string;
}

export interface ColorRow {
  nombre: string;
  codigo: string;
}

export interface TechRow {
  campo: string;
  valor: string;
  unidad: string;
  /** locked rows come from the default template (field/unit are readonly). */
  locked?: boolean;
}

/**
 * Per-field auto/manual sync flags for the identity fields. `true` = the field
 * is auto-synced from the SKU; `false` = the user overrode it by hand.
 */
export interface LinkFlags {
  name: boolean;
  code: boolean;
  codeDescription: boolean;
  description: boolean;
}

export interface SpecSheetData {
  productName: string;
  /** Commercial name: productName + short SKU body (e.g. "Orion 65R GU10 WH"). */
  name: string;
  brand: string;
  lastUpdate: string;
  code: string;
  codeDescription: string;
  description: string;
  /** General product subcategory (e.g. "Downlights", "Track Line Voltage",
   *  "Accessories"). Used to group / order / filter the public Product Codes
   *  list. Not part of the SKU. */
  subcategory: string;
  /** Structured product attributes (not derivable from the SKU) — Builder owns these. */
  ipRating: string;
  material: string;
  electricalClass: string;
  equipo: string;
  ancho: string;
  alto: string;
  fondo: string;
  peso: string;
  iconList: string;
  controlNotes: string;
  footerNote: string;
  /** Image URLs (Luken stores uploaded images in Supabase Storage, not inline). */
  photoUrl: string;
  diagramUrl: string;
  configuraciones: ConfigRow[];
  colores: ColorRow[];
  datosTecnicos: TechRow[];
  /** SKU generator state embedded so the sheet can be re-edited later. */
  sku: SkuState;
  /**
   * Auto/manual state for the identity fields. Persisted so a hand override
   * (name / code / descriptions) survives a reload instead of being clobbered
   * by the SKU auto-sync.
   */
  link: LinkFlags;
  /** Whether the SKU series auto-derives from the product/family name. */
  seriesLinked: boolean;
}

// General product subcategories (from the SpecBuilder taxonomy). This is the
// single source of truth for the Builder dropdown AND the public grouping order
// (sections render top-to-bottom in this order; anything unset falls into
// "Other" at the very end). Luminaires first → sources / systems → outdoor →
// bulbs / power → tools / accessories last.
export const SUBCATEGORY_OPTIONS = [
  'Downlights',
  'Spotlights',
  'Wall / Ceiling',
  'Suspension',
  'General Lighting',
  'Lineal Light',
  'Track Line Voltage',
  'Track Low Voltage',
  'Systems',
  'LED Profiles',
  'LED Strips',
  'Landscape / Outdoor',
  'In-Ground',
  'Pole Mounted',
  'Table / Floor',
  'Emergency',
  'Fans',
  'LED Bulbs & Modules',
  'Power & Control',
  'Tool',
  'Accessories',
] as const;

/** Type = Accessories drives accessory SKU mode (SERIES-ACC-…) — not Shape. */
export function isAccessoriesType(subcategory: string | null | undefined): boolean {
  return (subcategory || '').trim().toLowerCase() === 'accessories';
}

/** Type = Track Line Voltage / Track Low Voltage → track identity SKU (no fixture photometrics). */
export function isTrackType(subcategory: string | null | undefined): boolean {
  const s = (subcategory || '').trim().toLowerCase();
  return s === 'track line voltage' || s === 'track low voltage';
}

/** Type = LED Profiles → profile identity SKU (mutually exclusive with track). */
export function isProfileType(subcategory: string | null | undefined): boolean {
  return (subcategory || '').trim().toLowerCase() === 'led profiles';
}

/**
 * Related Variant “Component” = Type (subcategory) as stored on the variant’s
 * sheet. Never invent Shape / Fixture / mounting labels.
 */
export function componentFromType(subcategory: string | null | undefined): string {
  return (subcategory || '').trim();
}

export const MONTAJE_OPTIONS = [
  'Recessed',
  'Surface mounted',
  'Suspended / Pendant',
  'Ceiling mounted',
  'Wall mounted',
  'Track mounted',
  'In-ground / In-grade',
  'Floor standing',
  'Table / Desk',
  'Portable',
  'Bollard / Post',
  'Pole mounted',
  'Step / Stair',
  'Underwater',
] as const;

// Only EXTRA measured values live here. CCT, CRI, beam angle and System wattage
// are NOT included because they come from the Builder dropdowns and are
// auto-added to the sheet (see SheetPreview `derivedTech`). Keeping them here
// would duplicate them.
// Placeholders use EMPTY values (not "0") so an unfilled template row never
// writes a bogus 0 into the variant photometric columns. LED lifespan keeps a
// sensible default text.
export const DEFAULT_TECH_ROWS: TechRow[] = [
  { campo: 'System lumens', valor: '', unidad: 'lm', locked: true },
  { campo: 'MacAdam step', valor: '', unidad: 'SDCM', locked: true },
  { campo: 'Source lumens', valor: '', unidad: 'lm', locked: true },
  { campo: 'LED lifespan', valor: '>50,000h L80 B10', unidad: 'h', locked: true },
  { campo: 'Source wattage', valor: '', unidad: 'W', locked: true },
  { campo: 'Luminous efficacy', valor: '', unidad: 'lm/W', locked: true },
  { campo: 'Emergency mode lumens', valor: '', unidad: 'lm', locked: true },
  { campo: 'Emission flux > 90°', valor: '', unidad: 'lm', locked: true },
  { campo: 'Light Output Ratio (L.O.R.)', valor: '', unidad: '%', locked: true },
];

/** Spec-sheet “Last updated” stamp (DD/MM/YYYY), set automatically on save. */
export function formatSheetDate(d: Date = new Date()): string {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

/** Stamp `lastUpdate` to today before persisting the sheet. */
export function withAutoLastUpdate(data: SpecSheetData, d: Date = new Date()): SpecSheetData {
  return { ...data, lastUpdate: formatSheetDate(d) };
}

export function createDefaultSpecSheet(): SpecSheetData {
  return {
    productName: '',
    name: '',
    brand: 'Luken',
    lastUpdate: '',
    code: '',
    codeDescription: '',
    description: '',
    subcategory: '',
    ipRating: '',
    material: '',
    electricalClass: '',
    equipo: '',
    ancho: '',
    alto: '',
    fondo: '',
    peso: '',
    iconList: '',
    controlNotes: '',
    footerNote: '',
    photoUrl: '',
    diagramUrl: '',
    configuraciones: [{ codigo: '', nombre: '', descripcion: '', componente: '' }],
    colores: [{ nombre: '', codigo: '' }],
    // Technical data starts empty on purpose: it is only for ADDITIONAL fields
    // that are not already derived from the SKU or the General data / Builder.
    datosTecnicos: [],
    sku: { ...EMPTY_SKU_STATE },
    link: { name: true, code: true, codeDescription: true, description: true },
    seriesLinked: true,
  };
}

/** Deep clone for duplicating a sheet without shared references. */
export function cloneSpecSheet(data: SpecSheetData): SpecSheetData {
  return {
    ...data,
    configuraciones: data.configuraciones.map((c) => ({ ...c })),
    colores: data.colores.map((c) => ({ ...c })),
    datosTecnicos: data.datosTecnicos.map((t) => ({ ...t })),
    sku: { ...data.sku },
    link: { ...data.link },
  };
}

// Series = first 3 letters of EACH word in the family name (joined by "-"),
// plus any trailing number. e.g.
//   "Alhena 15"   → "ALH15"
//   "Santorini"   → "SAN"
//   "Draco Point" → "DRA-POI"
export function deriveSeries(name: string): string {
  const cleaned = (name || '').trim();
  if (!cleaned) return '';
  const trailingNum = cleaned.match(/(\d+)\s*$/)?.[1] ?? '';
  const words = cleaned
    .split(/\s+/)
    .map((w) => w.replace(/[^A-Za-z]/g, ''))
    .filter(Boolean)
    .map((w) => w.slice(0, 3).toUpperCase());
  return words.join('-') + trailingNum;
}

/**
 * The primary luminous flux to surface as "Lumen" (a General-data attribute and
 * a description token). Prefers the System lumens value; falls back to Source
 * lumens. Reads from the Technical-data rows so it is NOT part of the SKU.
 * Returns null when neither has a value.
 */
export function primaryLumen(
  d: SpecSheetData
): { campo: string; value: string; unit: string } | null {
  const rows = d.datosTecnicos || [];
  const findRow = (name: string) =>
    rows.find((t) => (t.campo || '').trim().toLowerCase() === name && (t.valor || '').trim());
  const row = findRow('system lumens') ?? findRow('source lumens');
  if (!row) return null;
  return {
    campo: (row.campo || '').trim(),
    value: (row.valor || '').trim(),
    unit: (row.unidad || '').trim() || 'lm',
  };
}

/**
 * What the sheet prints under Certifications.
 *
 * The IP rating is a certification, and it is already answered once in
 * Characteristics, so it leads the list instead of being typed a second time —
 * the free-text field is for what the IP cannot say (CE, RoHS, ETL…). A rating
 * that was also typed by hand is not repeated, whatever case it was typed in.
 */
export function certificationList(d: SpecSheetData): string[] {
  const typed = (d.iconList || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const ip = (d.ipRating || '').trim();
  if (!ip) return typed;
  const same = (s: string) => s.toLowerCase() === ip.toLowerCase();
  return [ip, ...typed.filter((s) => !same(s))];
}

// The auto description = the SKU long description (which already carries the
// mounting type, since it is a SKU segment) + the luminous flux (Lumen) + the
// structured product attributes owned by the Builder (material, IP rating,
// electrical class) so the description reflects the full product.
//
// The flux is read from the Technical data (System/Source lumens), never from the
// SKU, but it still reads where the Builder asks for it — after the socket, before
// the CRI — so the description can be checked against the form top to bottom.
// Track / Profile products (linear cross-sections) also get a "W x H x D mm" token
// built from the dimensions, right after the SKU description.
export function composeAutoDescription(r: SkuResult, d: SpecSheetData): string {
  const isTrackOrProfile = Boolean(
    (d.sku.track || '').trim() ||
      (d.sku.profile || '').trim() ||
      (d.sku.profileKind || '').trim()
  );
  const dimToken = isTrackOrProfile
    ? [d.ancho, d.alto, d.fondo].map((s) => (s || '').trim()).filter(Boolean).join(' x ')
    : '';
  const dimensionPart = dimToken ? `${dimToken}mm` : '';
  const extras = [d.material, d.ipRating, d.electricalClass]
    .map((s) => (s || '').trim())
    .filter(Boolean);

  const tokens = r.segments.map((s) => s.desc).filter((desc): desc is string => Boolean(desc));
  const lm = primaryLumen(d);
  if (lm) tokens.splice(Math.min(r.fluxSlot, tokens.length), 0, `${lm.value} ${lm.unit}`);

  return [...tokens, dimensionPart, ...extras].filter(Boolean).join(' / ');
}

/** The identity values (name / code / descriptions) the SKU would auto-generate. */
export function deriveIdentity(d: SpecSheetData): {
  name: string;
  code: string;
  codeDescription: string;
  description: string;
} {
  const r = buildSku(d.sku);
  // Long SKU is the unique identity (optic, CCT, CRI, watts, …). Short SKU alone
  // collides when two variants share the same commercial stem (e.g. OP36 vs OP22).
  return {
    name: [d.productName.trim(), r.nameBody].filter(Boolean).join(' '),
    code: (r.longCode || r.shortCode).trim(),
    codeDescription: r.shortDesc,
    description: composeAutoDescription(r, d),
  };
}

/**
 * Force identity (Name / Code / descriptions) from the current SKU and re-enable
 * auto-sync flags. Builder is the source of truth — call whenever SKU inputs
 * change or right before save so stale manual overrides cannot linger.
 */
export function syncIdentityFromSku(prev: SpecSheetData): SpecSheetData {
  const derived = deriveIdentity(prev);
  if (
    prev.name === derived.name &&
    prev.code === derived.code &&
    prev.codeDescription === derived.codeDescription &&
    prev.description === derived.description &&
    prev.link.name &&
    prev.link.code &&
    prev.link.codeDescription &&
    prev.link.description
  ) {
    return prev;
  }
  return {
    ...prev,
    link: { name: true, code: true, codeDescription: true, description: true },
    name: derived.name,
    code: derived.code,
    codeDescription: derived.codeDescription,
    description: derived.description,
  };
}

/**
 * Mark a sheet as the nth copy of the variant it was duplicated from.
 *
 * A copy has to differ from its source somewhere, and the only place that holds is
 * the SKU itself. Patching the stored code with a "-COPY" string left the sheet
 * still generating the source's code, so the copy could never be saved again: every
 * save rebuilt identity from the SKU and hit the source's Long SKU. The Version
 * segment carries the marker instead, so the copy generates its own code, name and
 * descriptions — and clearing the marker is what turns it into a real variant.
 */
export function applyCopyMarker(prev: SpecSheetData, n = 1): SpecSheetData {
  return syncIdentityFromSku({
    ...prev,
    sku: { ...prev.sku, version: 'CUSTOM', versionCustom: copyMarker(n) },
  });
}

/** Drop the copy mark: the sheet stops being a duplicate and rebuilds its identity. */
export function clearCopyMarker(prev: SpecSheetData): SpecSheetData {
  if (!hasCopyMarker(prev.sku)) return prev;
  return syncIdentityFromSku({
    ...prev,
    sku: { ...prev.sku, version: '', versionCustom: '' },
  });
}

/**
 * Apply a product-family name onto the sheet: updates `productName`, re-derives
 * the SKU series (e.g. Prueba → PRU), re-links series + identity fields.
 * Used when the admin picks a different family in the Builder — without this,
 * only `product_id` changes and Re-apply keeps deriving from the old name (ORI).
 */
export function applyFamilyName(prev: SpecSheetData, familyName: string): SpecSheetData {
  const productName = (familyName || '').trim();
  const series = deriveSeries(productName);
  if (
    prev.productName === productName &&
    prev.sku.series === series &&
    prev.seriesLinked
  ) {
    return prev;
  }
  const next: SpecSheetData = {
    ...prev,
    productName,
    seriesLinked: true,
    sku: { ...prev.sku, series },
    link: {
      name: true,
      code: true,
      codeDescription: true,
      description: true,
    },
  };
  const derived = deriveIdentity(next);
  return {
    ...next,
    name: derived.name,
    code: derived.code,
    codeDescription: derived.codeDescription,
    description: derived.description,
  };
}

/**
 * Prefills the sheet footer from the value configured in Settings.
 *
 * Applied when a sheet is opened rather than baked in at creation, so changing
 * the address in Settings reaches every sheet that never overrode it. An
 * existing footer is left alone: the field stays editable for the odd variant
 * that needs different wording.
 */
export function applyFooterDefault(
  sheet: SpecSheetData,
  defaultFooter: string | null | undefined
): SpecSheetData {
  const fallback = (defaultFooter || '').trim();
  if (!fallback || sheet.footerNote.trim()) return sheet;
  return { ...sheet, footerNote: fallback };
}

/**
 * Merge a possibly-partial stored payload (older sheets, missing keys) onto a
 * fresh default so the editor never crashes on undefined arrays/fields.
 */
export function normalizeSpecSheet(raw: Partial<SpecSheetData> | null | undefined): SpecSheetData {
  const base = createDefaultSpecSheet();
  if (!raw) return base;
  const merged: SpecSheetData = {
    ...base,
    ...raw,
    configuraciones:
      raw.configuraciones && raw.configuraciones.length
        ? raw.configuraciones.map((c) => {
            const row = c as ConfigRow & { variant_id?: string };
            // Legacy sheets may carry showOnSpecSheet; it is dropped here on
            // purpose. Every related row now prints, and the public site takes
            // its Related Variants from the family instead of this list.
            return {
              codigo: row?.codigo ?? '',
              nombre: row?.nombre ?? '',
              descripcion: row?.descripcion ?? '',
              componente: row?.componente ?? '',
              variantId: row?.variantId || row?.variant_id || undefined,
            };
          })
        : base.configuraciones,
    colores:
      raw.colores && raw.colores.length
        ? raw.colores.map((c) => ({ nombre: c?.nombre ?? '', codigo: c?.codigo ?? '' }))
        : base.colores,
    // Respect an explicitly empty array (user deleted all rows); only fall back
    // to the default rows when the field is missing entirely (legacy sheets).
    datosTecnicos: Array.isArray(raw.datosTecnicos)
      ? raw.datosTecnicos.map((t) => ({
          campo: t?.campo ?? '',
          valor: t?.valor ?? '',
          unidad: t?.unidad ?? '',
          locked: t?.locked,
        }))
      : base.datosTecnicos,
    sku: { ...base.sku, ...(raw.sku ?? {}) },
    link: { ...base.link, ...(raw.link ?? {}) },
    seriesLinked: raw.seriesLinked ?? base.seriesLinked,
  };

  // Migration: mounting type used to live on `montaje` (SpecSheetData). It is now
  // a SKU segment (`sku.mounting`). Carry the legacy value over when the new
  // field is empty so older sheets keep their mounting type.
  const legacyMontaje = (raw as { montaje?: unknown }).montaje;
  if (!merged.sku.mounting && typeof legacyMontaje === 'string' && legacyMontaje.trim()) {
    merged.sku = { ...merged.sku, mounting: legacyMontaje };
  }

  // Migration for legacy sheets saved before the auto/manual state was
  // persisted: infer which identity fields were hand-edited by comparing the
  // stored value against what the SKU would auto-generate. A field that differs
  // (and is non-empty) is treated as manual so the auto-sync won't clobber it.
  if (raw.link == null) {
    const derived = deriveIdentity(merged);
    merged.link = {
      name: merged.name.trim() === '' || merged.name === derived.name,
      code: merged.code.trim() === '' || merged.code === derived.code,
      codeDescription:
        merged.codeDescription.trim() === '' || merged.codeDescription === derived.codeDescription,
      description: merged.description.trim() === '' || merged.description === derived.description,
    };
  }
  if (raw.seriesLinked == null) {
    merged.seriesLinked = merged.sku.series === deriveSeries(merged.productName);
  }

  return merged;
}
