// ──────────────────────────────────────────────────────────────────────────
//  SKU Rules — White Label SKU Generator (Lighting Fixtures)
//  Ported from the SpecBuilder project. Single source of truth for segment
//  options, translation maps and the SKU / description builder.
// ──────────────────────────────────────────────────────────────────────────

/**
 * Build number of the naming rules.
 *
 * A variant row stores what these rules generated — code, name and both
 * descriptions — so the catalog can be listed and searched without rebuilding
 * anything. That copy goes stale the moment a rule changes here.
 *
 * Bump this in the same change that alters a generated value. Rows carry the
 * version that wrote them, and the admin rewrites whatever is behind on its own,
 * so a rule change reaches the catalog without anyone remembering to re-save 24
 * variants one by one.
 *
 * 1 · Trim and finish before source/socket · flux placed after the socket in the
 *     description · Short SKU drops MOD and carries CCT + beam.
 * 2 · Version reaches the Name and the Short SKU, so a duplicate marked COPY is
 *     visible in the list instead of hiding at the tail of the Long SKU.
 */
export const SKU_RULES_VERSION = 3;

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
  /** Free-text finish when color === 'CUSTOM' (e.g. RAL 9016, Copper brushed). */
  colorCustom: string;
  cri: string;
  criCustom: string;  // custom CRI (e.g. 97) when cri === 'CUSTOM'
  cct: string;
  cctCustom: string;  // custom CCT in Kelvin (e.g. 3300 or 2700-6500) when cct === 'CUSTOM'
  optic: string;     // standard beam code or 'CUSTOM'
  opticCustom: string; // custom beam angle (degrees) when optic === 'CUSTOM'
  watts: string;
  wattsCustom: string; // custom wattage (e.g. 18) when watts === 'CUSTOM'
  driver: string;
  /** Mains / enter voltage (120V, 220V…). Separate from CC/CV output. */
  driverIn: string;
  driverV: string;      // CC (mA) or CV (V DC) output code, or 'CUSTOM'
  driverVCustom: string; // custom CC/CV when driverV === 'CUSTOM'
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
  colorCustom: '',
  cri: '',
  criCustom: '',
  cct: '',
  cctCustom: '',
  optic: '',
  opticCustom: '',
  watts: '',
  wattsCustom: '',
  driver: '',
  driverIn: '',
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
  /** Mains / enter voltage — not the CC/CV output. */
  driverIn: {
    '120V': '120V AC',
    '220V': '220V AC',
    '240V': '240V AC',
    '277V': '277V AC',
    '120/240': '120/240V AC',
    '120/277': '120/277V AC',
  },
  /** Driver output: constant voltage (CV) or constant current (CC). */
  driverV: {
    '12V': '12V DC',
    '15V': '15V DC',
    '18V': '18V DC',
    '24V': '24V DC',
    '36V': '36V DC',
    '48V': '48V DC',
    '32V': '32V AC',
    '160MA': '160mA',
    '180MA': '180mA',
    '200MA': '200mA',
    '250MA': '250mA',
    '300MA': '300mA',
    '350MA': '350mA',
    '400MA': '400mA',
    '450MA': '450mA',
    '500MA': '500mA',
    '550MA': '550mA',
    '600MA': '600mA',
    '700MA': '700mA',
    '750MA': '750mA',
    '800MA': '800mA',
    '850MA': '850mA',
    '900MA': '900mA',
    '1000MA': '1000mA',
  },
  ctrl: {
    ND: 'Non-dimmable',
    PHD: 'Phase dimmable',
    '010': '0–10V dimming',
    '110': '1–10V dimming',
    DALI: 'DALI',
    DMX: 'DMX',
    RFD: 'RF dimmable',
    CAS: 'Casambi',
    ZIG: 'Zigbee',
    PUSH: 'Push dimming',
    DNI: 'Driver not included',
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

/** Finish label → SKU color code (e.g. "White trim / Black diffuser" → "WH/BK"). */
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
  const segment = (c: string) =>
    new RegExp(`(?:^|-)${c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:-|$)`, 'i').test(raw);

  const codes = Object.keys(T.color as Record<string, string>).sort(
    (a, b) => b.length - a.length
  );
  for (const c of codes) {
    if (segment(c)) return c;
  }

  // A finish off the list: the Builder wrote its letters and digits into the SKU,
  // so when that turns up as a segment here it is this variant's finish code. The
  // check keeps a stored finish from putting a code on a SKU that never carried one.
  const custom = customColorCode(finish);
  return custom && segment(custom) ? custom : '';
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

/** Readable Driver / Control summary (e.g. "Remote CC / 350mA / 120V AC / 0–10V"). */
export function skuDriverControlText(state: SkuState): string {
  const s = normalizeDriverFields(state);
  const parts: string[] = [];
  const driver = s.driver.trim();
  if (driver) parts.push((T.driver as Record<string, string>)[driver] ?? driver);
  const driverV = s.driverV === 'CUSTOM' ? (s.driverVCustom || '').trim() : (s.driverV || '').trim();
  if (driverV) {
    parts.push(
      s.driverV === 'CUSTOM' ? driverV : ((T.driverV as Record<string, string>)[driverV] ?? driverV),
    );
  }
  const driverIn = (s.driverIn || '').trim();
  if (driverIn) parts.push((T.driverIn as Record<string, string>)[driverIn] ?? driverIn);
  const ctrl = s.ctrl.trim();
  if (ctrl) parts.push((T.ctrl as Record<string, string>)[ctrl] ?? ctrl);
  return parts.join(' / ');
}

/** Input / mains codes that used to live in `driverV` before the split. */
const LEGACY_INPUT_IN_DRIVER_V = new Set(Object.keys(T.driverIn));

/**
 * Move a legacy input-voltage code from `driverV` → `driverIn` when the new
 * field is empty (sheets saved before Enter Voltage was a separate question).
 */
export function normalizeDriverFields(state: SkuState): SkuState {
  const driverV = (state.driverV || '').trim();
  const driverIn = (state.driverIn || '').trim();
  if (!driverIn && driverV && LEGACY_INPUT_IN_DRIVER_V.has(driverV)) {
    return { ...state, driverIn: driverV, driverV: '' };
  }
  return state;
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
    driverIn: '',
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
  { value: 'CUSTOM', label: 'Custom — enter below', group: 'Custom' },
];

/**
 * Code segment for a finish that is not on the list.
 *
 * The SKU is read by splitting on hyphens, so a finish typed as "RAL 9016 - matt"
 * cannot keep its spaces or its dash: the code keeps the letters and digits and the
 * description keeps the words as typed. Shared with the reader below, so a code
 * written into a SKU is one the catalog can still recognise.
 */
export function customColorCode(raw: string | null | undefined): string {
  return (raw || '').trim().toUpperCase().replace(/[^A-Z0-9]+/g, '').slice(0, 10);
}

/** Resolve the finish SKU code + label: a standard code, or free text. */
export function resolveColor(state: Pick<SkuState, 'color' | 'colorCustom'>): {
  code: string;
  desc: string | null;
} {
  if (state.color === 'CUSTOM') {
    const raw = (state.colorCustom || '').trim();
    return { code: customColorCode(raw), desc: raw || null };
  }
  const code = (state.color || '').trim();
  return { code, desc: translate('color', code) };
}

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

/** Mains / enter voltage — separate from CC/CV output. */
export const DRIVER_IN_OPTIONS: SkuOption[] = [
  { value: '120V', label: '120V AC' },
  { value: '220V', label: '220V AC' },
  { value: '240V', label: '240V AC' },
  { value: '277V', label: '277V AC' },
  { value: '120/240', label: '120/240V AC' },
  { value: '120/277', label: '120/277V AC' },
];

/** Driver output only: constant voltage (CV) or constant current (CC). */
export const DRIVER_V_OPTIONS: SkuOption[] = [
  { value: '12V', label: '12V DC', group: 'Constant voltage (CV)' },
  { value: '15V', label: '15V DC', group: 'Constant voltage (CV)' },
  { value: '18V', label: '18V DC', group: 'Constant voltage (CV)' },
  { value: '24V', label: '24V DC', group: 'Constant voltage (CV)' },
  { value: '36V', label: '36V DC', group: 'Constant voltage (CV)' },
  { value: '48V', label: '48V DC', group: 'Constant voltage (CV)' },
  { value: '32V', label: '32V AC', group: 'Constant voltage (CV)' },
  { value: '160MA', label: '160mA', group: 'Constant current (CC)' },
  { value: '180MA', label: '180mA', group: 'Constant current (CC)' },
  { value: '200MA', label: '200mA', group: 'Constant current (CC)' },
  { value: '250MA', label: '250mA', group: 'Constant current (CC)' },
  { value: '300MA', label: '300mA', group: 'Constant current (CC)' },
  { value: '350MA', label: '350mA', group: 'Constant current (CC)' },
  { value: '400MA', label: '400mA', group: 'Constant current (CC)' },
  { value: '450MA', label: '450mA', group: 'Constant current (CC)' },
  { value: '500MA', label: '500mA', group: 'Constant current (CC)' },
  { value: '550MA', label: '550mA', group: 'Constant current (CC)' },
  { value: '600MA', label: '600mA', group: 'Constant current (CC)' },
  { value: '700MA', label: '700mA', group: 'Constant current (CC)' },
  { value: '750MA', label: '750mA', group: 'Constant current (CC)' },
  { value: '800MA', label: '800mA', group: 'Constant current (CC)' },
  { value: '850MA', label: '850mA', group: 'Constant current (CC)' },
  { value: '900MA', label: '900mA', group: 'Constant current (CC)' },
  { value: '1000MA', label: '1000mA', group: 'Constant current (CC)' },
  { value: 'CUSTOM', label: 'Custom — enter below', group: 'Custom' },
];

export const CTRL_OPTIONS: SkuOption[] = [
  { value: 'ND', label: 'ND – Non-dimmable' },
  { value: 'PHD', label: 'PHD – Phase dimmable' },
  { value: '010', label: '010 – 0–10V dimming' },
  { value: '110', label: '110 – 1–10V dimming' },
  { value: 'DALI', label: 'DALI' },
  { value: 'DMX', label: 'DMX' },
  { value: 'RFD', label: 'RFD – RF dimmable' },
  { value: 'CAS', label: 'CAS – Casambi' },
  { value: 'ZIG', label: 'ZIG – Zigbee' },
  { value: 'PUSH', label: 'PUSH – Push dimming' },
  { value: 'DNI', label: 'DNI – Driver not included' },
];

export const VERSION_OPTIONS: SkuOption[] = [
  { value: 'V2', label: 'V2' },
  { value: 'V3', label: 'V3' },
  { value: 'V4', label: 'V4' },
  { value: 'CUSTOM', label: 'Custom — enter below' },
];

/** The Version segment a duplicate carries until it is given a real difference. */
export const COPY_MARKER = 'COPY';

/**
 * Marker for the nth duplicate of a variant.
 * Original = 1 (no marker). 1st copy → COPY2, 2nd → COPY3, …
 * (Never plain "COPY" — that looked like a boolean and skipped the "2".)
 */
export function copyMarker(n = 1): string {
  const ordinal = Math.max(1, Math.floor(n)) + 1; // 1st duplicate → 2
  return `${COPY_MARKER}${ordinal}`;
}

/** Whether this SKU is still marked as a duplicate of another variant. */
export function hasCopyMarker(state: Pick<SkuState, 'version' | 'versionCustom'>): boolean {
  return (
    state.version === 'CUSTOM' &&
    new RegExp(`^${COPY_MARKER}\\d*$`, 'i').test((state.versionCustom || '').trim())
  );
}

/** Whether a code was left by the duplicate action (…-COPY, …-COPY2). */
export function looksLikeCopy(code: string | null | undefined): boolean {
  return new RegExp(`-${COPY_MARKER}\\d*$`, 'i').test((code || '').trim());
}

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
  /**
   * The commercial code: what a project asks for. It is not a prefix of the long
   * one — it leaves out the engineering segments (CRI, power, driver) that sit
   * between the ones it keeps.
   */
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
  /**
   * How many description tokens come before the luminous flux.
   *
   * The flux is not a SKU segment — it is read from the Technical data — but the
   * Builder asks for it between the socket and the CRI, so that is where it reads
   * in the description. `composeAutoDescription` splices it in here.
   */
  fluxSlot: number;
}

/**
 * Build SHORT + LONG SKU codes and human descriptions from form state.
 */
export function buildSku(state: SkuState): SkuResult {
  // Be tolerant of partial states: legacy spec sheets stored in the DB predate
  // newer fields (track / profile / mounting), so their raw `sku` object is
  // missing those keys. Merge onto the empty state so `.trim()` never hits
  // `undefined` (the public product page calls this with the raw stored sku).
  state = normalizeDriverFields({ ...EMPTY_SKU_STATE, ...state });
  const dimRaw = state.dim === 'CUSTOM' ? state.dimCustom.trim() : state.dim.trim();
  const shape = state.shape.trim();
  const length = state.length.trim();
  const driver = state.driver.trim();
  const driverIn = state.driverIn.trim();
  const driverInLabel = driverIn
    ? (T.driverIn[driverIn as keyof typeof T.driverIn] || driverIn)
    : '';
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
  /** Description tokens written so far — the flux slot is one of these counts. */
  const describedSoFar = () => segs.filter((s) => s.desc).length;

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

    {
      const col = resolveColor(state);
      add(col.code, true, col.desc, true);
    }
    {
      const ver = resolveVersion(state);
      if (ver.code) add(ver.code, true, ver.desc, true);
    }

    const shortSegs = segs.filter((s) => s.inShort).map((s) => s.val);
    const longSegs = segs.map((s) => s.val);
    // Name body = short segments without the leading series (same as fixtures).
    const shortBody = (series && shortSegs[0] === series ? shortSegs.slice(1) : shortSegs).join(' ');
    const nameBody = segs.filter((s) => s.inName).map((s) => s.val).join(' ');
    const shortDesc =
      segs
        .filter((s) => s.inShort && s.desc)
        .map((s) => s.desc)
        .join(' / ') ||
      segs
        .filter((s) => s.desc)
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
      // An accessory emits no light, so nothing is asked before the flux: should
      // one ever be typed in, it reads last.
      fluxSlot: describedSoFar(),
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

  // 4 · Trim / colour, then source / socket (short + long).
  //
  // The order follows the Builder: trim and finish are asked with the body of the
  // piece, in Identity & format, and the light comes after. A code that reads in
  // the order it was filled in is one that can be checked against the form.
  add(state.trim.trim(), true, translate('trim', state.trim.trim()), true);
  {
    // Finish — a standard code or one made from the finish as typed.
    const col = resolveColor(state);
    add(col.code, true, col.desc, true);
  }
  add(state.source.trim(), true, translate('source', state.source.trim()), true);
  // Socket — standard code or a custom socket type (e.g. GX53, R7s).
  //
  // A lamp base belongs in the Short SKU: it says which lamp fits. MOD does not —
  // an integrated module is already implied by the LED source, so it only made the
  // commercial code longer.
  if (state.socket === 'CUSTOM') {
    const raw = (state.socketCustom || '').trim();
    const code = raw.toUpperCase().replace(/\s+/g, '');
    if (code) add(code, true, `${raw} socket`);
  } else {
    const socket = state.socket.trim();
    add(socket, socket !== 'MOD', translate('socket', socket));
  }

  // The Builder asks for Lumen right here, after the socket and before the CRI.
  const fluxSlot = describedSoFar();

  // 5 · The light itself
  //
  // CCT and beam are in the Short SKU: they are what a project asks for by name
  // ("3000K, 15°") and what distinguishes two otherwise identical fixtures on a
  // drawing. CRI, power and the driver stay long-only — they are engineering.
  //
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
      add(code, true, label);
    }
  } else {
    add(state.cct.trim(), true, translate('cct', state.cct.trim()));
  }

  // Optic / beam — standard code or a custom angle (e.g. 11°, 13°).
  if (state.optic === 'CUSTOM') {
    const deg = (state.opticCustom || '').replace(/[^0-9.]/g, '');
    if (deg) add(`OP${deg}`, true, `${deg}° beam`);
  } else {
    add(state.optic.trim(), true, translate('optic', state.optic.trim()));
  }

  // Watts — standard code or a custom wattage (e.g. 18).
  if (state.watts === 'CUSTOM') {
    const n = (state.wattsCustom || '').replace(/[^0-9.]/g, '');
    if (n) add(`WT${n}`, false, `${n}W`);
  } else {
    add(state.watts.trim(), false, translate('watts', state.watts.trim()));
  }

  // Driver → CC/CV output → Enter voltage (Long SKU only).
  if (driver || driverIn || driverVCode) {
    const extras = [driverVLabel, driverInLabel].filter(Boolean).join(' / ');
    if (driver) {
      add(
        driver,
        false,
        (translate('driver', driver) ?? '') + (extras ? ' / ' + extras : ''),
      );
      if (driverVCode) add(driverVCode, false, null);
      if (driverIn) add(driverIn, false, null);
    } else if (driverVCode) {
      add(driverVCode, false, extras || driverVLabel || null);
      if (driverIn) add(driverIn, false, null);
    } else {
      add(driverIn, false, driverInLabel);
    }
  }

  add(state.ctrl.trim(), false, translate('ctrl', state.ctrl.trim()));
  {
    // Version rides in the Name and the Short SKU: a V2 is a different thing to
    // order than a V1, and a duplicate marked COPY has to be recognisable in the
    // Variants list at a glance.
    const ver = resolveVersion(state);
    if (ver.code) add(ver.code, true, ver.desc, true);
  }

  const shortSegs = segs.filter((s) => s.inShort).map((s) => s.val);
  const longSegs = segs.map((s) => s.val);
  // Name body = short raw segments without the leading series code.
  const shortBody = (series && shortSegs[0] === series ? shortSegs.slice(1) : shortSegs).join(' ');
  // Concise commercial name body: size + trim + color + source (no series/socket).
  const nameBody = segs.filter((s) => s.inName).map((s) => s.val).join(' ');
  const longDesc = segs
    .filter((s) => s.desc)
    .map((s) => s.desc)
    .join(' / ');
  // Short description prefers Short-SKU tokens (size, mount, optic…). Power
  // supplies / drivers often have none of those — watts & electrical live on the
  // Long SKU only — so fall back to the long description instead of leaving blank.
  const shortDesc =
    segs
      .filter((s) => s.inShort && s.desc)
      .map((s) => s.desc)
      .join(' / ') || longDesc;

  return {
    shortCode: shortSegs.join('-'),
    longCode: longSegs.join('-'),
    shortBody,
    nameBody,
    shortDesc,
    longDesc,
    segments: segs,
    fluxSlot,
  };
}
