import {
  PLACEMENT_MIN_MM,
  PLACEMENT_SQUARE,
  nextQuarter,
  type LabelFieldKey,
  type LabelPlacement,
  type Turn,
} from './geometry';

/**
 * Moving, turning and resizing a block by hand, as arithmetic.
 *
 * Kept out of the editor because it is the rule rather than the interface: the
 * handles, the arrow keys and the typed millimetre fields all come through here, so
 * dragging a width to 40 and typing 40 into it cannot end up meaning two different
 * things. It is also the part worth checking headless, and a component is not.
 *
 * Two things are held to, and only two: a block stays inside the trim, and it keeps
 * a couple of millimetres to be drawn in and grabbed by. Sizes that print badly are
 * allowed and reported — the layout's notes name them — because a barcode too small
 * for GS1 is a decision about somebody's carton, not an error to be prevented.
 */

export type ArrangeHandle = 'move' | 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

/** Half a millimetre, which is about what a die holds. Shift drags in tenths. */
export const SNAP_MM = 0.5;
export const FINE_MM = 0.1;
/** Guides worth landing on: they are where the rest of the artwork lines up. */
const SNAP_RANGE_MM = 0.8;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function snap(value: number, step: number, guides: number[]): number {
  for (const guide of guides) {
    if (Math.abs(value - guide) <= SNAP_RANGE_MM) return guide;
  }
  return Math.round(value / step) * step;
}

/** Tenths of a millimetre: finer than a die holds, and it keeps the numbers legible. */
function tenth(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Sizes round up, never down.
 *
 * A size like the 30.096mm of a UPC-A at 80% magnification is not a round number,
 * and rounding it down to 30.0 would put the symbol out of spec by a rounding error
 * — a tenth of a millimetre nobody could see and a scanner could refuse.
 */
function tenthUp(value: number): number {
  return Math.ceil(value * 10) / 10;
}

/**
 * Turns a block a quarter in place.
 *
 * About its own centre, so what was pointed at stays pointed at, and the sides swap
 * because the artwork inside turns with the box: a 30 × 19 barcode becomes 19 × 30.
 * Four turns bring back the box that was started from.
 *
 * `from` is the quarter it is on now, and it has to be passed in rather than read off
 * the box: until something is turned by hand a box carries no turn of its own, and
 * the one that matters is the one the engine drew it at. Reading `box.turn` here
 * would leave a barcode the layout had already turned stuck at 90° for every click.
 */
export function rotatePlacement(
  box: LabelPlacement,
  canvas: { w: number; h: number },
  from: Turn
): LabelPlacement {
  const w = Math.min(box.h, canvas.w);
  const h = Math.min(box.w, canvas.h);
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  return {
    x: tenth(clamp(cx - w / 2, 0, canvas.w - w)),
    y: tenth(clamp(cy - h / 2, 0, canvas.h - h)),
    w: tenth(w),
    h: tenth(h),
    turn: nextQuarter(from),
  };
}

export function resize({
  field,
  handle,
  from,
  dx,
  dy,
  step,
  canvas,
  fold,
  snapping = true,
}: {
  field: LabelFieldKey;
  handle: ArrangeHandle;
  from: LabelPlacement;
  dx: number;
  dy: number;
  step: number;
  canvas: { w: number; h: number };
  fold: number | null;
  /** Off for typed numbers: 1.0 has to stay 1.0 even with an edge 0.8mm away. */
  snapping?: boolean;
}): LabelPlacement {
  const square = PLACEMENT_SQUARE.includes(field);
  const guidesX = snapping ? [0, canvas.w, ...(fold === null ? [] : [fold])] : [];
  const guidesY = snapping ? [0, canvas.h] : [];

  let { x, y, w, h } = from;

  if (handle === 'move') {
    // Both edges of the box are offered to the guides, so a block lands flush
    // against the fold from either side of it.
    x = snap(from.x + dx, step, [...guidesX, ...guidesX.map((g) => g - from.w)]);
    y = snap(from.y + dy, step, [...guidesY, ...guidesY.map((g) => g - from.h)]);
  } else {
    if (handle.includes('w')) {
      const edge = snap(from.x + dx, step, guidesX);
      w = from.w + (from.x - edge);
      x = edge;
    }
    if (handle.includes('e')) {
      w = snap(from.x + from.w + dx, step, guidesX) - from.x;
    }
    if (handle.includes('n')) {
      const edge = snap(from.y + dy, step, guidesY);
      h = from.h + (from.y - edge);
      y = edge;
    }
    if (handle.includes('s')) {
      h = snap(from.y + from.h + dy, step, guidesY) - from.y;
    }

    // A square field takes its size from the axes the handle actually moved. Reading
    // both would let the untouched one win: pulling the left edge of a 20mm QR
    // inwards leaves the height at 20, and the larger of the two is still 20, so the
    // symbol would refuse to be made smaller from the side.
    if (square) {
      const touchesX = handle.includes('e') || handle.includes('w');
      const touchesY = handle.includes('n') || handle.includes('s');
      const size = touchesX && touchesY ? Math.max(w, h) : touchesX ? w : h;
      w = size;
      h = size;
    }

    // Only the arithmetic floor. Anything above it is the print buyer's call, and the
    // drawing says in red what a size below spec costs.
    w = clamp(w, PLACEMENT_MIN_MM, canvas.w);
    h = clamp(h, PLACEMENT_MIN_MM, canvas.h);
    if (square) {
      const size = Math.min(w, h);
      w = size;
      h = size;
    }
    // Clamping a size after the opposite edge moved would drift the anchor, so the
    // anchored edge is put back where the original box had it.
    if (handle.includes('w')) x = from.x + from.w - w;
    if (handle.includes('n')) y = from.y + from.h - h;
  }

  // Inside the trim, always. Size gives way before position does, so a block pushed
  // against an edge stays where it was put rather than sliding along it. Rounded
  // before the position is settled, so the rounding cannot itself push the far edge
  // a tenth of a millimetre past the trim.
  w = tenthUp(Math.min(w, canvas.w));
  h = tenthUp(Math.min(h, canvas.h));

  return {
    x: tenth(clamp(x, 0, canvas.w - w)),
    y: tenth(clamp(y, 0, canvas.h - h)),
    w,
    h,
    // Dragging never re-orients anything: a block turned by hand keeps that turn
    // through every move and resize until it is turned again.
    ...(from.turn === undefined ? {} : { turn: from.turn }),
  };
}
