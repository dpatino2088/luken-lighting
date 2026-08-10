/**
 * Label layout.
 *
 * One engine decides every position, for every size, and reports what it could
 * not place. Three things shape it:
 *
 * Some elements have a legal minimum and some do not. A UPC-A cannot go below 80%
 * of nominal magnification and a QR needs a printable module size, so those two
 * keep a near-fixed footprint no matter how small the label is. Type, margins and
 * the logo have no such floor beyond legibility, so they are what adapts. A label
 * therefore does not scale as a whole — it re-flows, and past a point it has to
 * leave something out.
 *
 * Type sizes move in steps rather than continuously. Labels of a similar size then
 * share the same sizes, which is what keeps a range of cartons looking like one
 * family instead of each label being its own design.
 *
 * The canvas never turns: it is always the long side across, so every template is
 * composed, judged and exported in the same frame. Direction belongs to each field
 * instead, which is what allows a barcode reading across a label whose text runs
 * bottom-to-top. A field left on `auto` follows the template and is turned by the
 * engine only when it cannot fit otherwise; a field set explicitly is turned only
 * as a last resort, and the layout says so. The engine chooses between across and
 * turned; a field arranged by hand may sit on any of the four quarters, because only
 * a person knows which way up the carton it goes on will be stacked.
 *
 * All of the above is what happens when the engine is in charge. A template that has
 * been arranged by hand keeps its boxes and its turns, and the engine is left with
 * the parts nobody can do by eye: where the Long SKU breaks, what type size fills a
 * block, how wide the bars come out at a magnification. Sizes are then drawn as
 * asked, even below what prints reliably, and what that costs is reported in the
 * notes rather than corrected silently.
 *
 * The 130×50 two-section template resolves to step 1 and reproduces the artwork
 * already in production, so nothing that was approved moves.
 */

import {
  BARCODE_BAR_HEIGHT_MM,
  BARCODE_BLOCK_LENGTH_MM,
  BARCODE_DIGITS_MM,
  BARCODE_MIN_BAR_HEIGHT_MM,
  BARCODE_QUIET_MM,
  BARCODE_SYMBOL_MM,
  CONTENT_MARGIN_MM,
  DESC_SIZE_MM,
  FAMILY_SIZE_MM,
  LOGO_HEIGHT_MM,
  LOGO_MAX_WIDTH_MM,
  NAME_SIZE_MM,
  PANEL_MARGIN_MM,
  PLACEMENT_ADVICE,
  PLACEMENT_MIN_MM,
  placementAdvice,
  QR_BLOCK_FACTOR,
  QR_QUIET_MM,
  QR_SIZE_MM,
  SKU_SIZE_MM,
  VERTICAL_TEXT_SIZE_MM,
  isTurned,
  resolveTurns,
  type LabelFieldKey,
  type LabelPlacement,
  type LabelPlacements,
  type LabelShape,
  type LabelTemplate,
  type LabelTurns,
  type Turn,
} from './geometry';
import { SAMPLE_LABEL_DATA } from './labelData';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type LineKey = 'family' | 'name' | 'code' | 'spec';

/**
 * Which pieces the label is being asked to carry.
 *
 * The type comes in as the strings themselves, not as flags: a Long SKU is long
 * enough to need breaking across two lines, and where it breaks decides how deep
 * the block is. An engine that only knew a SKU was *present* would have to leave
 * that to the renderer, which cannot move everything else down to make room.
 */
export interface LabelContent {
  barcode: boolean;
  qr: boolean;
  logo: boolean;
  /** Address / origin line on the fold panel. */
  site: boolean;
  family: string;
  name: string;
  code: string;
  spec: string;
}

export interface LayoutLine {
  key: LineKey;
  /** Exactly what to set. A wrapped block appears as one line per piece. */
  text: string;
  /**
   * Start of the baseline. Upright, that is the left end and `y` is the baseline
   * itself; turned, the text runs up from `y` and `x` is the baseline.
   */
  x: number;
  y: number;
  size: number;
  maxWidth: number;
  turn: Turn;
}

export interface LabelLayout {
  /** The canvas: what the SVG frame and the PDF page measure. Always horizontal. */
  canvas: { w: number; h: number };
  fold: number | null;
  /**
   * The white block. `symbolW` is how wide the bars are drawn inside it, which is
   * the magnification, and `quiet` the mandatory margin at each end of them.
   */
  barcode:
    | (Rect & { turn: Turn; barHeight: number; digitSize: number; symbolW: number; quiet: number })
    | null;
  /** The symbol itself; `quiet` is the white margin drawn around it. */
  qr: (Rect & { quiet: number; turn: Turn }) | null;
  logo: (Rect & { turn: Turn }) | null;
  /** Address and origin: the space the two rows take, set inside it at `size`. */
  site: (Rect & { size: number; turn: Turn }) | null;
  lines: LayoutLine[];
  /**
   * The box the type is set inside — not the extent it happens to fill. This is
   * what a hand-arranged layout stores and hands back, so switching a template to
   * manual reproduces the automatic result exactly instead of re-fitting the type
   * into a tighter box and changing sizes the moment you take control.
   */
  textArea: Rect;
  /** True when every position came from the template rather than from the engine. */
  manual: boolean;
  /** What did not fit, with the reason, so the UI can say so before printing. */
  dropped: { key: string; reason: string }[];
  /** Trade-offs the layout made that are worth knowing about but are not losses. */
  notes: string[];
  /** Type step that was used. 1 = the reference sizes of the 130×50 artwork. */
  step: number;
}

const TYPE_BASE: Record<LineKey, number> = {
  family: FAMILY_SIZE_MM,
  name: NAME_SIZE_MM,
  code: SKU_SIZE_MM,
  spec: DESC_SIZE_MM,
};

/** Space each line takes, as a multiple of its own size. */
const TYPE_LEADING: Record<LineKey, number> = {
  family: 1,
  // Extra air under the family (e.g. LEDA) so the configuration name does not
  // sit against it — the previous 1.9 looked glued on the production art.
  name: 2.6,
  code: 1.9,
  spec: 1.6,
};

/** Below this the type stops being readable in print, so it is dropped instead. */
const TYPE_FLOOR: Record<LineKey, number> = {
  family: 2.2,
  name: 1.5,
  code: 1.5,
  spec: 1.5,
};

/** Coarse steps: nearby sizes land on the same one and look like a set. */
const TYPE_STEPS = [1, 0.85, 0.7, 0.6, 0.5, 0.4, 0.3];

/** Order the lines are set in. */
const RENDER_ORDER: LineKey[] = ['family', 'name', 'code', 'spec'];

/**
 * What gets sacrificed first when the space runs out. The family and the SKU
 * identify the goods, so they are the last to go; the marketing name and the
 * electrical summary are on the spec sheet anyway.
 */
const DROP_ORDER: LineKey[] = ['spec', 'name', 'code', 'family'];

const LINE_LABEL: Record<LineKey, string> = {
  family: 'family name',
  name: 'product name',
  code: 'Long SKU',
  spec: 'electrical line',
};

/**
 * Depth the type needs at its smallest: the family plus the SKU is the least that
 * still identifies the item. Used to decide how much of a short label an upright
 * barcode may claim.
 */
const TYPE_RESERVE_MM = TYPE_FLOOR.family + TYPE_FLOOR.code * TYPE_LEADING.code + 1.25;

/**
 * Shortest line the type may be given.
 *
 * The QR is placed before the type, so without a budget it takes the width it
 * wants and leaves nothing — the lines then still "fit" across and get compressed
 * into an invisible sliver. The symbol yields first.
 */
const MIN_TYPE_LINE_MM = 22;
/** Depth the stack of lines needs, across the reading direction. */
const MIN_TYPE_STACK_MM = 10;
/** Under this a line has no length worth setting, however deep the block is. */
const TYPE_LINE_FLOOR_MM = 10;

/**
 * What each line is worth when two settings have to be compared: how much of the
 * label's job it does. The family carries the shelf, the SKU carries the paperwork.
 */
const TYPE_WEIGHT: Record<LineKey, number> = { family: 3, name: 1.5, code: 2, spec: 1 };

/**
 * Advance width per character, as a fraction of the size, and how much wider each
 * face sets than that.
 *
 * An estimate, deliberately: the renderer measures the real thing from the DOM and
 * is the authority on the final size. The engine only needs to know whether a line
 * is going to run long, which is a decision about millimetres of space, not about
 * the last hundredth of a glyph.
 *
 * Taken from the faces actually used — Source Sans 3 sets caps at 0.566em, digits
 * at 0.497, hyphens at 0.311; Archivo Black sets caps at 0.769 — and then carried
 * 3% wide. Wide, because of the two mistakes available that is the safe one: a line
 * broken a shade before it had to be, rather than one left whole and then shrunk.
 * Not wider, because the same numbers decide which step reads best, and a margin
 * large enough to matter would start choosing for the wrong reasons.
 */
const CHAR_EM: Record<string, number> = {
  '-': 0.32,
  ' ': 0.24,
  '.': 0.27,
  ',': 0.27,
  ':': 0.27,
  '/': 0.43,
  '(': 0.33,
  ')': 0.33,
};
const FACE_WIDTH: Record<LineKey, number> = { family: 1.36, name: 1, code: 1, spec: 1 };

function estimateWidth(text: string, size: number, key: LineKey): number {
  let em = 0;
  for (const ch of text) {
    if (ch >= '0' && ch <= '9') em += 0.512;
    else if (ch >= 'A' && ch <= 'Z') em += 0.583;
    else if (ch >= 'a' && ch <= 'z') em += 0.515;
    else em += CHAR_EM[ch] ?? 0.52;
  }
  return em * size * FACE_WIDTH[key];
}

/** Space a wrapped-on line takes, as a multiple of its own size. Tighter than
 * the gap between two different lines: the pieces belong to one reading. */
const WRAP_LEADING = 1.25;

/** How many lines each piece of type may be broken across. */
const WRAP_MAX: Record<LineKey, number> = { family: 1, name: 2, code: 3, spec: 2 };

/** Lines that may be broken, in the order the search considers them. */
const WRAP_KEYS: LineKey[] = ['code', 'name', 'spec'];

/**
 * Points a line may be broken at: after a hyphen, and after a space.
 *
 * The hyphen stays on the line it ends. `ALH15-32-TRA-LED-` followed by
 * `MOD-WH-CR90` reads as one interrupted code; without the trailing hyphen it
 * reads as two codes, which is worse than small type.
 */
function breakPieces(text: string): string[] {
  const pieces: string[] = [];
  let current = '';
  for (const ch of text) {
    current += ch;
    if (ch === '-' || ch === ' ') {
      pieces.push(current);
      current = '';
    }
  }
  if (current) pieces.push(current);
  return pieces;
}

/**
 * The fitter asks for the same break of the same line many times over — once per
 * step, per candidate area, per combination — and the answer only depends on the
 * arguments, so it is worked out once.
 */
const splitCache = new Map<string, string[]>();

/** Breaks `text` into exactly `count` lines, as evenly as its break points allow. */
function splitInto(text: string, count: number, size: number, key: LineKey): string[] {
  const cacheKey = `${key}|${count}|${size.toFixed(3)}|${text}`;
  const cached = splitCache.get(cacheKey);
  if (cached) return cached;
  const result = computeSplit(text, count, size, key);
  // A single label needs a few dozen entries; the cap is only there so a long
  // session cannot grow this without bound.
  if (splitCache.size > 2000) splitCache.clear();
  splitCache.set(cacheKey, result);
  return result;
}

/**
 * Evenly, because what costs legibility is the longest of the lines — that is the
 * one the renderer has to shrink — so the split that keeps the maximum down is the
 * one that reads best.
 */
function computeSplit(text: string, count: number, size: number, key: LineKey): string[] {
  const pieces = breakPieces(text);
  if (count <= 1 || pieces.length < count) return [text];

  const line = (from: number, to: number) => pieces.slice(from, to).join('').trimEnd();
  const width = (from: number, to: number) => estimateWidth(line(from, to), size, key);
  const memo = new Map<string, { worst: number; at: number }>();

  /** Best achievable longest-line for pieces[from..] split into `parts` lines. */
  const solve = (from: number, parts: number): { worst: number; at: number } => {
    if (parts === 1) return { worst: width(from, pieces.length), at: pieces.length };
    const seen = memo.get(`${from},${parts}`);
    if (seen) return seen;
    let best = { worst: Infinity, at: from + 1 };
    // Leave at least one piece for every line that still has to be filled.
    for (let cut = from + 1; cut <= pieces.length - (parts - 1); cut += 1) {
      const worst = Math.max(width(from, cut), solve(cut, parts - 1).worst);
      if (worst < best.worst) best = { worst, at: cut };
    }
    memo.set(`${from},${parts}`, best);
    return best;
  };

  const lines: string[] = [];
  let at = 0;
  for (let left = count; left > 0; left -= 1) {
    const cut = left === 1 ? pieces.length : solve(at, left).at;
    lines.push(line(at, cut));
    at = cut;
  }
  return lines;
}

interface TypeBlock {
  key: LineKey;
  size: number;
  /** The line, broken at its own break points where it had to be. */
  parts: string[];
}

/**
 * Size a block will really be set at.
 *
 * Anything still over its column is shrunk by the renderer, which measures the
 * live text — so a 2.3mm SKU in a column that only takes 70% of it is a 1.6mm SKU
 * on the printed carton, whatever the layout nominally asked for. Deciding
 * anything about legibility from the nominal size would be deciding it from a
 * number nobody sees.
 */
function renderedSize(block: TypeBlock, room: number): number {
  const widest = Math.max(...block.parts.map((p) => estimateWidth(p, block.size, block.key)));
  return widest > 0 ? block.size * Math.min(1, room / widest) : block.size;
}

/**
 * How much of the type lands at a size that still reads in print.
 *
 * Saturating at the floor is the point: past it, a larger family name buys
 * nothing, so the measure stops rewarding it and the comparison turns on whichever
 * lines are still under. It is what lets a step down be worth taking — 4.9mm of
 * family with an illegible SKU beside it loses to 4.2mm with a SKU that reads.
 */
function readableScore(blocks: TypeBlock[], room: number): number {
  let score = 0;
  for (const block of blocks) {
    score += TYPE_WEIGHT[block.key] * Math.min(1, renderedSize(block, room) / TYPE_FLOOR[block.key]);
  }
  return score;
}

/**
 * Size the SKU will really be set at, or 0 when there is none.
 *
 * Its own measure, separate from the rest of the type: it is the line somebody has
 * to read off a carton and type into a system, and it is the only one long enough
 * that the column, rather than the chosen step, usually decides how big it comes
 * out. Left to the general measure it loses every argument to the family name.
 */
function codeSize(blocks: TypeBlock[], room: number): number {
  const code = blocks.find((b) => b.key === 'code');
  return code ? renderedSize(code, room) : 0;
}

/** How much readable type an arrangement yields, for choosing between areas. */
function typeScore(blocks: TypeBlock[], room: number): number {
  let score = 0;
  for (const block of blocks) {
    // Breaking a line keeps it readable, so it costs the arrangement little — but
    // a column wide enough not to need the break is still the better one.
    score +=
      (renderedSize(block, room) * TYPE_WEIGHT[block.key]) / (1 + 0.15 * (block.parts.length - 1));
  }
  return score;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

const DIGIT_SIZE = BARCODE_DIGITS_MM * 0.72;
const BARCODE_ALONG = BARCODE_BLOCK_LENGTH_MM;

/** QR sizes offered, largest first. Stepped for the same reason as the type. */
const QR_LADDER = [QR_SIZE_MM, 15, 14, 13, 12, 11];
function qrQuiet(size: number): number {
  return Math.max(1.2, size * (QR_QUIET_MM / QR_SIZE_MM));
}
/** Smallest block a QR can occupy, quiet zone included. */
const QR_MIN_BLOCK = QR_LADDER[QR_LADDER.length - 1] + qrQuiet(QR_LADDER[QR_LADDER.length - 1]) * 2;
/**
 * Block below which a QR is not worth arranging the label around. Under 14mm the
 * module drops near the limit of what a phone reads off printed carton, so the
 * layout would rather give the type less room than shrink the symbol past this.
 */
const QR_GOOD_BLOCK = 14 + qrQuiet(14) * 2;

/** How far the site line runs, as a multiple of its own size. */
const SITE_LENGTH_FACTOR = 11;
/**
 * Depth of the two lines across the reading direction: the ascenders of the first
 * plus the 1.15 offset to the second. Descenders of the second reach a fraction
 * further, into the panel margin, which is where the production artwork puts them.
 */
const SITE_DEPTH_FACTOR = 2.15;

const FIELD_LABEL: Record<LabelFieldKey, string> = {
  barcode: 'barcode',
  qr: 'QR',
  logo: 'logo',
  text: 'text block',
  site: 'site line',
};

function typeSizes(step: number): Record<LineKey, number> {
  return {
    family: Math.max(TYPE_BASE.family * step, TYPE_FLOOR.family),
    name: Math.max(TYPE_BASE.name * step, TYPE_FLOOR.name),
    code: Math.max(TYPE_BASE.code * step, TYPE_FLOOR.code),
    spec: Math.max(TYPE_BASE.spec * step, TYPE_FLOOR.spec),
  };
}

function stackDepth(keys: LineKey[], sizes: Record<LineKey, number>): number {
  let total = 0;
  let first = true;
  for (const key of RENDER_ORDER) {
    if (!keys.includes(key)) continue;
    // The first baseline sits one size in from the edge; the rest advance by their
    // own leading, which is what the production artwork does.
    total += first ? sizes[key] : sizes[key] * TYPE_LEADING[key];
    first = false;
  }
  return total;
}

/**
 * Is `b` the better setting? Three questions in order: does anything fall under
 * its floor, how large does the SKU come out, and how does the whole read.
 *
 * The same order settles both the breaks and the step, deliberately — they are one
 * decision. Ranking the SKU second and only then the whole is what stops a third
 * SKU line being bought with the depth that would have kept the product name at
 * full size, while still leaving the SKU ahead of a marginally larger family name.
 */
function better(a: TypeBlock[], b: TypeBlock[], room: number): boolean {
  const floorA = readableScore(a, room);
  const floorB = readableScore(b, room);
  if (Math.abs(floorA - floorB) > 1e-6) return floorB > floorA;
  const codeA = codeSize(a, room);
  const codeB = codeSize(b, room);
  if (Math.abs(codeA - codeB) > 1e-6) return codeB > codeA;
  return typeScore(b, room) > typeScore(a, room) + 1e-6;
}

/**
 * Sets the lines at `sizes` and spends whatever depth is left over on breaking the
 * ones that run long.
 *
 * Only the slack is spent, never the sizes: breaking a line to fit is worth doing,
 * but not at the price of a deeper stack that would drag every other line down a
 * step with it. Where the depth is not there, the caller decides whether to come
 * down a step and buy some.
 *
 * Which lines get the slack is searched rather than ranked, because the obvious
 * ranking — the SKU first, it being the one read by hand — spends everything on a
 * third SKU line and leaves the product name to be squeezed to 2.2mm beside a
 * 2.3mm SKU. Twelve combinations at most, and the one that reads best wins.
 */
function typeBlocks(
  texts: Record<LineKey, string>,
  keys: LineKey[],
  sizes: Record<LineKey, number>,
  lineRoom: number,
  stackRoom: number
): TypeBlock[] {
  const plain: TypeBlock[] = RENDER_ORDER.filter((key) => keys.includes(key)).map((key) => ({
    key,
    size: sizes[key],
    parts: [texts[key]],
  }));

  const slack = stackRoom - stackDepth(keys, sizes);
  const wrappable = WRAP_KEYS.filter((key) => keys.includes(key));
  if (slack <= 0 || wrappable.length === 0) return plain;

  let best = plain;
  const chosen = new Map<LineKey, string[]>();

  const walk = (index: number, depth: number) => {
    if (index === wrappable.length) {
      const candidate = plain.map((b) => ({ ...b, parts: chosen.get(b.key) ?? b.parts }));
      if (better(best, candidate, lineRoom)) best = candidate;
      return;
    }
    const key = wrappable[index];
    const size = sizes[key];
    for (let count = 1; count <= WRAP_MAX[key]; count += 1) {
      const extra = (count - 1) * size * WRAP_LEADING;
      if (depth + extra > slack) break;
      const parts = splitInto(texts[key], count, size, key);
      // Ran out of break points: more lines cannot help this one.
      if (count > 1 && parts.length < count) break;
      chosen.set(key, parts);
      walk(index + 1, depth + extra);
    }
    chosen.delete(key);
  };
  walk(0, 0);

  return best;
}

/**
 * Fits as much type as possible into `area`: dropping only what cannot be set at
 * any size, then choosing the step that leaves the most of it readable.
 *
 * The step is not simply the largest that fits. A long SKU in a narrow column is
 * shrunk by the renderer until it does fit, and a step down — which shortens every
 * line and frees the depth to break the SKU in two — can leave that SKU larger on
 * the carton than the bigger step did, at the cost of a slightly smaller family
 * name. That trade is worth taking, so every step is measured: first that no line
 * falls under its floor, then how large the SKU actually comes out.
 *
 * Turned, the stack advances across the width and each line runs up the height —
 * the same algorithm with the two axes exchanged.
 */
function fitType(
  texts: Record<LineKey, string>,
  wanted: LineKey[],
  area: Rect,
  turn: Turn
): {
  lines: LayoutLine[];
  kept: LineKey[];
  blocks: TypeBlock[];
  lineRoom: number;
  step: number;
  dropped: LineKey[];
} {
  const lineRoom = isTurned(turn) ? area.h : area.w;
  // Both axes have to hold. A block with depth but no length would otherwise be set
  // at full size and squeezed to nothing by the fitter — text that is on the label
  // in name only, which is worse than being told it did not fit.
  const stackRoom = lineRoom < TYPE_LINE_FLOOR_MM ? 0 : isTurned(turn) ? area.w : area.h;

  const smallest = TYPE_STEPS[TYPE_STEPS.length - 1];
  const dropped: LineKey[] = [];
  let keys = [...wanted];

  // A line goes only when there is no size at which it would have fitted.
  while (keys.length > 0 && stackDepth(keys, typeSizes(smallest)) > stackRoom) {
    const next = DROP_ORDER.find((k) => keys.includes(k));
    if (!next) break;
    keys = keys.filter((k) => k !== next);
    dropped.push(next);
  }

  let chosen: { step: number; blocks: TypeBlock[] } | null = null;
  for (const candidate of TYPE_STEPS) {
    const sizes = typeSizes(candidate);
    if (stackDepth(keys, sizes) > stackRoom) continue;
    const blocks = typeBlocks(texts, keys, sizes, lineRoom, stackRoom);
    // Steps run largest first and the comparison is strict, so the largest step
    // that nothing argues against is the one that gets used.
    if (!chosen || better(chosen.blocks, blocks, lineRoom)) chosen = { step: candidate, blocks };
  }
  const settled = chosen ?? {
    step: smallest,
    blocks: typeBlocks(texts, keys, typeSizes(smallest), lineRoom, stackRoom),
  };
  const step = settled.step;
  const blocks = settled.blocks;
  const kept = blocks.map((b) => b.key);

  const lines: LayoutLine[] = [];
  // How far into the block this baseline sits, measured from the edge the type
  // starts at — which the direction then turns into a point on the canvas.
  let depth = 0;
  let first = true;
  for (const block of blocks) {
    block.parts.forEach((text, index) => {
      depth +=
        index > 0
          ? block.size * WRAP_LEADING
          : first
            ? block.size
            : block.size * TYPE_LEADING[block.key];
      lines.push({
        key: block.key,
        text,
        ...baselineAt(area, turn, depth),
        size: block.size,
        maxWidth: lineRoom,
        turn,
      });
      first = false;
    });
  }

  return { lines, kept, blocks, lineRoom, step, dropped };
}

/**
 * Where a baseline lands, `depth` millimetres into a block set in a direction.
 *
 * Type grows away from its baseline the way the glyphs are turned, so each quarter
 * starts from a different corner: across, lines stack down from the top; turned they
 * stack rightwards from the left; upside down they stack up from the bottom; reading
 * top-to-bottom they stack leftwards from the right. All four keep the first line
 * against the edge the reader starts at, which is what makes a hand-turned block sit
 * in its box instead of hanging out of one side of it.
 */
function baselineAt(area: Rect, turn: Turn, depth: number): { x: number; y: number } {
  switch (turn) {
    case 90:
      return { x: area.x + depth, y: area.y + area.h };
    case 180:
      return { x: area.x + area.w, y: area.y + area.h - depth };
    case 270:
      return { x: area.x + area.w - depth, y: area.y };
    default:
      return { x: area.x, y: area.y + depth };
  }
}

/** Largest QR that fits the given box. */
function fitQr(availW: number, availH: number): { size: number; quiet: number; block: number } | null {
  for (const size of QR_LADDER) {
    const quiet = qrQuiet(size);
    const block = size + quiet * 2;
    if (block <= availW && block <= availH) return { size, quiet, block };
  }
  return null;
}

/** Footprint of the barcode block at a given turn, for a given bar height. */
function barcodeFootprint(turn: Turn, bars: number): { w: number; h: number } {
  const across = bars + BARCODE_DIGITS_MM;
  return isTurned(turn) ? { w: across, h: BARCODE_ALONG } : { w: BARCODE_ALONG, h: across };
}

/** Footprint of the site line's two rows, at a size and a direction. */
function siteFootprint(size: number, turn: Turn): { w: number; h: number } {
  const along = size * SITE_LENGTH_FACTOR;
  const depth = size * SITE_DEPTH_FACTOR;
  return isTurned(turn) ? { w: depth, h: along } : { w: along, h: depth };
}

/**
 * The direction each field came out drawn in, which is not always the one asked for.
 *
 * A barcode that only fitted a fold panel turned, or one turned by hand, is on a
 * quarter the settings never mentioned. Anything reporting or editing directions has
 * to read them off the drawing like this, or it will disagree with the artwork.
 */
export function drawnTurns(
  layout: LabelLayout,
  template: Pick<LabelTemplate, 'orientation' | 'rotation'>
): Record<LabelFieldKey, Turn> {
  const asked = resolveTurns(template);
  return {
    barcode: layout.barcode?.turn ?? asked.barcode,
    qr: layout.qr?.turn ?? asked.qr,
    logo: layout.logo?.turn ?? asked.logo,
    text: layout.lines[0]?.turn ?? asked.text,
    site: layout.site?.turn ?? asked.site,
  };
}

/**
 * The automatic layout, as something that can be handed to a person to adjust.
 *
 * Taking control of a template starts from exactly what the engine produced, so
 * the first thing that happens when you switch to manual is nothing at all.
 */
export function placementsOf(layout: LabelLayout): LabelPlacements {
  const out: LabelPlacements = {};
  // Rounded to tenths, the same as the column stores and the editor's fields show:
  // a barcode whose height is 30.096000000000004 is nobody's idea of a measurement.
  const box = (r: Rect): LabelPlacement => ({
    x: Math.round(r.x * 10) / 10,
    y: Math.round(r.y * 10) / 10,
    w: Math.round(r.w * 10) / 10,
    h: Math.round(r.h * 10) / 10,
  });

  if (layout.barcode) out.barcode = box(layout.barcode);
  if (layout.qr) {
    out.qr = box({
      x: layout.qr.x - layout.qr.quiet,
      y: layout.qr.y - layout.qr.quiet,
      w: layout.qr.w + layout.qr.quiet * 2,
      h: layout.qr.h + layout.qr.quiet * 2,
    });
  }
  if (layout.logo) out.logo = box(layout.logo);
  if (layout.lines.length > 0) out.text = box(layout.textArea);
  if (layout.site) out.site = box(layout.site);
  return out;
}

/**
 * A label whose every position comes from the template.
 *
 * The engine still decides the things a person cannot reasonably be asked to
 * compute — how many lines the SKU breaks into, what type size fills the box it
 * has been given, how wide the bars are at a magnification — but where each block
 * sits and how big it is comes from the arrangement. Sizes are clamped to what
 * stays printable rather than accepted as given, and every clamp is reported.
 */
function manualLayout(
  template: LabelShape,
  content: LabelContent,
  auto: LabelLayout,
  turns: LabelTurns
): LabelLayout {
  const canvas = auto.canvas;
  const placements = template.placements ?? {};
  const notes: string[] = [];
  const dropped: { key: string; reason: string }[] = [];

  /**
   * Which way each field is drawn: the direction the engine settled on, not the one
   * the template asked for.
   *
   * The two differ whenever something only fitted turned — a barcode in a 30mm fold
   * panel on artwork that otherwise reads across is the common case. Reading the
   * setting here instead would flip that barcode upright the moment the layout was
   * taken over by hand, which is the opposite of starting from what you see.
   */
  const drawn: Record<LabelFieldKey, Turn> = {
    barcode: placements.barcode?.turn ?? auto.barcode?.turn ?? turns.barcode,
    qr: placements.qr?.turn ?? auto.qr?.turn ?? turns.qr,
    logo: placements.logo?.turn ?? auto.logo?.turn ?? turns.logo,
    text: placements.text?.turn ?? auto.lines[0]?.turn ?? turns.text,
    site: placements.site?.turn ?? auto.site?.turn ?? turns.site,
  };

  const inside = (box: Rect): Rect => ({
    x: clamp(box.x, 0, Math.max(0, canvas.w - box.w)),
    y: clamp(box.y, 0, Math.max(0, canvas.h - box.h)),
    w: Math.min(box.w, canvas.w),
    h: Math.min(box.h, canvas.h),
  });

  /** Something has to be left to draw in, and to grab hold of again. */
  const atLeast = (box: Rect): Rect => ({
    ...box,
    w: Math.max(box.w, PLACEMENT_MIN_MM),
    h: Math.max(box.h, PLACEMENT_MIN_MM),
  });

  // ── Barcode ────────────────────────────────────────────────────────────────
  // Along the box is magnification, across it is bar height: the two numbers a print
  // buyer adjusts. Both are drawn as asked, however small, and both say what was
  // given up — a UPC-A under 80% is out of GS1 spec, and being told that is more use
  // than being stopped, because some cartons genuinely have no room for a legal one.
  let barcode = auto.barcode;
  const barPlace = placements.barcode;
  if (content.barcode && barPlace) {
    const turn = drawn.barcode;
    const box = inside(barPlace);
    const along = isTurned(turn) ? box.h : box.w;
    const across = isTurned(turn) ? box.w : box.h;
    const scale = Math.max(along / BARCODE_ALONG, PLACEMENT_MIN_MM / BARCODE_ALONG);
    const digits = DIGIT_SIZE * scale;
    const bars = Math.max(across - BARCODE_DIGITS_MM * scale, PLACEMENT_MIN_MM * 0.5);
    const w = isTurned(turn) ? bars + BARCODE_DIGITS_MM * scale : BARCODE_ALONG * scale;
    const h = isTurned(turn) ? BARCODE_ALONG * scale : bars + BARCODE_DIGITS_MM * scale;
    const spot = inside({ x: box.x, y: box.y, w, h });

    barcode = {
      x: spot.x,
      y: spot.y,
      w,
      h,
      turn,
      barHeight: bars,
      digitSize: digits,
      symbolW: BARCODE_SYMBOL_MM * scale,
      quiet: BARCODE_QUIET_MM * scale,
    };

    if (scale < PLACEMENT_ADVICE.barcodeScale.min - 0.001) {
      notes.push(
        `The barcode is at ${Math.round(scale * 80)}% magnification. GS1 sets 80% as the smallest a UPC-A may be printed — below it the symbol is out of spec and a retailer's scanner may refuse it. ${BARCODE_ALONG.toFixed(1)}mm along gives it back.`
      );
    }
    if (bars < BARCODE_MIN_BAR_HEIGHT_MM * Math.min(scale, 1) - 0.01) {
      notes.push(
        `The bars are ${bars.toFixed(1)}mm. Under ${BARCODE_MIN_BAR_HEIGHT_MM}mm a truncated symbol needs the reader aimed squarely at it, and a fixed scanner at a till often will not find it at all.`
      );
    } else if (bars < BARCODE_BAR_HEIGHT_MM * scale - 0.01) {
      notes.push(
        `The bars are ${bars.toFixed(1)}mm instead of ${(BARCODE_BAR_HEIGHT_MM * scale).toFixed(1)}mm. It still scans, but the reader has to be aimed more squarely at it.`
      );
    }
  } else if (content.barcode && !barcode) {
    dropped.push({ key: 'barcode', reason: 'The barcode has no place on this arrangement.' });
  }

  // ── QR ─────────────────────────────────────────────────────────────────────
  // Square, so the smaller side of the box decides, and the quiet zone scales with
  // the symbol because it is measured in modules.
  let qr = auto.qr;
  const qrPlace = placements.qr;
  if (content.qr && qrPlace) {
    const box = inside(qrPlace);
    const block = Math.min(box.w, box.h);
    // The block holds the symbol plus two quiet zones, and the quiet zone is a
    // proportion of the symbol, so the symbol follows from the block directly.
    const size = Math.max(block / QR_BLOCK_FACTOR, PLACEMENT_MIN_MM);
    const quiet = qrQuiet(size);
    const spot = inside({ x: box.x, y: box.y, w: size + quiet * 2, h: size + quiet * 2 });
    qr = { x: spot.x + quiet, y: spot.y + quiet, w: size, h: size, quiet, turn: drawn.qr };
    if (size < PLACEMENT_ADVICE.qr.min - 0.01) {
      notes.push(
        `The QR is ${size.toFixed(1)}mm. Below ${PLACEMENT_ADVICE.qr.min}mm the longest product URL puts its module under 0.3mm, which carton printing loses — the code prints and simply does not read.`
      );
    }
  }

  // ── Logo ───────────────────────────────────────────────────────────────────
  // The wordmark is the one element with no size of its own: it is whatever its box
  // makes it, and it is set along the box rather than across it. So once the box has
  // been reshaped, the box is what says which way it runs — a mark laid across a box
  // twice as tall as it is wide comes out a third of the space it was given and
  // adrift in it, which is a box in the editor that describes nothing that reaches
  // the carton.
  //
  // Left at the size the engine gave it, it keeps the engine's direction, including
  // the fallback where a wordmark could not be stood up and was laid down instead.
  // Deriving that from the shape would flip it the moment the layout was taken over
  // by hand. A turn set with the rotate control wins over both.
  let logo = auto.logo;
  const logoPlace = placements.logo;
  if (content.logo && logoPlace) {
    const box = inside(atLeast(logoPlace));
    // A tenth of a millimetre is what the arrangement is stored to, so anything
    // within that is the engine's own box coming back rather than a new one.
    const asDrawn =
      auto.logo && Math.abs(auto.logo.w - box.w) < 0.11 && Math.abs(auto.logo.h - box.h) < 0.11
        ? auto.logo.turn
        : null;
    const alongBox: Turn = box.h > box.w ? 90 : 0;
    logo = { ...box, turn: logoPlace.turn ?? asDrawn ?? alongBox };
  }

  // ── Type ───────────────────────────────────────────────────────────────────
  // The box is given; how many lines the SKU breaks into and at what size is still
  // the engine's, because that is the part nobody can do by eye.
  const wanted = RENDER_ORDER.filter((key) => content[key]);
  const textArea = placements.text ? inside(atLeast(placements.text)) : auto.textArea;
  const fitted = fitType(content, wanted, textArea, drawn.text);
  for (const key of fitted.dropped) {
    dropped.push({
      key,
      reason: `No room for the ${LINE_LABEL[key]} in a text block of ${textArea.w.toFixed(1)} × ${textArea.h.toFixed(1)}mm. Make the block bigger or drag it somewhere with more room.`,
    });
  }

  const textAdvice = placementAdvice('text', drawn.text);
  if (textArea.w < textAdvice.minW - 0.01 || textArea.h < textAdvice.minH - 0.01) {
    notes.push(
      `The text block is ${textArea.w.toFixed(1)} × ${textArea.h.toFixed(1)}mm, under the ${textAdvice.minW.toFixed(0)} × ${textAdvice.minH.toFixed(0)}mm a full line of type needs. What is drawn is what fitted.`
    );
  }

  const codeBlock = fitted.blocks.find((b) => b.key === 'code');
  if (codeBlock) {
    const set = renderedSize(codeBlock, fitted.lineRoom);
    if (set < codeBlock.size * 0.8) {
      notes.push(
        `The Long SKU comes out at about ${set.toFixed(1)}mm instead of ${codeBlock.size.toFixed(1)}mm: even broken over ${codeBlock.parts.length} lines it is longer than the ${fitted.lineRoom.toFixed(1)}mm column. A wider text block gives it back.`
      );
    }
  }

  // ── Site line ──────────────────────────────────────────────────────────────
  let site = content.site ? auto.site : null;
  const sitePlace = content.site ? placements.site : undefined;
  if (sitePlace) {
    const turn = drawn.site;
    // Two rows at a size the type step sets, so this one moves and turns but is not
    // resized: dragging its corners would only ever misreport where the ink lands.
    const size = clamp(VERTICAL_TEXT_SIZE_MM * fitted.step, 1.4, VERTICAL_TEXT_SIZE_MM);
    const f = siteFootprint(size, turn);
    site = { ...inside({ x: sitePlace.x, y: sitePlace.y, ...f }), size, turn };
  }

  return {
    canvas,
    fold: auto.fold,
    barcode,
    qr,
    logo,
    site,
    lines: fitted.lines,
    textArea,
    dropped,
    notes,
    step: fitted.step,
    manual: true,
  };
}

export function layoutLabel(template: LabelShape, content: LabelContent): LabelLayout {
  const W = template.width_mm;
  const H = template.height_mm;
  const turns: LabelTurns = resolveTurns(template);
  const dropped: { key: string; reason: string }[] = [];
  const notes: string[] = [];

  /** Says out loud that a field had to be turned against an explicit setting. */
  const noteTurned = (field: LabelFieldKey, used: Turn) => {
    if (!turns.forced[field]) return;
    notes.push(
      `The ${FIELD_LABEL[field]} is set to ${turns[field] === 90 ? 'vertical' : 'horizontal'}, but it only fits ${used === 90 ? 'turned' : 'across'} here, so that is how it is drawn.`
    );
  };

  const twoUp = template.sections === 2 && template.fold_mm !== null;
  const fold = twoUp ? Number(template.fold_mm) : null;

  // Margins are a proportion of the smaller side, capped at the values the
  // production artwork uses. A 5mm margin on a 30mm label would eat a third of it.
  const margin = clamp(Math.min(W, H) / 10, 1.5, CONTENT_MARGIN_MM);
  const panelMargin = clamp(margin / 2, 1, PANEL_MARGIN_MM);
  const gap = clamp(margin / 2, 1, 3);
  const typeGap = clamp(margin * 0.6, 1, 3);

  let barcode: LabelLayout['barcode'] = null;
  let qr: LabelLayout['qr'] = null;
  let logo: LabelLayout['logo'] = null;
  let site: LabelLayout['site'] = null;

  let wantBarcode = content.barcode;
  let wantQr = content.qr;
  let wantLogo = content.logo;

  // ── Narrow panel of a two-section label ────────────────────────────────────
  // Preference order matters. The barcode goes here when it can, because that is
  // the production layout and it leaves the whole main panel for the type. When
  // the strip cannot take a barcode either way it is still wide enough for a QR on
  // most sizes, and moving the QR here is what frees the main panel for a barcode
  // instead of losing one of the two symbols.
  // What the fold panel has left, shrunk as each element takes its place. The site
  // line is set in whatever remains, so it cannot land on top of a symbol.
  const foldFree = {
    x0: panelMargin,
    y0: panelMargin,
    x1: twoUp ? (fold as number) - panelMargin : 0,
    y1: H - panelMargin,
  };

  if (twoUp) {
    const innerW = foldFree.x1 - foldFree.x0;
    const innerH = foldFree.y1 - foldFree.y0;

    // On `auto` the other direction is tried here too: a 30mm fold panel cannot take
    // an upright symbol, so artwork that reads across still gets a turned barcode
    // rather than none. Pinned, it is left for the main panel instead, where there
    // is width for it — turning a barcode someone asked to keep across is the last
    // thing to try, not the first.
    const attempts: Turn[] =
      turns.forced.barcode ? [turns.barcode] : turns.barcode === 0 ? [0, 90] : [90, 0];

    for (const turn of attempts) {
      if (!wantBarcode) break;
      const room = turn === 0 ? innerH : innerW;
      const bars = clamp(room - BARCODE_DIGITS_MM, BARCODE_MIN_BAR_HEIGHT_MM, BARCODE_BAR_HEIGHT_MM);
      const box = barcodeFootprint(turn, bars);
      if (box.w > innerW || box.h > innerH) continue;

      barcode = {
        x: panelMargin,
        y: panelMargin,
        ...box,
        turn,
        barHeight: bars,
        digitSize: DIGIT_SIZE,
        symbolW: BARCODE_SYMBOL_MM,
        quiet: BARCODE_QUIET_MM,
      };
      wantBarcode = false;
      // Turned it runs up the left of the panel, upright it lies across the top.
      if (isTurned(turn)) foldFree.x0 = barcode.x + barcode.w;
      else foldFree.y0 = barcode.y + barcode.h;
      if (turn !== turns.barcode) noteTurned('barcode', turn);
      if (bars < BARCODE_BAR_HEIGHT_MM) {
        notes.push(
          `The bars are ${bars.toFixed(1)}mm instead of ${BARCODE_BAR_HEIGHT_MM}mm so the symbol fits the fold panel. It still scans, but the reader has to be aimed more squarely at it.`
        );
      }
    }

    // With the barcode gone to the main panel, the QR follows it there if that panel
    // can hold both beside the type. Only when it cannot is the fold panel used,
    // because filling that strip costs the address and origin line.
    const mainRoom = W - (fold as number) - margin * 2;
    const mainHoldsBoth =
      mainRoom >=
      barcodeFootprint(0, BARCODE_BAR_HEIGHT_MM).w +
        gap +
        (turns.text === 90 ? MIN_TYPE_STACK_MM : MIN_TYPE_LINE_MM) +
        typeGap +
        QR_GOOD_BLOCK;

    if (!barcode && wantQr && !mainHoldsBoth) {
      const fitted = fitQr(innerW, innerH);
      if (fitted) {
        qr = {
          x: panelMargin + (innerW - fitted.block) / 2 + fitted.quiet,
          y: panelMargin + fitted.quiet,
          w: fitted.size,
          h: fitted.size,
          quiet: fitted.quiet,
          turn: turns.qr,
        };
        wantQr = false;
        foldFree.y0 = panelMargin + fitted.block;

        // Whatever is left under the QR is the only place a logo can go on a label
        // this small, and the wordmark matters more here than on the roomy
        // templates where it sits in the main panel.
        if (wantLogo) {
          const logoH = clamp(foldFree.y1 - (foldFree.y0 + gap), 0, LOGO_HEIGHT_MM);
          if (innerW >= 6 && logoH >= 2.5) {
            logo = { x: panelMargin, y: H - panelMargin - logoH, w: innerW, h: logoH, turn: 0 };
            wantLogo = false;
            foldFree.y1 = logo.y;
          }
        }
      }
    }
  }

  // ── Main panel ─────────────────────────────────────────────────────────────
  const panelX = twoUp ? (fold as number) : 0;
  const cx = panelX + margin;
  const cy = margin;
  const cw = W - panelX - margin * 2;
  const ch = H - margin * 2;

  // Room the type needs before anything else may claim space, in each direction.
  const textLineRoom = turns.text === 90 ? MIN_TYPE_STACK_MM : MIN_TYPE_LINE_MM;
  // Turned type reads along the height, so an upright barcode eating the bottom of
  // the panel shortens its lines rather than its stack. It needs more left over.
  const barcodeHeightBudget = turns.text === 90 ? 25 : TYPE_RESERVE_MM;

  if (wantBarcode) {
    // Full-height bars leave the type room beside them on a long panel, and only
    // there does the barcode have to be shortened: measuring that first is what
    // keeps a 130mm label from truncating its symbol for space it never needed.
    const roomBeside = cw - barcodeFootprint(0, BARCODE_BAR_HEIGHT_MM).w - gap;
    const typeGoesBeside =
      roomBeside >= textLineRoom + (wantQr ? QR_GOOD_BLOCK + typeGap : 0);

    const attempts: Turn[] = turns.barcode === 0 ? [0, 90] : [90, 0];
    for (const turn of attempts) {
      const room =
        turn === 0
          ? typeGoesBeside
            ? ch
            : ch - barcodeHeightBudget
          : // Turned, the bars run across the width, so the type column is what
            // limits them.
            cw - textLineRoom - gap;
      const bars = clamp(room - BARCODE_DIGITS_MM, BARCODE_MIN_BAR_HEIGHT_MM, BARCODE_BAR_HEIGHT_MM);
      const box = barcodeFootprint(turn, bars);
      if (box.w > cw || box.h > ch) continue;

      barcode = {
        // Upright it sits on the bottom edge; turned it runs up the left side.
        x: cx,
        y: turn === 0 ? cy + ch - box.h : cy,
        ...box,
        turn,
        barHeight: bars,
        digitSize: DIGIT_SIZE,
        symbolW: BARCODE_SYMBOL_MM,
        quiet: BARCODE_QUIET_MM,
      };
      wantBarcode = false;
      if (turn !== turns.barcode) noteTurned('barcode', turn);
      if (bars < BARCODE_BAR_HEIGHT_MM) {
        notes.push(
          `The bars are ${bars.toFixed(1)}mm instead of ${BARCODE_BAR_HEIGHT_MM}mm to leave room for the type. It still scans, but the reader has to be aimed more squarely at it.`
        );
      }
      break;
    }

    if (wantBarcode) {
      dropped.push({
        key: 'barcode',
        reason: `The barcode needs ${BARCODE_ALONG.toFixed(1)}mm of length including its quiet zones, and the panel is ${cw.toFixed(1)} × ${ch.toFixed(1)}mm. A UPC-A cannot be printed below 80% of nominal size.`,
      });
    }
  }

  // The barcode placed in this panel, which is the only one the arrangement below
  // has to work around — one in the fold panel is already out of the way.
  const mainBarcode = barcode && barcode.x < cx + cw && barcode.x >= cx ? barcode : null;
  const bcW = mainBarcode ? mainBarcode.w : 0;
  const bcH = mainBarcode ? mainBarcode.h : 0;
  const bcUpright = mainBarcode?.turn === 0;

  /**
   * Two arrangements.
   *
   * `beside` is the production reading order — symbol, then type, then QR — and
   * gives the type the full height of the panel. It needs enough width left for
   * both the type and a QR worth printing.
   *
   * `above` is the fallback for short labels, where an upright barcode has already
   * taken most of the width: the type goes in the strip above it. Narrower type,
   * but a QR at full size and nothing overlapping.
   */
  const besideRoom = cw - (bcUpright ? bcW + gap : 0);
  const beside =
    !bcUpright ||
    besideRoom >= textLineRoom + (wantQr ? QR_GOOD_BLOCK + typeGap : 0);

  // Left edge of the type: past a turned barcode always, past an upright one only
  // when the type is going beside it.
  const textX0 =
    mainBarcode && (!bcUpright || beside) ? mainBarcode.x + bcW + gap : cx;

  // ── QR ─────────────────────────────────────────────────────────────────────
  let qrBlock = 0;
  if (wantQr) {
    const budgetW = beside
      ? cx + cw - textX0 - textLineRoom - typeGap
      : // Above: the QR takes the right of the panel and must clear the barcode
        // band underneath it.
        Math.min(cw - textLineRoom - typeGap, cw - bcW - gap);
    const budgetH = beside ? ch : ch;
    const fitted = fitQr(budgetW, budgetH);
    if (fitted) {
      qrBlock = fitted.block;
      qr = {
        x: cx + cw - fitted.block + fitted.quiet,
        y: cy + fitted.quiet,
        w: fitted.size,
        h: fitted.size,
        quiet: fitted.quiet,
        turn: turns.qr,
      };
      wantQr = false;
    } else {
      dropped.push({
        key: 'qr',
        reason: `The QR needs at least ${QR_MIN_BLOCK.toFixed(1)}mm square including its quiet zone, and only ${Math.max(0, budgetW).toFixed(1)}mm is free once the type keeps its ${textLineRoom}mm.`,
      });
    }
  }

  // ── Logo ───────────────────────────────────────────────────────────────────
  // Upright it lies along the bottom edge, right-aligned, as in the production
  // artwork. Turned it stands in the right-hand column under the QR, which is the
  // only place a tall wordmark fits without pushing the type out.
  // Whatever the barcode holds in this panel, in either direction, is not the
  // logo's to take: right-aligning within what is left keeps the two apart.
  const logoRoom = cw - (mainBarcode ? bcW + gap : 0);

  if (wantLogo) {
    const flatH = clamp(LOGO_HEIGHT_MM * (ch / 40), 3, LOGO_HEIGHT_MM);
    const flatW = Math.min(LOGO_MAX_WIDTH_MM, logoRoom);

    if (turns.logo === 90) {
      // Standing up, it shares the right-hand column with the QR: 10mm wide, using
      // the height left under the symbol.
      const top = qr ? qr.y + qr.h + qr.quiet + gap : cy;
      const logoH = clamp(cy + ch - top, 0, LOGO_MAX_WIDTH_MM);
      if (LOGO_HEIGHT_MM <= logoRoom && logoH >= 6) {
        logo = {
          x: cx + cw - LOGO_HEIGHT_MM,
          y: cy + ch - logoH,
          w: LOGO_HEIGHT_MM,
          h: logoH,
          turn: 90,
        };
        wantLogo = false;
      } else if (flatW >= 6) {
        // Nowhere to stand it up; lying it down is better than losing the brand.
        logo = { x: cx + cw - flatW, y: cy + ch - flatH, w: flatW, h: flatH, turn: 0 };
        wantLogo = false;
        noteTurned('logo', 0);
      }
    } else if (flatW >= 6) {
      logo = { x: cx + cw - flatW, y: cy + ch - flatH, w: flatW, h: flatH, turn: 0 };
      wantLogo = false;
    }
  }

  if (wantLogo) {
    dropped.push({
      key: 'logo',
      reason: 'No room left for the logo once the barcode and QR are placed.',
    });
  }

  // ── Type ───────────────────────────────────────────────────────────────────
  // A narrow panel shrinks the symbol rather than the type, which is the right
  // trade — but it changes how easily a phone reads it, so it is said out loud
  // instead of being discovered on a printed carton.
  if (qr && qr.w < QR_SIZE_MM) {
    notes.push(
      `The QR is ${qr.w}mm instead of ${QR_SIZE_MM}mm because the panel is narrow. It still scans; a longer label keeps it full size.`
    );
  }

  const textTurned = isTurned(turns.text);
  const standingLogo = logo && isTurned(logo.turn) ? logo.w : 0;

  // Anything lying along the bottom of the panel that the type would run into.
  const underneath: Rect[] = [];
  if (logo && !isTurned(logo.turn)) underneath.push(logo);
  if (mainBarcode && !beside) underneath.push(mainBarcode);

  /**
   * The two ways the type can keep clear of the QR: stop short of its column, or
   * start below it. Either is sound — the symbol sits in the panel's top corner, so
   * avoiding it in one axis is enough.
   *
   * Which one leaves more type depends on the size and on the direction of the block,
   * and not by a small margin: on a 60 × 50 with turned text it is the difference
   * between a family name at 4.9mm and one at the 2.2mm floor. Rather than guess, both
   * are set and the better result is kept.
   */
  const areaBeside = (below: boolean): Rect => {
    const rightTaken = Math.max(below ? 0 : qrBlock, standingLogo);
    const x0 = textX0;
    const x1 = cx + cw - (rightTaken > 0 ? rightTaken + typeGap : 0);
    const y0 = cy + (below && qrBlock > 0 ? qrBlock + gap : 0);
    const top = underneath
      .filter((b) => b.x < x1 && b.x + b.w > x0)
      .reduce<number | null>((t, b) => (t === null ? b.y : Math.min(t, b.y)), null);
    return {
      x: x0,
      y: y0,
      w: Math.max(0, x1 - x0),
      h: Math.max(0, (top === null ? cy + ch : top - gap) - y0),
    };
  };

  const wanted = RENDER_ORDER.filter((key) => content[key]);
  const tries = [false, true].map((below) => {
    const area = areaBeside(below);
    return { area, fit: fitType(content, wanted, area, turns.text) };
  });
  // Keeping a line matters more than setting the rest of them bigger, so the count
  // decides first and readable size only breaks the tie. Counted in lines of
  // content, not lines drawn: a SKU broken in two is one line kept, not two.
  const best = tries.reduce((a, b) => {
    if (b.fit.kept.length !== a.fit.kept.length)
      return b.fit.kept.length > a.fit.kept.length ? b : a;
    return typeScore(b.fit.blocks, b.fit.lineRoom) > typeScore(a.fit.blocks, a.fit.lineRoom)
      ? b
      : a;
  });

  const textArea = best.area;
  const fitted = best.fit;
  const blockDepth = turns.text === 90 ? textArea.w : textArea.h;
  const blockLength = turns.text === 90 ? textArea.h : textArea.w;
  for (const key of fitted.dropped) {
    dropped.push({
      key,
      reason:
        blockLength < TYPE_LINE_FLOOR_MM
          ? `No room for the ${LINE_LABEL[key]}: the space left for the type is only ${blockLength.toFixed(1)}mm long, so nothing readable fits along it.`
          : `No room for the ${LINE_LABEL[key]}: the type block is ${blockDepth.toFixed(1)}mm deep.`,
    });
  }

  // The SKU is the one line somebody reads off the carton by hand, so when the
  // column has forced it below the size it was set at — after breaking it and after
  // trying a step down — that is said before the job is printed rather than found
  // out afterwards.
  const codeBlock = fitted.blocks.find((b) => b.key === 'code');
  if (codeBlock) {
    const set = renderedSize(codeBlock, fitted.lineRoom);
    if (set < codeBlock.size * 0.8) {
      notes.push(
        `The Long SKU comes out at about ${set.toFixed(1)}mm instead of ${codeBlock.size.toFixed(1)}mm: it is ${codeBlock.parts.length > 1 ? `broken over ${codeBlock.parts.length} lines and still ` : ''}longer than the ${fitted.lineRoom.toFixed(1)}mm column. A longer label, or one without the fold, gives it back.`
      );
    }
  }

  // ── Site line, in the fold panel ───────────────────────────────────────────
  // Only the strip left over beside the barcode is free, and on a 30mm fold that
  // strip is a few millimetres wide — which is why this line ends up turned on the
  // production template even though the rest of that artwork reads across.
  if (twoUp && content.site) {
    const size = clamp(VERTICAL_TEXT_SIZE_MM * fitted.step, 1.4, VERTICAL_TEXT_SIZE_MM);
    // Both directions are measured against the strip that is left and placed inside
    // it, so the check and the position cannot drift apart — which is how a fraction
    // of a millimetre of overlap ends up printed.
    const strip = foldFree;

    const attempts: Turn[] = turns.site === 0 ? [0, 90] : [90, 0];
    for (const turn of attempts) {
      const along = size * SITE_LENGTH_FACTOR;
      const depth = size * SITE_DEPTH_FACTOR;
      const fits =
        turn === 90
          ? depth <= strip.x1 - strip.x0 && along <= strip.y1 - strip.y0
          : along <= strip.x1 - strip.x0 && depth <= strip.y1 - strip.y0;
      if (!fits) continue;

      // The block is stored as the space it takes, not as a baseline: the renderer
      // turns that frame as a whole, so one rule covers all four directions and the
      // stored box is the same thing the overlay measures and the editor drags.
      const f = siteFootprint(size, turn);
      // Turned it stands against the fold, across it starts at the panel margin;
      // either way it sits on the bottom, which is where the production artwork has it.
      site = {
        x: isTurned(turn) ? strip.x1 - f.w : strip.x0,
        y: strip.y1 - f.h,
        ...f,
        size,
        turn,
      };
      if (turn !== turns.site) noteTurned('site', turn);
      break;
    }

    if (!site) {
      notes.push(
        `The address and origin do not fit: the fold panel has ${(strip.x1 - strip.x0).toFixed(1)} × ${(strip.y1 - strip.y0).toFixed(1)}mm free once the symbols are placed, and the two lines need ${(VERTICAL_TEXT_SIZE_MM * fitted.step * SITE_LENGTH_FACTOR).toFixed(1)}mm to run along.`
      );
    }
  }

  const automatic: LabelLayout = {
    canvas: { w: W, h: H },
    fold,
    barcode,
    qr,
    logo,
    site,
    lines: fitted.lines,
    textArea,
    dropped,
    notes,
    step: fitted.step,
    manual: false,
  };

  // Arranged by hand, the automatic result is still computed: it is what the
  // arrangement started from, and it is the fallback for any field the arrangement
  // does not mention.
  return template.placements && Object.keys(template.placements).length > 0
    ? manualLayout(template, content, automatic, turns)
    : automatic;
}

/**
 * Which pieces a variant actually has to print.
 * Shared by the renderer and by the warnings, so the two always talk about the
 * same label.
 */
export function contentOf(
  data: {
    gtin: string | null;
    qrUrl: string | null;
    family: string;
    name: string;
    code: string;
    specLine: string;
  },
  visibility?: Partial<Record<'barcode' | 'qr' | 'logo' | 'text' | 'site', boolean>>
): LabelContent {
  const show = {
    barcode: visibility?.barcode !== false,
    qr: visibility?.qr !== false,
    logo: visibility?.logo !== false,
    text: visibility?.text !== false,
    site: visibility?.site !== false,
  };

  return {
    barcode: show.barcode && Boolean(data.gtin),
    qr: show.qr && Boolean(data.qrUrl),
    // Always reserved when enabled, even before a logo is uploaded: the wordmark
    // belongs on every label, and holding its place keeps the download identical
    // to the preview instead of re-flowing once the file arrives.
    logo: show.logo,
    site: show.site,
    // Set in caps whatever case the record is kept in. The family and the
    // configuration name identify the goods on a carton, next to a SKU that is
    // already caps, and a stored "Pegasus" would print out of step with the SKU
    // beside it and with the same name everywhere else in the system. Done here so
    // the width the engine measures is the width of what is actually drawn.
    family: show.text ? data.family.toUpperCase() : '',
    name: show.text ? data.name.toUpperCase() : '',
    // The prefix is part of the string the engine measures and breaks, so it lives
    // here rather than in the renderer.
    code: show.text && data.code ? `SKU: ${data.code}` : '',
    spec: show.text ? data.specLine : '',
  };
}

/**
 * The sample variant as the engine sees it. Derived rather than written out again,
 * so the fit summary in Settings can never describe a different product from the
 * one drawn next to it.
 */
export const SAMPLE_CONTENT: LabelContent = contentOf(SAMPLE_LABEL_DATA);
