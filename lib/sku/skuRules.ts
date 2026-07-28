// ──────────────────────────────────────────────────────────────────────────
//  SKU Rules — White Label SKU Generator (Lighting Fixtures)
//  Ported from the SpecBuilder project. Single source of truth for segment
//  options, translation maps and the SKU / description builder.
// ──────────────────────────────────────────────────────────────────────────

export interface SkuOption {
  /** Code stored in the SKU / used as the option value. */
  value: string;
  /** Human label shown in the dropdown. */
  label: string;
  /** Optional optgroup the option belongs to. */
  group?: string;
}

/** Mutable shape of the form state that feeds the builder. */
export interface SkuState {
  series: string;
  dim: string;        // standard format code or 'CUSTOM'
  dimCustom: string;  // free text when dim === 'CUSTOM' (size, name, code fragment…)
  shape: string;
  length: string;     // linear (shape === 'L'), track, or LED profile — e.g. 1000 / 2000 / 3000 mm
  track: string;      // track system — mutually exclusive with profile & Linear shape
  /** DIFF = Diffuser, PRF = Profile — LED Profiles Type (replaces size/format). */
  profileKind: string;
  profile: string;    // aluminum profile style (SUR/REC/PEN…) — mutually exclusive with track & Linear shape
  mounting: string;   // mounting type label (e.g. "Recessed") — part of code + description
  /** Accessory kind when shape === 'ACC' (CLIP, ADAPT, CABLE… or CUSTOM). */
  accessoryType: string;
  /** Free-text accessory type when accessoryType === 'CUSTOM'. */
  accessoryTypeCustom: string;
  source: string;
  socket: string;
  socketCustom: string; // custom socket when socket === 'CUSTOM'
  trim: string;
  color: string;
  cri: string;
  criCustom: string;  // custom CRI (e.g. 97) when cri === 'CUSTOM'
  cct: string;
  cctCustom: string;  // custom CCT in Kelvin (e.g. 3300 or 2700-6500) when cct === 'CUSTOM'
  optic: string;     // standard beam code or 'CUSTOM'
  opticCustom: string; // custom beam angle (degrees) when optic === 'CUSTOM'
  watts: string;
  wattsCustom: string; // custom wattage (e.g. 18) when watts === 'CUSTOM'
  driver: string;
  driverV: string;      // standard voltage/current code or 'CUSTOM'
  driverVCustom: string; // custom voltage/current when driverV === 'CUSTOM'
  ctrl: string;
  version: string;
  /** Custom version text when version === 'CUSTOM' (e.g. V5, Rev A). */
  versionCustom: string;
}

export const EMPTY_SKU_STATE: SkuState = {
  series: '',
  dim: '',
  dimCustom: '',
  shape: '',
  length: '',
  track: '',
  profileKind: '',
  profile: '',
  mounting: '',
  accessoryType: '',
  accessoryTypeCustom: '',
  source: '',
  socket: '',
  socketCustom: '',
  trim: '',
  color: '',
  cri: '',
  criCustom: '',
  cct: '',
  cctCustom: '',
  optic: '',
  opticCustom: '',
  watts: '',
  wattsCustom: '',
  driver: '',
  driverV: '',
  driverVCustom: '',
  ctrl: '',
  version: '',
  versionCustom: '',
};

// ── Translation maps (code → human description) ─────────────────────────────
export const T = {
  source: { LED: 'LED', LST: 'LED strip', HAL: 'Halogen', RTF: 'Retrofit', MOD: 'Module' },
  socket: {
    MOD: 'integrated module',
    GU10: 'GU10 socket',
    'GU5.3': 'GU5.3 socket',
    E26: 'E26 socket',
    E27: 'E27 socket',
    G13: 'G13 (T8)',
    G5: 'G5 (T5)',
  },
  trim: { TRM: 'Trimmed', TRL: 'Trimless' },
  color: {
    WH: 'White',
    BK: 'Black',
    BZ: 'Bronze',
    GD: 'Gold',
    CH: 'Chrome',
    SN: 'Satin Nickel',
    GR: 'Gray',
    ANZ: 'Anodized',
    MF: 'Mill finish',
    MET: 'Metal',
    'WH/BK': 'White trim / Black diffuser',
    'BK/WH': 'Black trim / White diffuser',
    'BZ/WH': 'Bronze trim / White diffuser',
    'GD/WH': 'Gold trim / White diffuser',
  },
  cri: { CR80: 'CRI 80+', CR90: 'CRI 90+', CR95: 'CRI 95+', CR100: 'CRI 100' },
  cct: {
    CT22: '2200K warm amber',
    CT27: '2700K warm white',
    CT30: '3000K soft white',
    CT35: '3500K neutral',
    CT40: '4000K cool white',
    CT50: '5000K daylight',
    CTUN: 'Tunable white',
  },
  optic: {
    OP10: '10° beam',
    OP15: '15° beam',
    OP24: '24° beam',
    OP25: '25° beam',
    OP36: '36° beam',
    OP50: '50° beam',
    OP60: '60° beam',
    OP90: '90° beam',
    OP112: '112° beam',
  },
  watts: {
    WT3: '3W',
    WT4: '4W',
    WT6: '6W',
    WT7: '7W',
    WT9: '9W',
    WT10: '10W',
    WT12: '12W',
    WT13: '13W',
    WT15: '15W',
    WT20: '20W',
    WT30: '30W',
    WT35: '35W',
    WT50: '50W',
  },
  driver: {
    INT: 'Integrated driver',
    EXT: 'External driver',
    RMCC: 'Remote CC driver',
    RMCV: 'Remote CV driver',
  },
  driverV: {
    '120V': '120V',
    '240V': '240V',
    '277V': '277V',
    '48V': '48V DC',
    '24V': '24V DC',
    '12V': '12V DC',
    '32V': '32V AC',
    '180MA': '180mA',
    '250MA': '250mA',
    '350MA': '350mA',
    '500MA': '500mA',
    '700MA': '700mA',
    '900MA': '900mA',
    '1000MA': '1000mA',
  },
  ctrl: {
    ND: 'Non-dimmable',
    PHD: 'Phase dimmable',
    '010': '0–10V dimming',
    DALI: 'DALI',
    DMX: 'DMX',
    RFD: 'RF dimmable',
  },
  shape: { R: 'Round', S: 'Square', L: 'Linear', RT: 'Rectangular', ACC: 'Accessory' },
  accessoryType: {
    CLIP: 'Clip',
    ADAPT: 'Adapter',
    CABLE: 'Cable',
    FEED: 'Feed',
    CONN: 'Connector',
    BRKT: 'Bracket',
    COVER: 'Cover',
    ENDC: 'End cap',
    JOIN: 'Joiner',
    SUSP: 'Suspension kit',
  },
  version: { V2: 'Version 2', V3: 'Version 3', V4: 'Version 4' },
  // NOTE: default Track / Profile option sets — adjust the labels/codes here and
  // in TRACK_OPTIONS / PROFILE_OPTIONS below to match Luken's real catalog.
  track: {
    MAG48: '48V Magnetic track',
    MAG24: '24V Magnetic track',
    '1PH': 'Single-circuit track',
    '3PH': 'Three-circuit track',
    LV: 'Low-voltage track',
  },
  profile: {
    SUR: 'Surface profile',
    REC: 'Recessed profile',
    PEN: 'Suspended / Pendant profile',
    COR: 'Corner profile',
    TRL: 'Trimless profile',
  },
} as const;

type TMap = keyof typeof T;

function translate(map: TMap, key: string): string | null {
  if (!key) return null;
  const dict = T[map] as Record<string, string>;
  return dict[key] ?? key;
}

/** Human label for a color code (e.g. "WH" → "White", "WH/BK" → "White trim / Black diffuser"). */
export function skuColorName(code: string): string {
  const c = code.trim();
  if (!c) return '';
  return (T.color as Record<string, string>)[c] ?? c;
}

/** Reverse: finish label → SKU color code (e.g. "White trim / Black diffuser" → "WH/BK"). */
export function skuColorCodeFromFinish(finish: string | null | undefined): string {
  const f = (finish || '').trim();
  if (!f) return '';
  for (const [code, label] of Object.entries(T.color as Record<string, string>)) {
    if (label === f) return code;
  }
  return '';
}

/**
 * Color code for a variant row: from finish label, else parse Long/Short SKU
 * (WH, BK, WH/BK, …). Longer codes matched first so WH/BK wins over WH.
 */
export function extractSkuColorCode(
  code: string | null | undefined,
  finish?: string | null
): string {
  const fromFinish = skuColorCodeFromFinish(finish);
  if (fromFinish) return fromFinish;

  const raw = (code || '').trim();
  if (!raw) return '';
  const codes = Object.keys(T.color as Record<string, string>).sort(
    (a, b) => b.length - a.length
  );
  for (const c of codes) {
    const escaped = c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (new RegExp(`(?:^|-)${escaped}(?:-|$)`, 'i').test(raw)) return c;
  }
  return '';
}

/** Human label for a track code (e.g. "MAG48" → "48V Magnetic track"). */
export function skuTrackName(code: string): string {
  const c = (code || '').trim();
  if (!c) return '';
  return (T.track as Record<string, string>)[c] ?? c;
}

/** Human label for a profile code (e.g. "SUR" → "Surface profile"). */
export function skuProfileName(code: string): string {
  const c = (code || '').trim();
  if (!c) return '';
  return (T.profile as Record<string, string>)[c] ?? c;
}

/** Readable Driver / Control summary from the SKU (e.g. "Remote CC driver / 120V / 0–10V dimming"). */
export function skuDriverControlText(state: SkuState): string {
  const parts: string[] = [];
  const driver = state.driver.trim();
  if (driver) parts.push((T.driver as Record<string, string>)[driver] ?? driver);
  const driverV =
    state.driverV === 'CUSTOM' ? state.driverVCustom.trim() : state.driverV.trim();
  if (driverV) {
    parts.push(
      state.driverV === 'CUSTOM' ? driverV : ((T.driverV as Record<string, string>)[driverV] ?? driverV),
    );
  }
  const ctrl = state.ctrl.trim();
  if (ctrl) parts.push((T.ctrl as Record<string, string>)[ctrl] ?? ctrl);
  return parts.join(' / ');
}

// ── Dropdown option lists (with optgroups where the HTML used them) ──────────
export const DIM_OPTIONS: SkuOption[] = [
  { value: 'MR16', label: 'MR16', group: 'Standard lamp formats' },
  { value: 'MR11', label: 'MR11', group: 'Standard lamp formats' },
  { value: 'A19', label: 'A19', group: 'Standard lamp formats' },
  { value: 'A21', label: 'A21', group: 'Standard lamp formats' },
  { value: 'PAR16', label: 'PAR16', group: 'Standard lamp formats' },
  { value: 'PAR20', label: 'PAR20', group: 'Standard lamp formats' },
  { value: 'PAR30', label: 'PAR30', group: 'Standard lamp formats' },
  { value: 'PAR38', label: 'PAR38', group: 'Standard lamp formats' },
  { value: 'BR30', label: 'BR30', group: 'Standard lamp formats' },
  { value: 'BR40', label: 'BR40', group: 'Standard lamp formats' },
  { value: 'T8', label: 'T8', group: 'Standard lamp formats' },
  { value: 'T5', label: 'T5', group: 'Standard lamp formats' },
  { value: 'CUSTOM', label: 'Custom — enter below', group: 'Custom' },
];

/** Fixture shapes only. Accessory mode is driven by Type = Accessories (sets shape ACC). */
export const SHAPE_OPTIONS: SkuOption[] = [
  { value: 'R', label: 'R – Round' },
  { value: 'S', label: 'S – Square' },
  { value: 'L', label: 'L – Linear' },
  { value: 'RT', label: 'RT – Rectangular' },
];

/** Clear fixture-only segments when entering accessory SKU mode (Type = Accessories). */
export function enterAccessorySkuMode(state: SkuState): SkuState {
  return {
    ...state,
    shape: 'ACC',
    dim: '',
    dimCustom: '',
    length: '',
    track: '',
    profileKind: '',
    profile: '',
    mounting: '',
    source: '',
    socket: '',
    socketCustom: '',
    trim: '',
    cri: '',
    criCustom: '',
    cct: '',
    cctCustom: '',
    optic: '',
    opticCustom: '',
    watts: '',
    wattsCustom: '',
    driver: '',
    driverV: '',
    driverVCustom: '',
    ctrl: '',
  };
}

/** Leave accessory SKU mode when Type is no longer Accessories. */
export function leaveAccessorySkuMode(state: SkuState): SkuState {
  return {
    ...state,
    shape: state.shape === 'ACC' ? '' : state.shape,
    accessoryType: '',
    accessoryTypeCustom: '',
  };
}

/** Accessory subtypes — used when Type = Accessories (shape ACC). SKU: SERIES-ACC-{type}-… */
export const ACCESSORY_TYPE_OPTIONS: SkuOption[] = [
  { value: 'CLIP', label: 'CLIP – Clip' },
  { value: 'ADAPT', label: 'ADAPT – Adapter' },
  { value: 'CABLE', label: 'CABLE – Cable' },
  { value: 'FEED', label: 'FEED – Feed' },
  { value: 'CONN', label: 'CONN – Connector' },
  { value: 'BRKT', label: 'BRKT – Bracket' },
  { value: 'COVER', label: 'COVER – Cover' },
  { value: 'ENDC', label: 'ENDC – End cap' },
  { value: 'JOIN', label: 'JOIN – Joiner' },
  { value: 'SUSP', label: 'SUSP – Suspension kit' },
  { value: 'CUSTOM', label: 'Custom — enter below' },
];

// Track & Profile are mutually exclusive linear-system types (with each other and
// with a Linear shape). The SKU carries a TRK / PRF flag; the specific system
// shows in the description + spec sheet. Adjust these lists to Luken's catalog.
export const TRACK_OPTIONS: SkuOption[] = [
  { value: 'MAG48', label: 'MAG48 – 48V Magnetic track' },
  { value: 'MAG24', label: 'MAG24 – 24V Magnetic track' },
  { value: '1PH', label: '1PH – Single-circuit track' },
  { value: '3PH', label: '3PH – Three-circuit track' },
  { value: 'LV', label: 'LV – Low-voltage track' },
];

const TRACK_LINE_VOLTAGE = new Set(['1PH', '3PH']);
const TRACK_LOW_VOLTAGE = new Set(['MAG48', 'MAG24', 'LV']);

/** Track codes allowed for Type = Track Line Voltage / Track Low Voltage. */
export function trackOptionsForType(subcategory: string | null | undefined): SkuOption[] {
  const s = (subcategory || '').trim().toLowerCase();
  if (s === 'track line voltage') {
    return TRACK_OPTIONS.filter((o) => TRACK_LINE_VOLTAGE.has(o.value));
  }
  if (s === 'track low voltage') {
    return TRACK_OPTIONS.filter((o) => TRACK_LOW_VOLTAGE.has(o.value));
  }
  return TRACK_OPTIONS;
}

/** True when a stored track code does not belong to the current Type. */
export function isTrackCodeAllowed(track: string, subcategory: string | null | undefined): boolean {
  const code = (track || '').trim();
  if (!code) return true;
  const s = (subcategory || '').trim().toLowerCase();
  if (s === 'track line voltage') return TRACK_LINE_VOLTAGE.has(code);
  if (s === 'track low voltage') return TRACK_LOW_VOLTAGE.has(code);
  return true;
}

/** Diffuser vs extrusion — used when Type = LED Profiles (SKU flag DIFF / PRF). */
export const PROFILE_KIND_OPTIONS: SkuOption[] = [
  { value: 'DIFF', label: 'DIFF – Diffuser' },
  { value: 'PRF', label: 'PRF – Profile' },
];

export const PROFILE_OPTIONS: SkuOption[] = [
  { value: 'SUR', label: 'SUR – Surface profile' },
  { value: 'REC', label: 'REC – Recessed profile' },
  { value: 'PEN', label: 'PEN – Suspended / Pendant profile' },
  { value: 'COR', label: 'COR – Corner profile' },
  { value: 'TRL', label: 'TRL – Trimless profile' },
];

// Mounting type — the label lives on the SKU state (matching MONTAJE_OPTIONS in
// specSheet.ts). This maps each mounting label to the short code that goes into
// the SKU. Unknown labels fall back to a sanitized 3-letter code in buildSku.
export const MOUNTING_CODE: Record<string, string> = {
  'Recessed': 'REC',
  'Surface mounted': 'SUR',
  'Suspended / Pendant': 'PEN',
  'Ceiling mounted': 'CEI',
  'Wall mounted': 'WAL',
  'Track mounted': 'TRA',
  'Linear / Trunking': 'LIN',
  'In-ground / In-grade': 'ING',
  'Floor standing': 'FLO',
  'Table / Desk': 'TAB',
  'Portable': 'POR',
  'Bollard / Post': 'BOL',
  'Pole mounted': 'POL',
  'Step / Stair': 'STE',
  'Underwater': 'UND',
};

export const SOURCE_OPTIONS: SkuOption[] = [
  { value: 'LED', label: 'LED' },
  { value: 'LST', label: 'LST – LED strip' },
  { value: 'HAL', label: 'HAL – Halogen' },
  { value: 'RTF', label: 'RTF – Retrofit' },
  { value: 'MOD', label: 'MOD – Module' },
];

export const SOCKET_OPTIONS: SkuOption[] = [
  { value: 'MOD', label: 'MOD – Integrated module' },
  { value: 'GU10', label: 'GU10' },
  { value: 'GU5.3', label: 'GU5.3 (MR16)' },
  { value: 'E26', label: 'E26' },
  { value: 'E27', label: 'E27' },
  { value: 'G13', label: 'G13 (T8)' },
  { value: 'G5', label: 'G5 (T5)' },
  { value: 'CUSTOM', label: 'Custom — enter below' },
];

export const TRIM_OPTIONS: SkuOption[] = [
  { value: 'TRM', label: 'TRM – Trimmed' },
  { value: 'TRL', label: 'TRL – Trimless' },
];

export const COLOR_OPTIONS: SkuOption[] = [
  { value: 'WH', label: 'WH – White', group: 'Single color' },
  { value: 'BK', label: 'BK – Black', group: 'Single color' },
  { value: 'BZ', label: 'BZ – Bronze', group: 'Single color' },
  { value: 'GD', label: 'GD – Gold', group: 'Single color' },
  { value: 'CH', label: 'CH – Chrome', group: 'Single color' },
  { value: 'SN', label: 'SN – Satin Nickel', group: 'Single color' },
  { value: 'GR', label: 'GR – Gray', group: 'Single color' },
  { value: 'ANZ', label: 'ANZ – Anodizado', group: 'Metallic / raw' },
  { value: 'MF', label: 'MF – Mill finish', group: 'Metallic / raw' },
  { value: 'MET', label: 'MET – Metal', group: 'Metallic / raw' },
  { value: 'WH/BK', label: 'WH/BK – White trim · Black diffuser', group: 'Two-tone (Trim / Diffuser)' },
  { value: 'BK/WH', label: 'BK/WH – Black trim · White diffuser', group: 'Two-tone (Trim / Diffuser)' },
  { value: 'BZ/WH', label: 'BZ/WH – Bronze trim · White diffuser', group: 'Two-tone (Trim / Diffuser)' },
  { value: 'GD/WH', label: 'GD/WH – Gold trim · White diffuser', group: 'Two-tone (Trim / Diffuser)' },
];

export const CRI_OPTIONS: SkuOption[] = [
  { value: 'CR80', label: 'CR80 – CRI 80+' },
  { value: 'CR90', label: 'CR90 – CRI 90+' },
  { value: 'CR95', label: 'CR95 – CRI 95+' },
  { value: 'CR100', label: 'CR100 – CRI 100' },
  { value: 'CUSTOM', label: 'Custom — enter below' },
];

export const CCT_OPTIONS: SkuOption[] = [
  { value: 'CT22', label: 'CT22 – 2200K warm amber' },
  { value: 'CT27', label: 'CT27 – 2700K warm white' },
  { value: 'CT30', label: 'CT30 – 3000K soft white' },
  { value: 'CT35', label: 'CT35 – 3500K neutral' },
  { value: 'CT40', label: 'CT40 – 4000K cool white' },
  { value: 'CT50', label: 'CT50 – 5000K daylight' },
  { value: 'CTUN', label: 'CTUN – Tunable white' },
  { value: 'CUSTOM', label: 'Custom — enter below' },
];

/** Parse a custom CCT string ("3300", "2700-6500", "2700K–6500K") into Kelvin min/max. */
export function cctKelvinFromCustom(raw: string): { min: number | null; max: number | null } {
  const nums = ((raw || '').match(/\d+(?:\.\d+)?/g) || []).map(Number).filter((n) => Number.isFinite(n));
  if (nums.length === 0) return { min: null, max: null };
  if (nums.length === 1) return { min: nums[0], max: nums[0] };
  return { min: Math.min(...nums), max: Math.max(...nums) };
}

export const OPTIC_OPTIONS: SkuOption[] = [
  { value: 'OP10', label: 'OP10 – 10°' },
  { value: 'OP15', label: 'OP15 – 15°' },
  { value: 'OP24', label: 'OP24 – 24°' },
  { value: 'OP25', label: 'OP25 – 25°' },
  { value: 'OP36', label: 'OP36 – 36°' },
  { value: 'OP50', label: 'OP50 – 50°' },
  { value: 'OP60', label: 'OP60 – 60°' },
  { value: 'OP90', label: 'OP90 – 90°' },
  { value: 'OP112', label: 'OP112 – 112°' },
  { value: 'CUSTOM', label: 'Custom — enter below' },
];

export const WATTS_OPTIONS: SkuOption[] = [
  { value: 'WT3', label: 'WT3 – 3W' },
  { value: 'WT4', label: 'WT4 – 4W' },
  { value: 'WT6', label: 'WT6 – 6W' },
  { value: 'WT7', label: 'WT7 – 7W' },
  { value: 'WT9', label: 'WT9 – 9W' },
  { value: 'WT10', label: 'WT10 – 10W' },
  { value: 'WT12', label: 'WT12 – 12W' },
  { value: 'WT13', label: 'WT13 – 13W' },
  { value: 'WT15', label: 'WT15 – 15W' },
  { value: 'WT20', label: 'WT20 – 20W' },
  { value: 'WT30', label: 'WT30 – 30W' },
  { value: 'WT35', label: 'WT35 – 35W' },
  { value: 'WT50', label: 'WT50 – 50W' },
  { value: 'CUSTOM', label: 'Custom — enter below' },
];

export const DRIVER_OPTIONS: SkuOption[] = [
  { value: 'INT', label: 'INT – Integrated' },
  { value: 'EXT', label: 'EXT – External' },
  { value: 'RMCC', label: 'RMCC – Remote constant current' },
  { value: 'RMCV', label: 'RMCV – Remote constant voltage' },
];

export const DRIVER_V_OPTIONS: SkuOption[] = [
  { value: '120V', label: '120V', group: 'Voltage' },
  { value: '240V', label: '240V', group: 'Voltage' },
  { value: '277V', label: '277V', group: 'Voltage' },
  { value: '48V', label: '48V DC', group: 'Voltage' },
  { value: '24V', label: '24V DC', group: 'Voltage' },
  { value: '12V', label: '12V DC', group: 'Voltage' },
  { value: '32V', label: '32V AC', group: 'Voltage' },
  { value: '180MA', label: '180mA', group: 'Constant current' },
  { value: '250MA', label: '250mA', group: 'Constant current' },
  { value: '350MA', label: '350mA', group: 'Constant current' },
  { value: '500MA', label: '500mA', group: 'Constant current' },
  { value: '700MA', label: '700mA', group: 'Constant current' },
  { value: '900MA', label: '900mA', group: 'Constant current' },
  { value: '1000MA', label: '1000mA', group: 'Constant current' },
  { value: 'CUSTOM', label: 'Custom — enter below', group: 'Custom' },
];

export const CTRL_OPTIONS: SkuOption[] = [
  { value: 'ND', label: 'ND – Non-dimmable' },
  { value: 'PHD', label: 'PHD – Phase dimmable' },
  { value: '010', label: '010 – 0–10V dimming' },
  { value: 'DALI', label: 'DALI' },
  { value: 'DMX', label: 'DMX' },
  { value: 'RFD', label: 'RFD – RF dimmable' },
];

export const VERSION_OPTIONS: SkuOption[] = [
  { value: 'V2', label: 'V2' },
  { value: 'V3', label: 'V3' },
  { value: 'V4', label: 'V4' },
  { value: 'CUSTOM', label: 'Custom — enter below' },
];

/** Resolve version SKU code + description (standard V2/V3/V4 or custom). */
export function resolveVersion(state: Pick<SkuState, 'version' | 'versionCustom'>): {
  code: string;
  desc: string | null;
} {
  if (state.version === 'CUSTOM') {
    const raw = (state.versionCustom || '').trim();
    const code = raw.toUpperCase().replace(/[^A-Z0-9]+/g, '').slice(0, 8);
    return { code, desc: raw || null };
  }
  const code = (state.version || '').trim();
  if (!code) return { code: '', desc: null };
  return {
    code,
    desc: T.version[code as keyof typeof T.version] || code,
  };
}

// ── Builder ─────────────────────────────────────────────────────────────────
export interface SkuSegment {
  val: string;
  inShort: boolean;
  desc: string | null;
  /** Included in the concise commercial Name (size + source + color). */
  inName?: boolean;
}

export interface SkuResult {
  shortCode: string;
  longCode: string;
  /** Short SKU raw segments after the series, space-joined (e.g. "65R GU10 WH"). */
  shortBody: string;
  /** Concise commercial name body: size + source + color (e.g. "70R LED WH").
   *  Used to build the Name as `${productName} ${nameBody}`. */
  nameBody: string;
  shortDesc: string;
  longDesc: string;
  segments: SkuSegment[];
}

/**
 * Build SHORT + LONG SKU codes and human descriptions from form state.
 */
export function buildSku(state: SkuState): SkuResult {
  // Be tolerant of partial states: legacy spec sheets stored in the DB predate
  // newer fields (track / profile / mounting), so their raw `sku` object is
  // missing those keys. Merge onto the empty state so `.trim()` never hits
  // `undefined` (the public product page calls this with the raw stored sku).
  state = { ...EMPTY_SKU_STATE, ...state };
  const dimRaw = state.dim === 'CUSTOM' ? state.dimCustom.trim() : state.dim.trim();
  const shape = state.shape.trim();
  const length = state.length.trim();
  const driver = state.driver.trim();
  const driverVIsCustom = state.driverV === 'CUSTOM';
  // Code segment: sanitized custom text (e.g. "48V DC" → "48VDC") or the standard code.
  const driverVCode = driverVIsCustom
    ? state.driverVCustom.trim().toUpperCase().replace(/\s+/g, '')
    : state.driverV.trim();
  // Human label: the custom text as typed, or the translated standard label.
  const driverVLabel = driverVIsCustom
    ? state.driverVCustom.trim()
    : (state.driverV.trim() ? (T.driverV[state.driverV.trim() as keyof typeof T.driverV] || state.driverV.trim()) : '');
  const series = state.series.trim();

  const segs: SkuSegment[] = [];
  const add = (val: string, inShort: boolean, desc: string | null, inName = false) => {
    if (val) segs.push({ val, inShort, desc, inName });
  };

  // ── Accessory mode ──────────────────────────────────────────────────────
  // Shape ACC → SKU is always SERIES-ACC-{type}-… (e.g. ORI-ACC-CLIP-WH).
  // Fixture segments (size, mounting, source, optic…) are not used.
  if (shape === 'ACC') {
    add(series, true, null);
    add('ACC', true, 'Accessory', true);

    if (state.accessoryType === 'CUSTOM') {
      const raw = (state.accessoryTypeCustom || '').trim();
      const code = raw.toUpperCase().replace(/[^A-Z0-9]+/g, '').slice(0, 8);
      if (code) add(code, true, raw, true);
    } else {
      const typeCode = state.accessoryType.trim();
      if (typeCode) {
        add(
          typeCode,
          true,
          T.accessoryType[typeCode as keyof typeof T.accessoryType] || typeCode,
          true
        );
      }
    }

    add(state.color.trim(), true, translate('color', state.color.trim()), true);
    {
      const ver = resolveVersion(state);
      if (ver.code) add(ver.code, false, ver.desc);
    }

    const shortSegs = segs.filter((s) => s.inShort).map((s) => s.val);
    const longSegs = segs.map((s) => s.val);
    // Name body = short segments without the leading series (same as fixtures).
    const shortBody = (series && shortSegs[0] === series ? shortSegs.slice(1) : shortSegs).join(' ');
    const nameBody = segs.filter((s) => s.inName).map((s) => s.val).join(' ');
    const shortDesc = segs
      .filter((s) => s.inShort && s.desc)
      .map((s) => s.desc)
      .join(' / ');
    const longDesc = segs
      .filter((s) => s.desc)
      .map((s) => s.desc)
      .join(' / ');

    return {
      shortCode: shortSegs.join('-'),
      longCode: longSegs.join('-'),
      shortBody,
      nameBody,
      shortDesc,
      longDesc,
      segments: segs,
    };
  }

  // 1 · Series — part of the SKU code only. It is NOT added to the descriptions
  // (desc = null) because the product Name already carries the family/series.
  add(series, true, null);

  // 2 · Size + shape
  const track = state.track.trim();
  const profile = state.profile.trim();
  let dimSeg = dimRaw;
  if (dimSeg && shape) dimSeg += shape;
  let dimDesc: string | null = dimRaw ? dimRaw : null;
  if (dimDesc && shape) dimDesc += ' ' + (T.shape[shape as keyof typeof T.shape] || shape);
  if (length && shape === 'L' && dimDesc) dimDesc += ' ' + length + 'mm';
  add(dimSeg, true, dimDesc, true);

  // 3 · Track / Profile — mutually exclusive linear systems.
  // Order matches configurator: SERIES-TRK|{DIFF|PRF}-{length}-…
  const profileKind = (state.profileKind || '').trim() || (profile ? 'PRF' : '');
  if (track) {
    add('TRK', true, translate('track', track), true);
    if (length) add(length, true, `${length}mm`, true);
  } else if (profileKind) {
    // SERIES-PRF|DIFF-{length}-{SUR|REC|PEN|…}-…
    add(profileKind, true, profileKind === 'DIFF' ? 'Diffuser' : 'Profile', true);
    if (length) add(length, true, `${length}mm`, true);
    if (profile) add(profile, true, translate('profile', profile), true);
  }

  // 3b · Length for linear fixtures only (shape L). Track/profile length is above.
  if (!track && !profileKind && shape === 'L' && length) add(length, true, null, true);

  // 3c · Mounting type — part of the SKU code and the description. The state
  // stores the human label (e.g. "Recessed"); the code comes from MOUNTING_CODE
  // (unknown labels fall back to a sanitized 3-letter code).
  // LED Profiles: Mounting field is hidden — mount style comes only from
  // Profile type (SUR/REC/PEN…). Never emit a leftover Mounting segment.
  const mounting = state.mounting.trim();
  if (mounting && !profileKind) {
    const mCode =
      MOUNTING_CODE[mounting] ?? mounting.replace(/[^A-Za-z0-9]/g, '').slice(0, 3).toUpperCase();
    if (mCode) add(mCode, true, mounting);
  }

  // 4 · Source / socket / trim / color (short + long)
  add(state.source.trim(), true, translate('source', state.source.trim()), true);
  // Socket — standard code or a custom socket type (e.g. GX53, R7s).
  if (state.socket === 'CUSTOM') {
    const raw = (state.socketCustom || '').trim();
    const code = raw.toUpperCase().replace(/\s+/g, '');
    if (code) add(code, true, `${raw} socket`);
  } else {
    add(state.socket.trim(), true, translate('socket', state.socket.trim()));
  }
  add(state.trim.trim(), true, translate('trim', state.trim.trim()), true);
  add(state.color.trim(), true, translate('color', state.color.trim()), true);

  // 5 · Long-only segments
  // CRI — standard code or a custom value (e.g. 97).
  if (state.cri === 'CUSTOM') {
    const n = (state.criCustom || '').replace(/[^0-9]/g, '');
    if (n) add(`CR${n}`, false, `CRI ${n}+`);
  } else {
    add(state.cri.trim(), false, translate('cri', state.cri.trim()));
  }
  // CCT — standard code or a custom Kelvin value / range.
  if (state.cct === 'CUSTOM') {
    const { min, max } = cctKelvinFromCustom(state.cctCustom);
    if (min != null) {
      const isRange = max != null && max !== min;
      const code = isRange ? 'CTUN' : `CT${Math.round(min / 100)}`;
      const label = isRange ? `${min}K–${max}K tunable` : `${min}K`;
      add(code, false, label);
    }
  } else {
    add(state.cct.trim(), false, translate('cct', state.cct.trim()));
  }

  // Optic / beam — standard code or a custom angle (e.g. 11°, 13°).
  if (state.optic === 'CUSTOM') {
    const deg = (state.opticCustom || '').replace(/[^0-9.]/g, '');
    if (deg) add(`OP${deg}`, false, `${deg}° beam`);
  } else {
    add(state.optic.trim(), false, translate('optic', state.optic.trim()));
  }

  // Watts — standard code or a custom wattage (e.g. 18).
  if (state.watts === 'CUSTOM') {
    const n = (state.wattsCustom || '').replace(/[^0-9.]/g, '');
    if (n) add(`WT${n}`, false, `${n}W`);
  } else {
    add(state.watts.trim(), false, translate('watts', state.watts.trim()));
  }

  if (driver) {
    const driverDesc =
      (translate('driver', driver) ?? '') + (driverVLabel ? ' / ' + driverVLabel : '');
    add(driver, false, driverDesc);
    if (driverVCode) add(driverVCode, false, null); // desc already merged above
  }

  add(state.ctrl.trim(), false, translate('ctrl', state.ctrl.trim()));
  {
    const ver = resolveVersion(state);
    if (ver.code) add(ver.code, false, ver.desc);
  }

  const shortSegs = segs.filter((s) => s.inShort).map((s) => s.val);
  const longSegs = segs.map((s) => s.val);
  // Name body = short raw segments without the leading series code.
  const shortBody = (series && shortSegs[0] === series ? shortSegs.slice(1) : shortSegs).join(' ');
  // Concise commercial name body: size + source + trim + color (no series/socket).
  const nameBody = segs.filter((s) => s.inName).map((s) => s.val).join(' ');
  const shortDesc = segs
    .filter((s) => s.inShort && s.desc)
    .map((s) => s.desc)
    .join(' / ');
  const longDesc = segs
    .filter((s) => s.desc)
    .map((s) => s.desc)
    .join(' / ');

  return {
    shortCode: shortSegs.join('-'),
    longCode: longSegs.join('-'),
    shortBody,
    nameBody,
    shortDesc,
    longDesc,
    segments: segs,
  };
}
