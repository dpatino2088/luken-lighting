// ──────────────────────────────────────────────────────────────────────────
//  Map the SKU generator state + spec sheet into Luken's structured
//  product_variants columns. Luken's model is the source of truth; these
//  helpers translate SKU codes into the native fields the catalog/site use.
// ──────────────────────────────────────────────────────────────────────────

import type { SkuState } from './skuRules';
import { buildSku, skuColorName, cctKelvinFromCustom } from './skuRules';
import { createDefaultSpecSheet, type SpecSheetData } from './specSheet';

function numFrom(code: string): number | null {
  const m = code.match(/(\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) : null;
}

/** CT30 → { min:3000, max:3000 }; CTUN → tunable range. */
export function cctRange(cct: string): { min: number | null; max: number | null } {
  const c = cct.trim();
  if (!c) return { min: null, max: null };
  if (c === 'CTUN') return { min: 2700, max: 6500 };
  const n = numFrom(c); // CT30 → 30
  if (n == null) return { min: null, max: null };
  const kelvin = n * 100; // 30 → 3000
  return { min: kelvin, max: kelvin };
}

export function criValue(cri: string): number | null {
  const n = numFrom(cri); // CR90 → 90
  return n;
}

export function wattsValue(watts: string): number | null {
  return numFrom(watts); // WT10 → 10
}

export function beamValue(optic: string): number | null {
  return numFrom(optic); // OP24 → 24
}

/** Socket / source → Luken light_source text. */
export function lightSource(state: SkuState): string | null {
  const socket = state.socket === 'CUSTOM' ? state.socketCustom.trim().toUpperCase() : state.socket.trim();
  if (socket === 'MOD') return 'LED Integrated';
  if (socket) return socket; // GU10, GU5.3, E26, E27, G13, G5, or custom
  const src = state.source.trim();
  if (src === 'LED') return 'LED Integrated';
  if (src === 'LST') return 'LED Strip';
  return src || null;
}

const CONTROL_MAP: Record<string, string> = {
  ND: 'on-off',
  PHD: 'phase',
  '010': '0-10v',
  DALI: 'dali',
  DMX: 'dmx',
  RFD: 'push',
};

export function controlTypes(ctrl: string): string[] {
  const c = ctrl.trim();
  if (!c) return [];
  return [CONTROL_MAP[c] ?? c.toLowerCase()];
}

const MOUNTING_MAP: Record<string, string> = {
  Recessed: 'recessed',
  'Surface mounted': 'surface',
  'Suspended / Pendant': 'pendant',
  'Ceiling mounted': 'surface',
  'Wall mounted': 'wall',
  'Track mounted': 'track',
  'Linear / Trunking': 'track',
};

export function mountingType(montaje: string): string | null {
  const m = montaje.trim();
  if (!m) return null;
  return MOUNTING_MAP[m] ?? null;
}

/** Profile type codes (SUR/REC/PEN…) → Luken mounting_type when Mounting field is empty. */
const PROFILE_MOUNTING_MAP: Record<string, string> = {
  SUR: 'surface',
  REC: 'recessed',
  PEN: 'pendant',
  COR: 'surface',
  TRL: 'recessed',
};

function numOrNull(v: string): number | null {
  const t = (v ?? '').trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** Parse a technical-data cell like "1,200" or "0" into a number (null if none). */
function techNum(v: string | undefined): number | null {
  if (!v) return null;
  const m = v.replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : null;
}

// Maps the fixed technical-data row labels (DEFAULT_TECH_ROWS) → structured
// product_variants photometric columns. The Builder's Technical Data is the
// single input for these numbers.
const TECH_ROW_TO_COLUMN: Record<string, keyof TechColumns> = {
  'System lumens': 'lumens_system',
  'Source lumens': 'lumens',
  'System wattage': 'power_w_system',
  'Source wattage': 'power_w',
  'Luminous efficacy': 'efficacy_lm_per_w',
};

interface TechColumns {
  lumens: number | null;
  lumens_system: number | null;
  power_w: number | null;
  power_w_system: number | null;
  efficacy_lm_per_w: number | null;
}

export function techRowsToColumns(rows: { campo: string; valor: string }[]): TechColumns {
  const out: TechColumns = { lumens: null, lumens_system: null, power_w: null, power_w_system: null, efficacy_lm_per_w: null };
  for (const row of rows || []) {
    const key = TECH_ROW_TO_COLUMN[(row.campo || '').trim()];
    if (!key) continue;
    const n = techNum(row.valor);
    // A luminaire cannot have 0 lm / 0 W / 0 efficacy. Treat 0 (the value used by
    // the default template placeholders) as "not provided" so it never overrides
    // the real derived value with a bogus zero.
    out[key] = n && n !== 0 ? n : null;
  }
  return out;
}

export interface VariantFields {
  name: string;
  code: string;
  short_description: string;
  long_description: string;
  light_source: string | null;
  power_w: number | null;
  power_w_system: number | null;
  lumens: number | null;
  lumens_system: number | null;
  efficacy_lm_per_w: number | null;
  cct_min: number | null;
  cct_max: number | null;
  cri: number | null;
  beam_angle: number | null;
  voltage: string | null;
  finish: string | null;
  material: string | null;
  ip_rating: string | null;
  class: string | null;
  control_types: string[];
  mounting_type: string | null;
  environment: string | null;
  dimensions: Record<string, number> | null;
}

/**
 * Build the structured product_variants payload from the spec sheet.
 * `slug`, `product_id`, `category_id` are added by the caller.
 */
export function specSheetToVariantFields(data: SpecSheetData, environment: string | null): VariantFields {
  const r = buildSku(data.sku);
  const { min, max } =
    data.sku.cct === 'CUSTOM' ? cctKelvinFromCustom(data.sku.cctCustom) : cctRange(data.sku.cct);
  const tech = techRowsToColumns(data.datosTecnicos);

  const dims: Record<string, number> = {};
  const width = numOrNull(data.ancho);
  const height = numOrNull(data.alto);
  const depth = numOrNull(data.fondo);
  const weight = numOrNull(data.peso);
  if (width != null) dims.width_mm = width;
  if (height != null) dims.height_mm = height;
  if (depth != null) dims.length_mm = depth;
  if (weight != null) dims.weight_kg = weight;

  return {
    // Prefer live SKU build so a stale sheet identity never wins.
    name: [data.productName.trim(), r.nameBody].filter(Boolean).join(' ') || data.name || data.productName,
    code: r.shortCode || data.code,
    short_description: r.shortDesc || data.codeDescription,
    long_description: data.description || r.longDesc,
    light_source: lightSource(data.sku),
    // The Builder Power (WT13 → 13W) IS the system wattage. A manual "System
    // wattage" row can still override it; "Source wattage" is an optional extra.
    power_w: tech.power_w,
    power_w_system: tech.power_w_system ?? wattsValue(data.sku.watts === 'CUSTOM' ? data.sku.wattsCustom : data.sku.watts),
    lumens: tech.lumens,
    lumens_system: tech.lumens_system,
    efficacy_lm_per_w: tech.efficacy_lm_per_w,
    cct_min: min,
    cct_max: max,
    cri: criValue(data.sku.cri === 'CUSTOM' ? data.sku.criCustom : data.sku.cri),
    beam_angle: beamValue(data.sku.optic === 'CUSTOM' ? data.sku.opticCustom : data.sku.optic),
    voltage:
      (data.sku.driverV === 'CUSTOM' ? data.sku.driverVCustom.trim() : data.sku.driverV.trim()) || null,
    finish: skuColorName(data.sku.color) || null,
    material: data.material.trim() || null,
    ip_rating: data.ipRating.trim() || null,
    class: data.electricalClass.trim() || null,
    control_types: controlTypes(data.sku.ctrl),
    mounting_type:
      mountingType(data.sku.mounting) ||
      PROFILE_MOUNTING_MAP[(data.sku.profile || '').trim()] ||
      null,
    environment,
    dimensions: Object.keys(dims).length ? dims : null,
  };
}

const MOUNTING_REVERSE: Record<string, string> = {
  recessed: 'Recessed',
  surface: 'Surface mounted',
  pendant: 'Suspended / Pendant',
  wall: 'Wall mounted',
  track: 'Track mounted',
};

/**
 * Seed a SpecSheetData from an existing variant when no spec_sheet row exists
 * yet (legacy variants). Identity/dimensions/description are prefilled; the SKU
 * generator starts mostly empty (series derives from the family name) so the
 * admin can rebuild the SKU if desired.
 */
export function seedSpecSheetFromVariant(
  variant: {
    name?: string | null;
    code?: string | null;
    short_description?: string | null;
    long_description?: string | null;
    mounting_type?: string | null;
    ip_rating?: string | null;
    material?: string | null;
    class?: string | null;
    lumens?: number | null;
    lumens_system?: number | null;
    power_w?: number | null;
    power_w_system?: number | null;
    efficacy_lm_per_w?: number | null;
    dimensions?: unknown;
  },
  productName: string,
): SpecSheetData {
  const base = createDefaultSpecSheet();
  const dims = (variant.dimensions || {}) as Record<string, number>;

  // Technical data holds only ADDITIONAL measured values that are not derived
  // from the SKU/General data. Seed one row per photometric column that has a
  // real value; skip anything null (and never seed CCT — that comes from SKU).
  const seededTech: { campo: string; valor: string; unidad: string }[] = [
    { campo: 'System lumens', valor: variant.lumens_system, unidad: 'lm' },
    { campo: 'Source lumens', valor: variant.lumens, unidad: 'lm' },
    { campo: 'System wattage', valor: variant.power_w_system, unidad: 'W' },
    { campo: 'Source wattage', valor: variant.power_w, unidad: 'W' },
    { campo: 'Luminous efficacy', valor: variant.efficacy_lm_per_w, unidad: 'lm/W' },
  ]
    .filter((r) => r.valor != null)
    .map((r) => ({ campo: r.campo, valor: String(r.valor), unidad: r.unidad }));

  return {
    ...base,
    productName: productName || '',
    name: variant.name || '',
    code: variant.code || '',
    codeDescription: variant.short_description || '',
    description: variant.long_description || '',
    sku: {
      ...base.sku,
      mounting: variant.mounting_type ? MOUNTING_REVERSE[variant.mounting_type] || '' : '',
    },
    ipRating: variant.ip_rating || '',
    material: variant.material || '',
    electricalClass: variant.class || '',
    ancho: dims.width_mm != null ? String(dims.width_mm) : '',
    alto: dims.height_mm != null ? String(dims.height_mm) : '',
    fondo: dims.length_mm != null ? String(dims.length_mm) : '',
    peso: dims.weight_kg != null ? String(dims.weight_kg) : '',
    datosTecnicos: seededTech,
  };
}
