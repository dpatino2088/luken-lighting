'use client';

import { useState } from 'react';
import { Minimize2, RotateCcw, RotateCw } from 'lucide-react';
import { resize, rotatePlacement } from '@/lib/label/arrange';
import {
  LABEL_FIELDS,
  PLACEMENT_MOVE_ONLY,
  placementAdvice,
  type LabelFieldKey,
  type LabelPlacement,
  type LabelPlacements,
  type Turn,
} from '@/lib/label/geometry';

/**
 * The selected block's position, size and quarter turn, typed and clicked.
 *
 * Dragging is for deciding where something goes; this is for saying it exactly.
 * Nobody hits 3.0 mm with a mouse, and a print buyer asking for a 5 mm margin
 * means 5, so a typed number goes through the same function as a dragged handle and
 * the two cannot disagree.
 *
 * Sizes under what prints well are accepted here and marked, not refused: the note
 * under the drawing says what a below-spec barcode or QR costs, and this says which
 * of the two numbers is the one out of range.
 */

const FIELD_LABEL = new Map(LABEL_FIELDS.map((f) => [f.key, f.label]));

export function LabelPlacementFields({
  field,
  box,
  turn,
  canvas,
  fold,
  boxes,
  natural,
  onChange,
  onReset,
}: {
  field: LabelFieldKey;
  box: LabelPlacement;
  turn: Turn;
  canvas: { w: number; h: number };
  fold: number | null;
  boxes: LabelPlacements;
  /** The size the engine gives this block, for the way it is turned now. */
  natural: { w: number; h: number } | null;
  onChange: (next: LabelPlacements) => void;
  onReset: () => void;
}) {
  const fixed = PLACEMENT_MOVE_ONLY.includes(field);
  const advice = placementAdvice(field, turn);
  const tight = { w: box.w < advice.minW - 0.01, h: box.h < advice.minH - 0.01 };
  const resized =
    natural !== null && (Math.abs(box.w - natural.w) > 0.05 || Math.abs(box.h - natural.h) > 0.05);

  /** The size back, and nothing else: it stays where it was dragged to. */
  function toNatural() {
    if (!natural) return;
    onChange({
      ...boxes,
      [field]: resize({
        field,
        handle: 'se',
        from: box,
        dx: natural.w - box.w,
        dy: natural.h - box.h,
        step: 0.1,
        canvas,
        fold,
        snapping: false,
      }),
    });
  }

  function set(axis: 'x' | 'y' | 'w' | 'h', raw: string) {
    const value = Number(raw);
    if (!Number.isFinite(value)) return;

    const handle = axis === 'x' || axis === 'y' ? 'move' : axis === 'w' ? 'e' : 's';
    const next = resize({
      field,
      handle,
      from: box,
      dx: axis === 'x' ? value - box.x : axis === 'w' ? value - box.w : 0,
      dy: axis === 'y' ? value - box.y : axis === 'h' ? value - box.h : 0,
      step: 0.1,
      canvas,
      fold,
      snapping: false,
    });
    onChange({ ...boxes, [field]: next });
  }

  /**
   * Takes the cursor out of whatever field holds it, before a button changes the box.
   *
   * A field being typed into shows what was typed rather than what is on the label, so
   * turning or restoring a block while the cursor sits in W would leave that number
   * standing there describing a size that no longer exists. Clicking a button moves the
   * focus by itself in most browsers, but not in all of them, and this is cheaper than
   * finding out which one somebody is using.
   */
  const release = () => (document.activeElement as HTMLElement | null)?.blur();

  return (
    <div className="flex flex-wrap items-end gap-3 bg-gray-50 border border-gray-200 px-3 py-2">
      <p className="text-xs font-medium text-gray-900">{FIELD_LABEL.get(field)}</p>

      {(['x', 'y', 'w', 'h'] as const).map((axis) => (
        <MmInput
          key={axis}
          axis={axis}
          value={box[axis]}
          disabled={fixed && (axis === 'w' || axis === 'h')}
          // Red is a warning, not a refusal: the number stands as typed.
          warn={axis === 'w' ? tight.w : axis === 'h' ? tight.h : false}
          onCommit={(value) => set(axis, value)}
        />
      ))}

      <span className="text-[11px] text-gray-400">mm</span>

      <button
        type="button"
        onPointerDown={release}
        onClick={() => onChange({ ...boxes, [field]: rotatePlacement(box, canvas, turn) })}
        className="inline-flex items-center gap-1 border border-gray-300 px-2 py-1 text-[11px] text-gray-700 hover:border-gray-900 hover:text-gray-900"
        title="Turn a quarter, about the centre of the block (R)"
      >
        <RotateCw className="h-3 w-3" />
        Turn 90°
        <span className="text-gray-400">{turn}°</span>
      </button>

      {!fixed && natural && (
        <button
          type="button"
          onPointerDown={release}
          onClick={toNatural}
          disabled={!resized}
          title={`Back to ${natural.w.toFixed(1)} × ${natural.h.toFixed(1)} mm, without moving it`}
          className="inline-flex items-center gap-1 border border-gray-300 px-2 py-1 text-[11px] text-gray-700 hover:border-gray-900 hover:text-gray-900 disabled:border-gray-200 disabled:text-gray-400"
        >
          <Minimize2 className="h-3 w-3" />
          Original size
          <span className="text-gray-400">
            {natural.w.toFixed(1)} × {natural.h.toFixed(1)}
          </span>
        </button>
      )}

      <button
        type="button"
        onPointerDown={release}
        onClick={onReset}
        title="Position, size and direction all back to what the engine would do"
        className="ml-auto inline-flex items-center gap-1 text-[11px] text-gray-500 hover:text-gray-900"
      >
        <RotateCcw className="h-3 w-3" />
        Back to automatic
      </button>

      {(tight.w || tight.h) && (
        <p className="w-full text-[11px] text-red-600">
          Smaller than the {advice.minW.toFixed(1)} × {advice.minH.toFixed(1)} mm this prints
          reliably at. Drawn as asked all the same — the note under the label says what it costs.
        </p>
      )}
    </div>
  );
}

/**
 * A millimetre field that lets a number be typed.
 *
 * What is typed is held locally, because the value on screen comes back clamped:
 * emptying the field to type 12.5 would otherwise read as 0 and throw the block into
 * the corner between two keystrokes.
 *
 * Only while the field has the cursor, though. A box that is turned, restored or
 * dragged from somewhere else changes size without anybody typing, and a field still
 * showing the last thing typed into it would be reporting a size that is no longer on
 * the label.
 */
function MmInput({
  axis,
  value,
  disabled,
  warn,
  onCommit,
}: {
  axis: 'x' | 'y' | 'w' | 'h';
  value: number;
  disabled: boolean;
  warn: boolean;
  onCommit: (raw: string) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const [typing, setTyping] = useState(false);

  return (
    <label className="flex items-center gap-1 text-[11px] text-gray-500">
      {axis.toUpperCase()}
      <input
        type="number"
        step={0.5}
        value={typing && draft !== null ? draft : value}
        disabled={disabled}
        onChange={(e) => {
          setDraft(e.target.value);
          if (e.target.value !== '' && Number.isFinite(Number(e.target.value))) {
            onCommit(e.target.value);
          }
        }}
        onFocus={() => setTyping(true)}
        onBlur={() => {
          setTyping(false);
          setDraft(null);
        }}
        className={`w-16 border px-1.5 py-0.5 text-xs disabled:bg-gray-100 disabled:text-gray-400 ${
          warn ? 'border-red-400 text-red-700' : 'border-gray-300 text-gray-900'
        }`}
      />
    </label>
  );
}
