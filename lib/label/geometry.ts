/**
 * Label geometry — millimetres everywhere.
 *
 * The spec sheet can think in pixels because it is a document to read. A label
 * is artwork a factory measures with a caliper, so every value here is a real
 * physical dimension and the SVG carries mm units end to end.
 *
 * Left to itself the layout keeps element sizes CONSTANT across every template and
 * changes only the canvas and the fold: a UPC-A has a GS1 minimum size and a QR a
 * minimum module size, so scaling them with the canvas would produce labels that
 * fail to scan. It adapts by anchoring blocks to panel edges instead.
 *
 * A template arranged by hand may size and turn each block as it likes, including
 * smaller than prints reliably — see {@link PLACEMENT_ADVICE} for what is said about
 * that and why it is said rather than prevented.
 */

export type LabelLevel = 'product' | 'product_box' | 'inner_box' | 'master_box';

export const LABEL_LEVELS: { value: LabelLevel; label: string }[] = [
  { value: 'product', label: 'Product (lamp)' },
  { value: 'product_box', label: 'Product Box' },
  { value: 'inner_box', label: 'Inner Box' },
  { value: 'master_box', label: 'Master Box' },
];

/**
 * The direction the artwork reads by default.
 *
 * The canvas never turns — it is always the long side across, so every template
 * is drawn, judged and exported in the same frame. What turns is the content:
 * `portrait` sets each field 90°, so the type reads bottom-to-top, which is what a
 * label applied to the narrow side of a box needs. A vertical piece is the same
 * rectangle with its contents turned, so nothing about the delivered file changes.
 */
export type LabelOrientation = 'landscape' | 'portrait';

export const LABEL_ORIENTATIONS: { value: LabelOrientation; label: string }[] = [
  { value: 'landscape', label: 'Horizontal — the text reads across the label' },
  { value: 'portrait', label: 'Vertical — the text reads bottom to top' },
];

/** Fields whose direction can be set on their own. */
export type LabelFieldKey = 'barcode' | 'qr' | 'logo' | 'text' | 'site';

/**
 * `auto` follows the template's direction and only turns if the field cannot fit
 * that way — which is how the production 130 × 50 keeps its barcode turned inside
 * a 30mm fold panel while the rest of the artwork reads across.
 */
export type LabelFieldRotation = 'auto' | 'horizontal' | 'vertical';

export const LABEL_FIELD_ROTATIONS: { value: LabelFieldRotation; label: string }[] = [
  { value: 'auto', label: 'Follow direction' },
  { value: 'horizontal', label: 'Horizontal' },
  { value: 'vertical', label: 'Vertical' },
];

export const LABEL_FIELDS: { key: LabelFieldKey; label: string }[] = [
  { key: 'barcode', label: 'Barcode' },
  { key: 'qr', label: 'QR' },
  { key: 'logo', label: 'Logo' },
  { key: 'text', label: 'Text block' },
  { key: 'site', label: 'Site line' },
];

/**
 * Where a field sits when the artwork has been arranged by hand: millimetres from
 * the top-left of the canvas, and the footprint it occupies there.
 *
 * A template either lays itself out or is arranged by hand, never half of each.
 * The moment the first element is moved the automatic result is snapshotted into
 * placements for every field, so there is no mixed state in which a hand-placed
 * barcode and an engine-placed type block have to be reconciled — and turning the
 * arrangement off puts the engine back in charge of all of it.
 *
 * The box means the same thing the measurement overlay draws: for the barcode and
 * the QR that includes the white quiet zone, because that patch is part of what
 * has to stay clear.
 */
export interface LabelPlacement {
  x: number;
  y: number;
  w: number;
  h: number;
  /**
   * Turned by hand, in quarter steps. Absent means the field still follows the
   * template's direction, so changing that setting still re-orients everything
   * nobody has deliberately turned.
   */
  turn?: Turn;
}

export type LabelPlacements = Partial<Record<LabelFieldKey, LabelPlacement>>;

export interface LabelTemplate {
  id: string;
  name: string;
  level: LabelLevel;
  brand: string;
  /** Long side of the canvas. Always horizontal. */
  width_mm: number;
  /** Short side of the canvas. */
  height_mm: number;
  /** Default direction for fields set to `auto`. */
  orientation: LabelOrientation;
  /** 1 = plain label, 2 = two panels split by a fold line. */
  sections: 1 | 2;
  /** Distance from the left edge of the canvas to the fold. Null when sections === 1. */
  fold_mm: number | null;
  /** Per-field overrides of {@link orientation}. */
  rotation: Record<LabelFieldKey, LabelFieldRotation>;
  /** Empty when the layout is left to the engine, which is the default. */
  placements: LabelPlacements;
  is_default: boolean;
}

/**
 * Everything the layout and the renderer need to draw a label, and nothing else.
 *
 * A template being typed into the Settings form has no id yet, but it already has
 * a shape — which is what lets the editor draw the real artwork while you choose
 * the size rather than after saving it.
 */
export type LabelShape = Pick<
  LabelTemplate,
  'width_mm' | 'height_mm' | 'orientation' | 'sections' | 'fold_mm' | 'rotation'
> & {
  /** Absent or empty means the engine decides, which is how every label starts. */
  placements?: LabelPlacements;
};

export const DEFAULT_FIELD_ROTATION: Record<LabelFieldKey, LabelFieldRotation> = {
  barcode: 'auto',
  qr: 'auto',
  logo: 'auto',
  text: 'auto',
  site: 'auto',
};

/**
 * A quarter turn, anticlockwise: 0 reads across the canvas, 90 reads bottom to
 * top, 180 is upside down and 270 reads top to bottom.
 *
 * All four exist because a label goes onto a box that is then stacked, shelved and
 * scanned in an orientation nobody here decides. 180 and 270 only come from an
 * arrangement made by hand — the engine still chooses between across and turned,
 * since it has no way to know which way up a carton will sit.
 */
export type Turn = 0 | 90 | 180 | 270;

export const QUARTER_TURNS: Turn[] = [0, 90, 180, 270];

/** True when the footprint's sides swap, which is what the layout cares about. */
export function isTurned(turn: Turn): boolean {
  return turn === 90 || turn === 270;
}

/** The next quarter turn, for a control that steps through them. */
export function nextQuarter(turn: Turn): Turn {
  return ((turn + 90) % 360) as Turn;
}

export const TURN_LABEL: Record<Turn, string> = {
  0: 'Across',
  90: 'Bottom to top',
  180: 'Upside down',
  270: 'Top to bottom',
};

/**
 * Places an element's own upright frame on the canvas at a quarter turn.
 *
 * Everything is drawn upright inside `w` × `h` and then turned as a whole, which is
 * the only way four orientations stay honest: a barcode's digits sit below its bars
 * in its own frame, and wherever that frame ends up pointing, they still do.
 */
export function quarterFrame(
  box: { x: number; y: number; w: number; h: number },
  turn: Turn
): { transform: string; w: number; h: number } {
  switch (turn) {
    case 90:
      return { transform: `translate(${box.x}, ${box.y + box.h}) rotate(-90)`, w: box.h, h: box.w };
    case 180:
      return {
        transform: `translate(${box.x + box.w}, ${box.y + box.h}) rotate(180)`,
        w: box.w,
        h: box.h,
      };
    case 270:
      return { transform: `translate(${box.x + box.w}, ${box.y}) rotate(90)`, w: box.h, h: box.w };
    default:
      return { transform: `translate(${box.x}, ${box.y})`, w: box.w, h: box.h };
  }
}

export interface LabelTurns extends Record<LabelFieldKey, Turn> {
  /** True where the value came from the field itself, so the engine may not override it. */
  forced: Record<LabelFieldKey, boolean>;
}

/**
 * Resolves the direction of every field.
 *
 * `auto` becomes the template's direction but stays overridable, which is what
 * lets the engine turn a barcode that cannot fit a narrow fold panel. An explicit
 * choice is marked forced: the engine will still turn it rather than lose the
 * element entirely, but it has to say so instead of doing it quietly.
 */
export function resolveTurns(
  template: Pick<LabelTemplate, 'orientation' | 'rotation'>
): LabelTurns {
  const base: Turn = template.orientation === 'portrait' ? 90 : 0;
  const turns = {} as LabelTurns;
  turns.forced = {} as Record<LabelFieldKey, boolean>;
  for (const { key } of LABEL_FIELDS) {
    const setting = template.rotation?.[key] ?? 'auto';
    turns[key] = setting === 'auto' ? base : setting === 'vertical' ? 90 : 0;
    turns.forced[key] = setting !== 'auto';
  }
  return turns;
}

/**
 * The editable part of a template. `id` is assigned by the database and
 * `is_default` is set through its own action, since only one row may hold it.
 */
export type LabelTemplateInput = Omit<LabelTemplate, 'id' | 'is_default'>;

/**
 * The size frame every template has to sit in.
 *
 * These are not preferences, they are the range in which a label can still carry
 * everything it has to carry: barcode, QR, logo, family, name, Long SKU and the
 * electrical line. Each bound below was measured against the layout engine rather
 * than chosen by eye, and inside the frame every combination comes out complete —
 * which is the point. A size cannot be defined here that then loses information
 * at download time.
 *
 * Sizes move in centimetre steps so a set of cartons shares a small number of
 * label sizes instead of each one being bespoke.
 *
 * The canvas is always horizontal, so the long side is the width and the short
 * side the height, whichever way the fields inside are turned.
 */
export const LABEL_SIZE_STEP_MM = 10;
/** Along the design. 60mm is where the QR still fits beside a 22mm type column. */
export const LABEL_LENGTH_MIN_MM = 60;
export const LABEL_LENGTH_MAX_MM = 130;
/** Across the design. 40mm is what the turned barcode needs with its quiet zones. */
export const LABEL_HEIGHT_MIN_MM = 40;
export const LABEL_HEIGHT_MAX_MM = 50;
/** A narrower fold panel forces the bars to be truncated to fit. */
export const LABEL_FOLD_MIN_MM = 30;
/** What has to remain past the fold for the main panel to hold its contents. */
export const LABEL_CONTENT_MIN_MM = 50;
/** Shortest label that can be folded at all: fold panel plus main panel. */
export const LABEL_FOLD_LENGTH_MIN_MM = LABEL_FOLD_MIN_MM + LABEL_CONTENT_MIN_MM;

function stepRange(min: number, max: number): number[] {
  const out: number[] = [];
  for (let v = min; v <= max; v += LABEL_SIZE_STEP_MM) out.push(v);
  return out;
}

export function labelLengthOptions(): number[] {
  return stepRange(LABEL_LENGTH_MIN_MM, LABEL_LENGTH_MAX_MM);
}

export function labelHeightOptions(): number[] {
  return stepRange(LABEL_HEIGHT_MIN_MM, LABEL_HEIGHT_MAX_MM);
}

/**
 * Folds that leave the main panel enough room at a given artwork length.
 * Empty below {@link LABEL_FOLD_LENGTH_MIN_MM}: such a label cannot be folded at
 * all, and offering a position anyway would produce a size the frame rejects.
 */
export function labelFoldOptions(length: number): number[] {
  if (length < LABEL_FOLD_LENGTH_MIN_MM) return [];
  return stepRange(LABEL_FOLD_MIN_MM, length - LABEL_CONTENT_MIN_MM);
}

/**
 * Checks a template against the frame. Returns null when it is inside it.
 * Runs on the client for immediate feedback and again on the server, which is the
 * copy that counts.
 */
export function validateLabelSize(
  template: Pick<LabelTemplate, 'width_mm' | 'height_mm' | 'sections' | 'fold_mm'>
): string | null {
  const length = template.width_mm;
  const height = template.height_mm;
  const step = LABEL_SIZE_STEP_MM;

  if (!Number.isFinite(length) || !Number.isFinite(height)) {
    return 'Width and height must be numbers, in millimetres.';
  }
  if (length % step !== 0 || height % step !== 0) {
    return `Label sizes go in ${step}mm steps, so 60 × 40 or 130 × 50 but nothing in between.`;
  }
  if (length < LABEL_LENGTH_MIN_MM || length > LABEL_LENGTH_MAX_MM) {
    return `The length has to be between ${LABEL_LENGTH_MIN_MM} and ${LABEL_LENGTH_MAX_MM}mm. Below ${LABEL_LENGTH_MIN_MM}mm the QR no longer fits beside the type; above ${LABEL_LENGTH_MAX_MM}mm is past the largest die in production.`;
  }
  if (height < LABEL_HEIGHT_MIN_MM || height > LABEL_HEIGHT_MAX_MM) {
    return `The height has to be between ${LABEL_HEIGHT_MIN_MM} and ${LABEL_HEIGHT_MAX_MM}mm. A UPC-A turned on its side needs ${LABEL_HEIGHT_MIN_MM}mm including its quiet zones.`;
  }

  if (template.sections === 2) {
    const fold = template.fold_mm;
    if (fold === null || !Number.isFinite(fold)) {
      return 'A two-section label needs a fold position.';
    }
    if (fold % step !== 0) {
      return `The fold goes in ${step}mm steps too.`;
    }
    if (fold < LABEL_FOLD_MIN_MM) {
      return `The fold panel has to be at least ${LABEL_FOLD_MIN_MM}mm wide, otherwise the barcode has to be printed with shortened bars to fit it.`;
    }
    if (length < LABEL_FOLD_LENGTH_MIN_MM) {
      return `A ${length}mm label is too short to fold: it takes ${LABEL_FOLD_MIN_MM}mm for the barcode panel plus ${LABEL_CONTENT_MIN_MM}mm for the main panel, so ${LABEL_FOLD_LENGTH_MIN_MM}mm at least. Use a single panel at this length.`;
    }
    if (length - fold < LABEL_CONTENT_MIN_MM) {
      return `A ${fold}mm fold leaves ${length - fold}mm for the main panel, and it needs ${LABEL_CONTENT_MIN_MM}mm. Either move the fold to ${length - LABEL_CONTENT_MIN_MM}mm or make the label ${fold + LABEL_CONTENT_MIN_MM}mm long.`;
    }
  } else if (template.fold_mm !== null) {
    return 'A single-panel label has no fold.';
  }

  return null;
}

/**
 * Reads an arrangement from whatever the database or a form hands over, keeping
 * only entries that are real boxes. A malformed one is dropped rather than
 * defaulted, which puts that field back under the engine instead of at 0,0.
 */
export function readPlacements(value: unknown): LabelPlacements {
  if (!value || typeof value !== 'object') return {};
  const source = value as Record<string, unknown>;
  const out: LabelPlacements = {};

  for (const { key } of LABEL_FIELDS) {
    const raw = source[key];
    if (!raw || typeof raw !== 'object') continue;
    const box = raw as Record<string, unknown>;
    const x = Number(box.x);
    const y = Number(box.y);
    const w = Number(box.w);
    const h = Number(box.h);
    if (![x, y, w, h].every(Number.isFinite) || w <= 0 || h <= 0) continue;
    const turn = QUARTER_TURNS.find((t) => t === Number(box.turn));
    // Tenths of a millimetre: finer than that is below what a die can hold, and it
    // keeps the stored numbers readable when someone opens the row.
    out[key] = {
      x: round1(x),
      y: round1(y),
      w: round1(w),
      h: round1(h),
      ...(turn === undefined ? {} : { turn }),
    };
  }

  return out;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * The one thing a save has to refuse: artwork placed off the label. Everything else
 * — a symbol below its printable floor, a text box too small for a line — is
 * clamped and reported by the layout rather than blocked, because those still
 * produce a usable label.
 */
export function validatePlacements(
  template: Pick<LabelTemplate, 'width_mm' | 'height_mm'> & { placements?: LabelPlacements }
): string | null {
  const W = template.width_mm;
  const H = template.height_mm;
  const slack = 0.05;

  for (const { key, label } of LABEL_FIELDS) {
    const box = template.placements?.[key];
    if (!box) continue;
    if (box.x < -slack || box.y < -slack || box.x + box.w > W + slack || box.y + box.h > H + slack) {
      return `The ${label.toLowerCase()} sits outside the ${W} × ${H} mm trim, so it would be cut off. Drag it back inside, or reset the arrangement to automatic.`;
    }
  }

  return null;
}

/** Ink colour of the printed field — matches the existing Luken artwork. */
export const LABEL_INK = '#231F20';
export const LABEL_PAPER = '#FFFFFF';

/**
 * UPC-A at 80% magnification, the smallest size GS1 permits.
 *
 * Nominal module width is 0.33mm; 0.264mm is that at 80%. bwip-js emits the
 * symbol as 96 module units wide, so the drawn width follows from the module.
 * The quiet zone is 9 modules per side and is mandatory — without it scanners
 * fail even though the bars look fine.
 */
export const BARCODE_MODULE_MM = 0.264;
export const BARCODE_MODULE_UNITS = 96;
export const BARCODE_SYMBOL_MM = BARCODE_MODULE_UNITS * BARCODE_MODULE_MM;
export const BARCODE_QUIET_MM = 9 * BARCODE_MODULE_MM;
/** Length of the symbol including the mandatory quiet zone at both ends. */
export const BARCODE_BLOCK_LENGTH_MM = BARCODE_SYMBOL_MM + BARCODE_QUIET_MM * 2;
export const BARCODE_BAR_HEIGHT_MM = 16;
/**
 * Shortest the bars may get.
 *
 * Cutting bar height is called truncation. It is allowed, and common on small
 * packaging, but it costs omnidirectional scanning: the scanner has to be aimed
 * more squarely at the symbol. 12mm is about where a POS reader still copes, so
 * the layout treats it as a floor and only goes there when a short label would
 * otherwise have no room left for the SKU.
 */
export const BARCODE_MIN_BAR_HEIGHT_MM = 12;
/** Room for the human-readable digits printed alongside the bars. */
export const BARCODE_DIGITS_MM = 3.2;

/**
 * 16mm, sized from the worst case rather than by eye. The QR encodes the full
 * product URL, and the longest Long-SKU slug pushes it to 41 modules — at 14mm
 * that is a 0.34mm module, too fine to survive printing on carton. 16mm keeps
 * the module at 0.39mm even in that case.
 */
export const QR_SIZE_MM = 16;
/**
 * White margin around the QR. Two things depend on it: the 4-module quiet zone
 * the spec requires, and keeping the modules dark-on-light. An inverted QR looks
 * sharper on the dark brand field but a lot of handheld and industrial scanners
 * will not read one, so the label pays for a white patch instead.
 */
export const QR_QUIET_MM = 2;
export const LOGO_HEIGHT_MM = 10;
export const LOGO_MAX_WIDTH_MM = 40;

/**
 * The sizes below which each field stops being reliable in print.
 *
 * These are advice, not a wall. They were floors at first, and that was wrong: a
 * label is somebody's packaging decision, and there are real cartons too small for
 * a barcode at full magnification. So the editor lets a block be made any size, and
 * the drawing says what was given up — the two that matter are called out by name,
 * because they are the difference between a symbol that scans and one that does not:
 *
 * {@link BARCODE_MODULE_MM} is 80% magnification, the least GS1 permits. A barcode
 * drawn narrower than nominal is out of spec and retailers may reject it, which is
 * worth being told in so many words rather than being prevented from trying.
 *
 * A QR under about 12mm puts the module of the longest product URL below 0.3mm,
 * which carton printing loses — the code is there and simply will not read.
 */
export const PLACEMENT_ADVICE = {
  /** Magnification, as a multiple of the drawn nominal. */
  barcodeScale: { min: 1, max: 2.5 },
  qr: { min: 12, max: 30 },
  logo: { minW: 8, minH: 2.5 },
  text: { minW: 12, minH: 4 },
} as const;

/**
 * The one size that is not negotiable, and only because of arithmetic: at nothing
 * wide there is nothing to draw, and a zero-width box cannot be grabbed again to
 * undo it.
 */
export const PLACEMENT_MIN_MM = 2;

/** Proportion a QR block adds around the symbol for its quiet zone, both sides. */
export const QR_BLOCK_FACTOR = 1 + (2 * QR_QUIET_MM) / QR_SIZE_MM;

/**
 * The size at which a field is still doing its job, for the direction it is drawn in.
 *
 * Nothing enforces this. It is the line the editor draws in red and the layout
 * mentions in its notes, so a block made smaller than it is a decision taken rather
 * than an accident — and so the same numbers are used for both, instead of the
 * warning and the drawing disagreeing about what counts as too small.
 */
export function placementAdvice(
  field: LabelFieldKey,
  turn: Turn
): { minW: number; minH: number } {
  const turned = isTurned(turn);
  const across = <T,>(along: T, depth: T) => (turned ? { minW: depth, minH: along } : { minW: along, minH: depth });

  switch (field) {
    case 'barcode':
      return across(BARCODE_BLOCK_LENGTH_MM, BARCODE_MIN_BAR_HEIGHT_MM + BARCODE_DIGITS_MM);
    case 'qr': {
      const min = PLACEMENT_ADVICE.qr.min * QR_BLOCK_FACTOR;
      return { minW: min, minH: min };
    }
    // Both read along one axis and are only deep enough to hold what reads, so
    // turning them turns the advice with them: a text block 12mm along and 4mm deep
    // holds a line, one 4mm along and 12mm deep holds nothing.
    case 'logo':
      return across(PLACEMENT_ADVICE.logo.minW, PLACEMENT_ADVICE.logo.minH);
    case 'text':
      return across(PLACEMENT_ADVICE.text.minW, PLACEMENT_ADVICE.text.minH);
    // Two rows of type at a size the layout sets, so it moves but does not resize.
    case 'site':
      return { minW: PLACEMENT_MIN_MM, minH: PLACEMENT_MIN_MM };
  }
}

/** Fields whose footprint is square, so a corner handle keeps it square. */
export const PLACEMENT_SQUARE: LabelFieldKey[] = ['qr'];
/** Fields that move but cannot be resized. */
export const PLACEMENT_MOVE_ONLY: LabelFieldKey[] = ['site'];

export const PANEL_MARGIN_MM = 2.5;
export const CONTENT_MARGIN_MM = 5;

/**
 * Type scale for the wide panel, largest first: the family reads across a
 * warehouse aisle, the name identifies the configuration, and the Long SKU is
 * reference data someone reads with the box in their hands.
 *
 * The SKU sits above the electrical line rather than level with it, as the
 * Illustrator files had them. It is the one line that gets read off the carton and
 * typed into something, and a 40-character code at 2.3mm is a squint; it can carry
 * the extra half millimetre now that it breaks at its hyphens instead of being
 * shrunk to fit whatever column is left.
 */
export const FAMILY_SIZE_MM = 7;
export const NAME_SIZE_MM = 3.2;
export const SKU_SIZE_MM = 2.8;
export const DESC_SIZE_MM = 2.3;
export const VERTICAL_TEXT_SIZE_MM = 2.4;

/**
 * Archivo Black stands in for Arial Black, Source Sans 3 for Myriad Pro — the
 * two faces the current Illustrator files declare. The real Adobe/Microsoft
 * faces are listed as fallbacks so a designer who owns them gets an exact match.
 */
export const FONT_DISPLAY = "var(--font-label-display), 'Arial Black', sans-serif";
export const FONT_TEXT = "var(--font-label-text), 'Myriad Pro', sans-serif";

