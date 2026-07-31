/**
 * Checks the hand-arranged layout against the automatic one, headless.
 *
 * Three things have to hold or the feature is a trap.
 *
 * Taking control of a template must change nothing on the label — the arrangement
 * starts from the engine's result, and a millimetre of drift there would move
 * production artwork the first time anyone opened the editor.
 *
 * Nothing may leave the trim, whatever is asked for. Sizes are the print buyer's
 * call now and a barcode may be made too small for GS1, but a block off the edge is
 * not a decision, it is artwork that comes back from the die-cutter wrong.
 *
 * And type has to stay in its box at all four quarter turns. Each turn starts the
 * lines from a different corner and runs them a different way, so this is the part
 * where a sign error hangs a Long SKU off the side of the label.
 *
 * Run with: npm run check:labels
 */

import {
  labelFoldOptions,
  labelHeightOptions,
  labelLengthOptions,
  placementAdvice,
  readPlacements,
  validatePlacements,
  isTurned,
  QUARTER_TURNS,
  PLACEMENT_MIN_MM,
  type LabelFieldKey,
  type LabelPlacements,
  type LabelShape,
  type Turn,
} from '../lib/label/geometry';
import {
  SAMPLE_CONTENT,
  layoutLabel,
  placementsOf,
  type LabelLayout,
  type LayoutLine,
} from '../lib/label/layout';
import { resize, rotatePlacement, type ArrangeHandle } from '../lib/label/arrange';

const FIELDS: LabelFieldKey[] = ['barcode', 'qr', 'logo', 'text', 'site'];

/** The direction a field came out drawn in, which is what its advice depends on. */
function drawnTurn(layout: LabelLayout, field: LabelFieldKey): Turn {
  if (field === 'text') return layout.lines[0]?.turn ?? 0;
  return layout[field]?.turn ?? 0;
}

function shapes(): LabelShape[] {
  const out: LabelShape[] = [];
  for (const width_mm of labelLengthOptions()) {
    for (const height_mm of labelHeightOptions()) {
      for (const orientation of ['landscape', 'portrait'] as const) {
        const folds = labelFoldOptions(width_mm);
        const sections: (1 | 2)[] = folds.length > 0 ? [1, 2] : [1];
        for (const s of sections) {
          for (const fold of s === 2 ? [folds[0], folds[folds.length - 1]] : [null]) {
            out.push({
              width_mm,
              height_mm,
              orientation,
              sections: s,
              fold_mm: fold,
              rotation: { barcode: 'auto', qr: 'auto', logo: 'auto', text: 'auto', site: 'auto' },
            });
          }
        }
      }
    }
  }
  return out;
}

function name(shape: LabelShape): string {
  return `${shape.width_mm}×${shape.height_mm} ${shape.orientation}${shape.fold_mm ? ` fold ${shape.fold_mm}` : ' single'}`;
}

/**
 * Everything drawn, as a list of named numbers, so two layouts can be compared.
 *
 * Where a box came from a stored arrangement it has been through a tenth of a
 * millimetre, so the comparison has to allow that much and no more: exact equality
 * would fail on the rounding itself, and anything looser would let a real move hide
 * inside the tolerance.
 */
function figures(layout: LabelLayout): Record<string, number> {
  const out: Record<string, number> = {};
  const box = (name: string, r: { x: number; y: number; w: number; h: number } | null) => {
    if (!r) return;
    out[`${name}.x`] = r.x;
    out[`${name}.y`] = r.y;
    out[`${name}.w`] = r.w;
    out[`${name}.h`] = r.h;
  };

  box('barcode', layout.barcode);
  if (layout.barcode) out['barcode.bars'] = layout.barcode.barHeight;
  box('qr', layout.qr);
  box('logo', layout.logo);
  box('site', layout.site);
  if (layout.site) out['site.size'] = layout.site.size;
  layout.lines.forEach((l, i) => {
    out[`line${i}.${l.key}.x`] = l.x;
    out[`line${i}.${l.key}.y`] = l.y;
    out[`line${i}.${l.key}.size`] = l.size;
  });
  return out;
}

/** The first thing that moved, or null when the two labels are the same drawing. */
function moved(a: LabelLayout, b: LabelLayout): string | null {
  const one = figures(a);
  const two = figures(b);
  const text = (l: LabelLayout) => l.lines.map((x) => `${x.key}:${x.text}`).join('|');
  if (text(a) !== text(b)) return `type set as ${text(a)} became ${text(b)}`;

  for (const key of Object.keys(one)) {
    if (!(key in two)) return `${key} disappeared`;
    // Half a tenth is the most a number can shift by being put on the grid the
    // arrangement is stored on, and a hair more where one value follows from another
    // — a QR's quiet zone is a proportion of a symbol that has itself been rounded.
    // Still well under the 0.1 the editor moves in, so a real move cannot hide here.
    if (Math.abs(one[key] - two[key]) > 0.06) {
      return `${key} moved from ${one[key].toFixed(2)} to ${two[key].toFixed(2)}`;
    }
  }
  for (const key of Object.keys(two)) if (!(key in one)) return `${key} appeared`;
  return null;
}

/**
 * The furthest a line of type can reach, from where its baseline starts.
 *
 * Glyphs grow away from the baseline the way they are turned — up and to the right
 * when the text reads across, up and to the left when it reads bottom-to-top — and
 * `maxWidth` is the allowance rather than the measured string, so this is the widest
 * the line could possibly get. If that is inside the box, the real ink is too.
 */
function inkBox(line: LayoutLine): { x: number; y: number; w: number; h: number } {
  const { x, y, size, maxWidth: run, turn } = line;
  switch (turn) {
    case 90:
      return { x: x - size, y: y - run, w: size, h: run };
    case 180:
      return { x: x - run, y, w: run, h: size };
    case 270:
      return { x, y, w: size, h: run };
    default:
      return { x, y: y - size, w: run, h: size };
  }
}

let failures = 0;
const fail = (where: string, what: string) => {
  failures += 1;
  console.log(`  FAIL  ${where}\n        ${what}`);
};

// ── Taking control changes nothing ───────────────────────────────────────────
console.log('Snapshot round-trip (automatic → arranged by hand):');
for (const shape of shapes()) {
  const auto = layoutLabel(shape, SAMPLE_CONTENT);
  const snapshot = placementsOf(auto);
  const manual = layoutLabel({ ...shape, placements: snapshot }, SAMPLE_CONTENT);

  const drifted = moved(auto, manual);
  if (drifted) fail(name(shape), `taking control moved the artwork: ${drifted}`);

  // Through the database column, where boxes are stored to a tenth of a
  // millimetre. Drift is allowed here, but not more than the rounding itself.
  const stored = layoutLabel({ ...shape, placements: readPlacements(snapshot) }, SAMPLE_CONTENT);
  for (const field of ['barcode', 'qr', 'logo'] as const) {
    const a = auto[field];
    const b = stored[field];
    if (!a || !b) continue;
    const drift = Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y), Math.abs(a.w - b.w));
    if (drift > 0.16) fail(name(shape), `${field} drifted ${drift.toFixed(2)}mm through storage`);
  }
}

// ── Type stays in its box, whichever way it is turned ────────────────────────
console.log('Turned type (every quarter keeps the lines in the block):');
for (const shape of shapes().slice(0, 60)) {
  const auto = layoutLabel(shape, SAMPLE_CONTENT);
  const boxes = placementsOf(auto);
  const block = boxes.text;
  if (!block) continue;

  const quarters = QUARTER_TURNS.map((turn) =>
    layoutLabel({ ...shape, placements: { ...boxes, text: { ...block, turn } } }, SAMPLE_CONTENT)
  );

  QUARTER_TURNS.forEach((turn, index) => {
    const layout = quarters[index];
    const area = layout.textArea;
    const where = `${name(shape)} text at ${turn}°`;

    if (layout.lines.length > 0 && layout.lines[0].turn !== turn) {
      fail(where, `drawn at ${layout.lines[0].turn}° instead`);
    }
    for (const line of layout.lines) {
      const ink = inkBox(line);
      if (
        ink.x < area.x - 0.05 ||
        ink.y < area.y - 0.05 ||
        ink.x + ink.w > area.x + area.w + 0.05 ||
        ink.y + ink.h > area.y + area.h + 0.05
      ) {
        fail(
          where,
          `the ${line.key} line reaches ${ink.x.toFixed(1)},${ink.y.toFixed(1)} ${ink.w.toFixed(1)}×${ink.h.toFixed(1)} outside a block at ${area.x.toFixed(1)},${area.y.toFixed(1)} ${area.w.toFixed(1)}×${area.h.toFixed(1)}`
        );
      }
    }
    // A half turn leaves the box the same shape, so it has to hold the same type:
    // upside down reads the same amount as across, and top-to-bottom the same as
    // bottom-to-top. Only a quarter changes which side is the line length.
    const opposite = quarters[(index + 2) % 4];
    if (layout.lines.length !== opposite.lines.length) {
      fail(
        where,
        `${layout.lines.length} lines against ${opposite.lines.length} at ${(turn + 180) % 360}°, which is the same shape of box`
      );
    }
  });
}

// ── Turning by hand comes back to where it started ───────────────────────────
console.log('Turning (four quarters return the box, and none leaves the trim):');
for (const shape of shapes().slice(0, 60)) {
  const layout = layoutLabel(shape, SAMPLE_CONTENT);
  const canvas = layout.canvas;
  const boxes = placementsOf(layout);

  for (const field of FIELDS) {
    const from = boxes[field];
    if (!from) continue;

    let box = from;
    let at = drawnTurn(layout, field);
    for (let i = 0; i < 4; i += 1) {
      const before = box;
      box = rotatePlacement(box, canvas, at);
      at = box.turn ?? 0;
      const where = `${name(shape)} ${field}`;

      if (box.x < -0.01 || box.y < -0.01 || box.x + box.w > canvas.w + 0.01 || box.y + box.h > canvas.h + 0.01) {
        fail(where, `turned out of the trim to ${box.x},${box.y} ${box.w}×${box.h}`);
      }
      // Sides swap, unless the label is too narrow to hold the long side upright.
      const swapped = Math.abs(box.w - Math.min(before.h, canvas.w)) < 0.11;
      if (!swapped) fail(where, `turning gave ${box.w}×${box.h} from ${before.w}×${before.h}`);
      const expected = ((drawnTurn(layout, field) + 90 * (i + 1)) % 360) as Turn;
      if (box.turn !== expected) {
        fail(where, `turn came out ${box.turn}° on step ${i + 1}, not ${expected}°`);
      }
    }

    // Four quarters is a full turn: the same box, give or take the tenth it is
    // rounded to and whatever a clamp against the trim took off on the way round.
    const fits = from.w <= canvas.h + 0.01 && from.h <= canvas.w + 0.01;
    if (fits && (Math.abs(box.w - from.w) > 0.11 || Math.abs(box.h - from.h) > 0.11)) {
      fail(`${name(shape)} ${field}`, `a full turn changed ${from.w}×${from.h} into ${box.w}×${box.h}`);
    }
  }
}

// ── A size below spec is drawn and reported, not refused ─────────────────────
console.log('Below spec (drawn as asked, and said out loud):');
for (const shape of shapes().slice(0, 40)) {
  const auto = layoutLabel(shape, SAMPLE_CONTENT);
  const asked: LabelPlacements = {};
  for (const field of FIELDS) {
    // Off the top-left corner, and far too small for any of them.
    if (placementsOf(auto)[field]) asked[field] = { x: -40, y: -40, w: 4, h: 4 };
  }
  const layout = layoutLabel({ ...shape, placements: asked }, SAMPLE_CONTENT);
  const W = shape.width_mm;
  const H = shape.height_mm;

  const boxes = placementsOf(layout);
  for (const field of FIELDS) {
    const b = boxes[field];
    if (!b) continue;
    if (b.x < -0.01 || b.y < -0.01 || b.x + b.w > W + 0.01 || b.y + b.h > H + 0.01) {
      fail(name(shape), `${field} left the trim at ${b.x},${b.y} ${b.w}×${b.h}`);
    }
    if (b.w < PLACEMENT_MIN_MM - 0.01 || b.h < PLACEMENT_MIN_MM - 0.01) {
      fail(name(shape), `${field} came out ${b.w}×${b.h}, too small to see or grab`);
    }
  }

  const said = layout.notes.join(' ');
  if (layout.barcode) {
    const along = isTurned(layout.barcode.turn) ? layout.barcode.h : layout.barcode.w;
    if (along > 8) fail(name(shape), `barcode ignored the 4mm box and drew ${along.toFixed(1)}mm`);
    if (!said.includes('magnification')) {
      fail(name(shape), 'a barcode below 80% was drawn without a word about it');
    }
  }
  if (layout.qr) {
    if (layout.qr.w > 8) fail(name(shape), `QR ignored the 4mm box and drew ${layout.qr.w.toFixed(1)}mm`);
    if (!said.includes('module')) fail(name(shape), 'an unreadable QR was drawn without a word about it');
  }
  // Nothing forces type into a 4mm box, but it cannot be lost in silence.
  if (layout.lines.length === 0 && layout.dropped.length === 0 && layout.notes.length === 0) {
    fail(name(shape), 'the type vanished and the layout said nothing');
  }
}

// ── The one thing a save refuses ─────────────────────────────────────────────
console.log('Validation (a box off the label cannot be saved):');
{
  const shape = shapes()[0];
  const outside: LabelPlacements = { qr: { x: shape.width_mm - 2, y: 1, w: 20, h: 20 } };
  if (!validatePlacements({ ...shape, placements: outside })) {
    fail(name(shape), 'a QR hanging off the right edge was accepted');
  }
  const auto = placementsOf(layoutLabel(shape, SAMPLE_CONTENT));
  if (validatePlacements({ ...shape, placements: auto })) {
    fail(name(shape), 'the automatic arrangement was rejected');
  }
}

// ── Dragging, at random, can never produce an illegal box ────────────────────
// The editor is where this is actually used, so the same function the handles and
// the typed fields go through is dragged around blind and the result checked.
console.log('Dragging (2000 random drags and pulls):');
{
  let seed = 7;
  const random = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  const handles: ArrangeHandle[] = ['move', 'nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
  const pool = shapes();

  for (let i = 0; i < 2000; i += 1) {
    const shape = pool[Math.floor(random() * pool.length)];
    const layout = layoutLabel(shape, SAMPLE_CONTENT);
    const boxes = placementsOf(layout);
    const present = FIELDS.filter((f) => boxes[f]);
    if (present.length === 0) continue;
    const field = present[Math.floor(random() * present.length)];
    // Half the drags start from a box that has been turned by hand, since that is
    // the state the arithmetic has to survive as well.
    const turned = QUARTER_TURNS[Math.floor(random() * 4)];
    const from = { ...boxes[field]!, turn: turned };

    const box = resize({
      field,
      handle: handles[Math.floor(random() * handles.length)],
      from,
      // Well past the edges in both directions, which is what a hand does.
      dx: (random() - 0.5) * shape.width_mm * 3,
      dy: (random() - 0.5) * shape.height_mm * 3,
      step: 0.5,
      canvas: layout.canvas,
      fold: layout.fold,
    });

    const where = `${name(shape)} ${field}`;
    if (box.x < -0.01 || box.y < -0.01) fail(where, `dragged to ${box.x},${box.y}`);
    if (box.x + box.w > shape.width_mm + 0.01 || box.y + box.h > shape.height_mm + 0.01) {
      fail(where, `dragged past the trim to ${(box.x + box.w).toFixed(1)},${(box.y + box.h).toFixed(1)}`);
    }
    if (box.w < PLACEMENT_MIN_MM - 0.01 || box.h < PLACEMENT_MIN_MM - 0.01) {
      fail(where, `pulled to ${box.w} × ${box.h}mm, too small to draw or grab`);
    }
    if (field === 'qr' && Math.abs(box.w - box.h) > 0.01) {
      fail(where, `QR pulled out of square: ${box.w} × ${box.h}`);
    }
    if (box.turn !== turned) fail(where, `dragging re-turned it from ${turned}° to ${box.turn}°`);

    // And the label still draws, inside the trim, at whatever size was asked for.
    const after = layoutLabel({ ...shape, placements: { ...boxes, [field]: box } }, SAMPLE_CONTENT);
    for (const drawnBox of Object.values(placementsOf(after))) {
      if (
        drawnBox.x < -0.01 ||
        drawnBox.y < -0.01 ||
        drawnBox.x + drawnBox.w > shape.width_mm + 0.01 ||
        drawnBox.y + drawnBox.h > shape.height_mm + 0.01
      ) {
        fail(where, `drawing put a block at ${drawnBox.x},${drawnBox.y} ${drawnBox.w}×${drawnBox.h}`);
      }
    }
  }
}

// ── A handle that is pulled has to answer ────────────────────────────────────
// Clamping correctly is half of it. The other half is that pulling an edge moves
// that edge: a square symbol that reads both axes would refuse to be made smaller
// from the side, because the axis nobody touched stays large and wins.
console.log('Response (pulling an edge moves that edge):');
for (const shape of shapes()) {
  const layout = layoutLabel(shape, SAMPLE_CONTENT);
  const boxes = placementsOf(layout);

  for (const field of FIELDS) {
    const from = boxes[field];
    if (!from) continue;
    const pull = (handle: ArrangeHandle, dx: number, dy: number) =>
      resize({ field, handle, from, dx, dy, step: 0.5, canvas: layout.canvas, fold: layout.fold });

    // Outwards, unless the trim is already reached.
    const wider = pull('e', 8, 0);
    const roomRight = shape.width_mm - from.x;
    if (from.w < roomRight - 0.6 && wider.w <= from.w) {
      fail(`${name(shape)} ${field}`, `pulled the east edge out and the width stayed ${wider.w}mm`);
    }

    // Inwards, all the way to the arithmetic floor: there is nothing else stopping it.
    const narrower = pull('w', 8, 0);
    if (from.w > PLACEMENT_MIN_MM + 0.6 && narrower.w >= from.w) {
      fail(`${name(shape)} ${field}`, `pushed the west edge in and the width stayed ${narrower.w}mm`);
    }

    const shorter = pull('n', 0, 8);
    if (from.h > PLACEMENT_MIN_MM + 0.6 && shorter.h >= from.h) {
      fail(`${name(shape)} ${field}`, `pushed the top edge down and the height stayed ${shorter.h}mm`);
    }

    // Moving is not resizing: a block that is dragged keeps its footprint.
    const moved = pull('move', 4, 4);
    if (Math.abs(moved.w - from.w) > 0.11 || Math.abs(moved.h - from.h) > 0.11) {
      fail(`${name(shape)} ${field}`, `dragging changed the size to ${moved.w} × ${moved.h}`);
    }
  }
}

// ── The wordmark runs along the box it was given ─────────────────────────────
// It is the one element with no size of its own, so a box it does not follow is a
// box that describes nothing: the mark comes out a fraction of the space and adrift
// in it. Reshaping the box therefore sets the direction — while a box left at the
// engine's own size keeps the engine's, fallback included.
console.log('Wordmark (a reshaped box says which way it runs):');
for (const shape of shapes().slice(0, 80)) {
  const auto = layoutLabel(shape, SAMPLE_CONTENT);
  const boxes = placementsOf(auto);
  const box = boxes.logo;
  if (!box || !auto.logo) continue;
  const where = `${name(shape)} logo`;

  const asIs = layoutLabel({ ...shape, placements: boxes }, SAMPLE_CONTENT);
  if (asIs.logo?.turn !== auto.logo.turn) {
    fail(where, `an untouched box turned from ${auto.logo.turn}° to ${asIs.logo?.turn}°`);
  }

  // Upright and flat versions of the same box, both well clear of square so there
  // is no question which way round they are.
  const short = Math.min(box.w, box.h, shape.height_mm / 3);
  const long = Math.min(short * 2.5, shape.height_mm);
  const at = { x: 0, y: 0 };
  const upright = layoutLabel(
    { ...shape, placements: { ...boxes, logo: { ...at, w: short, h: long } } },
    SAMPLE_CONTENT
  );
  if (upright.logo?.turn !== 90) {
    fail(where, `a box ${short}×${long} was drawn at ${upright.logo?.turn}° instead of standing up`);
  }

  const flat = layoutLabel(
    { ...shape, placements: { ...boxes, logo: { ...at, w: long, h: short } } },
    SAMPLE_CONTENT
  );
  if (flat.logo?.turn !== 0) {
    fail(where, `a box ${long}×${short} was drawn at ${flat.logo?.turn}° instead of lying down`);
  }

  // And a turn set with the rotate control beats the shape of the box.
  for (const turn of QUARTER_TURNS) {
    const asked = layoutLabel(
      { ...shape, placements: { ...boxes, logo: { ...at, w: short, h: long, turn } } },
      SAMPLE_CONTENT
    );
    if (asked.logo?.turn !== turn) {
      fail(where, `${turn}° was asked for by hand and ${asked.logo?.turn}° was drawn`);
    }
  }
}

// ── The advice turns with the field it is about ──────────────────────────────
console.log('Advice (the size that reads well follows the direction):');
for (const field of ['barcode', 'logo', 'text'] as const) {
  const flat = placementAdvice(field, 0);
  const up = placementAdvice(field, 90);
  const half = placementAdvice(field, 180);
  if (Math.abs(flat.minW - up.minH) > 0.01 || Math.abs(flat.minH - up.minW) > 0.01) {
    fail(`${field} advice`, `across ${flat.minW}×${flat.minH} does not turn into ${up.minW}×${up.minH}`);
  }
  if (Math.abs(flat.minW - half.minW) > 0.01) {
    fail(`${field} advice`, 'upside down was treated as turned');
  }
}

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
