'use client';

import { useEffect, useRef } from 'react';
import {
  FINE_MM,
  SNAP_MM,
  resize,
  rotatePlacement,
  type ArrangeHandle,
} from '@/lib/label/arrange';
import {
  LABEL_FIELDS,
  PLACEMENT_MOVE_ONLY,
  type LabelFieldKey,
  type LabelPlacement,
  type LabelPlacements,
  type Turn,
} from '@/lib/label/geometry';

/**
 * Dragging and resizing the artwork, over the drawing of it.
 *
 * Every drag hands back the whole arrangement, not the one box that moved, so the
 * first time anything is touched the automatic layout is captured as it stood. That
 * is what makes taking control of a template start from where the engine left it.
 *
 * What a drag is allowed to produce lives in {@link resize}, which the typed
 * millimetre fields go through as well.
 */

const CURSOR: Record<ArrangeHandle, string> = {
  move: 'move',
  nw: 'nwse-resize',
  n: 'ns-resize',
  ne: 'nesw-resize',
  e: 'ew-resize',
  se: 'nwse-resize',
  s: 'ns-resize',
  sw: 'nesw-resize',
  w: 'ew-resize',
};

const HANDLES: Exclude<ArrangeHandle, 'move'>[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

interface Drag {
  field: LabelFieldKey;
  handle: ArrangeHandle;
  clientX: number;
  clientY: number;
  from: LabelPlacement;
}

export function LabelArranger({
  boxes,
  turns,
  canvas,
  fold,
  scale,
  gutter,
  selected,
  onSelect,
  onChange,
}: {
  /** Where every field is now, automatic or arranged — the drawing's own boxes. */
  boxes: LabelPlacements;
  turns: Record<LabelFieldKey, Turn>;
  canvas: { w: number; h: number };
  fold: number | null;
  /** Screen pixels per millimetre, zoom included. */
  scale: number;
  gutter: number;
  selected: LabelFieldKey | null;
  onSelect: (field: LabelFieldKey | null) => void;
  onChange: (next: LabelPlacements) => void;
}) {
  const drag = useRef<Drag | null>(null);
  // The move handler runs off the window, so it reads the current props through a
  // ref: re-subscribing on every render would drop the listener mid-drag.
  const live = useRef({ boxes, turns, canvas, fold, scale, onChange });
  live.current = { boxes, turns, canvas, fold, scale, onChange };

  useEffect(() => {
    function onMove(event: PointerEvent) {
      const current = drag.current;
      if (!current) return;
      event.preventDefault();
      const { boxes: now, canvas: frame, fold: crease, scale: px, onChange: emit } = live.current;

      const step = event.shiftKey ? FINE_MM : SNAP_MM;
      const dx = (event.clientX - current.clientX) / px;
      const dy = (event.clientY - current.clientY) / px;

      const next = resize({
        field: current.field,
        handle: current.handle,
        from: current.from,
        dx,
        dy,
        step,
        canvas: frame,
        fold: crease,
      });

      emit({ ...now, [current.field]: next });
    }

    function onUp() {
      drag.current = null;
    }

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, []);

  function begin(event: React.PointerEvent, field: LabelFieldKey, handle: ArrangeHandle) {
    const from = boxes[field];
    if (!from) return;
    event.preventDefault();
    event.stopPropagation();
    drag.current = { field, handle, clientX: event.clientX, clientY: event.clientY, from };
    onSelect(field);
  }

  return (
    <div
      className="absolute"
      style={{ left: gutter, top: gutter, width: canvas.w * scale, height: canvas.h * scale }}
      onPointerDown={() => onSelect(null)}
    >
      {LABEL_FIELDS.map(({ key, label }) => {
        const box = boxes[key];
        if (!box) return null;
        const isSelected = selected === key;
        const fixed = PLACEMENT_MOVE_ONLY.includes(key);

        return (
          <div
            key={key}
            role="button"
            tabIndex={0}
            aria-label={`${label} placement`}
            onPointerDown={(e) => begin(e, key, 'move')}
            onKeyDown={(e) => {
              // R turns it a quarter, which is the whole vocabulary of turning here:
              // artwork on a box goes one of four ways round and nothing in between.
              if (e.key === 'r' || e.key === 'R') {
                e.preventDefault();
                onChange({ ...boxes, [key]: rotatePlacement(box, canvas, turns[key]) });
                return;
              }
              const nudge = e.shiftKey ? 2 : SNAP_MM;
              const move =
                e.key === 'ArrowLeft'
                  ? { x: -nudge, y: 0 }
                  : e.key === 'ArrowRight'
                    ? { x: nudge, y: 0 }
                    : e.key === 'ArrowUp'
                      ? { x: 0, y: -nudge }
                      : e.key === 'ArrowDown'
                        ? { x: 0, y: nudge }
                        : null;
              if (!move) return;
              e.preventDefault();
              onChange({
                ...boxes,
                [key]: resize({
                  field: key,
                  handle: 'move',
                  from: box,
                  dx: move.x,
                  dy: move.y,
                  step: FINE_MM,
                  canvas,
                  fold,
                }),
              });
            }}
            className={`absolute transition-colors ${
              isSelected
                ? 'border border-cyan-300 bg-cyan-300/10'
                : 'border border-dashed border-white/40 hover:border-cyan-300/80 hover:bg-cyan-300/5'
            }`}
            style={{
              left: box.x * scale,
              top: box.y * scale,
              width: box.w * scale,
              height: box.h * scale,
              cursor: 'move',
              zIndex: isSelected ? 2 : 1,
            }}
          >
            {/* Named only while it matters: a permanent caption over every block
                would hide the artwork this view exists to show. */}
            {isSelected && (
              <span className="pointer-events-none absolute -top-4 left-0 whitespace-nowrap text-[10px] font-medium text-cyan-300">
                {label} · {box.w.toFixed(1)} × {box.h.toFixed(1)} mm
                {turns[key] === 0 ? '' : ` · ${turns[key]}°`}
              </span>
            )}

            {isSelected &&
              !fixed &&
              HANDLES.map((handle) => (
                <span
                  key={handle}
                  onPointerDown={(e) => begin(e, key, handle)}
                  className="absolute h-2 w-2 border border-gray-900 bg-cyan-300"
                  style={{ ...handleSpot(handle), cursor: CURSOR[handle] }}
                />
              ))}
          </div>
        );
      })}
    </div>
  );
}

/** Where a handle sits on the edge of its box, centred on the corner or the side. */
function handleSpot(handle: Exclude<ArrangeHandle, 'move'>): React.CSSProperties {
  const at = {
    n: { top: -4, left: '50%', marginLeft: -4 },
    s: { bottom: -4, left: '50%', marginLeft: -4 },
    w: { left: -4, top: '50%', marginTop: -4 },
    e: { right: -4, top: '50%', marginTop: -4 },
    nw: { top: -4, left: -4 },
    ne: { top: -4, right: -4 },
    sw: { bottom: -4, left: -4 },
    se: { bottom: -4, right: -4 },
  } as const;
  return at[handle];
}
