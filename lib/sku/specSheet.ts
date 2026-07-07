// ──────────────────────────────────────────────────────────────────────────
//  Spec Sheet model — ported from the SpecBuilder project.
//  Single source of truth for the technical data sheet shape, default data
//  and helpers shared by the editor, the live preview and the PDF export.
// ──────────────────────────────────────────────────────────────────────────

import type { SkuState } from './skuRules';
import { EMPTY_SKU_STATE } from './skuRules';

export interface ConfigRow {
  codigo: string;
  descripcion: string;
  componente: string;
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

export interface SpecSheetData {
  productName: string;
  /** Commercial name: productName + short SKU body (e.g. "Orion 65R GU10 WH"). */
  name: string;
  brand: string;
  lastUpdate: string;
  code: string;
  codeDescription: string;
  description: string;
  montaje: string;
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
}

export const MONTAJE_OPTIONS = [
  'Recessed',
  'Surface mounted',
  'Suspended / Pendant',
  'Ceiling mounted',
  'Wall mounted',
  'Track mounted',
  'Linear / Trunking',
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

export function createDefaultSpecSheet(): SpecSheetData {
  return {
    productName: '',
    name: '',
    brand: 'Luken',
    lastUpdate: '',
    code: '',
    codeDescription: '',
    description: '',
    montaje: '',
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
    configuraciones: [{ codigo: '', descripcion: '', componente: '' }],
    colores: [{ nombre: '', codigo: '' }],
    // Technical data starts empty on purpose: it is only for ADDITIONAL fields
    // that are not already derived from the SKU or the General data / Builder.
    datosTecnicos: [],
    sku: { ...EMPTY_SKU_STATE },
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
  };
}

/**
 * Merge a possibly-partial stored payload (older sheets, missing keys) onto a
 * fresh default so the editor never crashes on undefined arrays/fields.
 */
export function normalizeSpecSheet(raw: Partial<SpecSheetData> | null | undefined): SpecSheetData {
  const base = createDefaultSpecSheet();
  if (!raw) return base;
  return {
    ...base,
    ...raw,
    configuraciones:
      raw.configuraciones && raw.configuraciones.length
        ? raw.configuraciones.map((c) => ({
            codigo: c?.codigo ?? '',
            descripcion: c?.descripcion ?? '',
            componente: c?.componente ?? '',
          }))
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
  };
}
