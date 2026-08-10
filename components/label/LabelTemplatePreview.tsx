'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Move, Ruler } from 'lucide-react';
import { LabelSvg } from '@/components/label/LabelSvg';
import { LabelMeasures, MEASURE_GUTTER, measureItems } from '@/components/label/LabelMeasures';
import { LabelArranger } from '@/components/label/LabelArranger';
import { LabelPlacementFields } from '@/components/label/LabelPlacementFields';
import { contentOf, drawnTurns, layoutLabel, placementsOf } from '@/lib/label/layout';
import { SAMPLE_LABEL_DATA } from '@/lib/label/labelData';
import {
  LABEL_FIELDS,
  isTurned,
  type LabelFieldKey,
  type LabelLevel,
  type LabelPlacements,
  type LabelShape,
} from '@/lib/label/geometry';

/**
 * The artwork a template will produce, drawn while it is still being chosen.
 *
 * The same renderer and the same engine as the download, on a sample product: the
 * point is that nothing about a size is a surprise once a real variant is opened.
 * Every control in the form redraws this, so a fold moved by 10 mm or a barcode
 * pinned across can be judged where it is decided.
 */

/** CSS defines the millimetre exactly, so 1× really is the trim size on screen. */
const PX_PER_MM = 96 / 25.4;

/** Never the exporter's id: this drawing is a sample, and must not be downloadable. */
const PREVIEW_ROOT_ID = 'label-template-preview';

const MIN_SCALE = 0.4;
const MAX_SCALE = 3;
/** Breathing room inside the stage, so the artwork is not flush to the border. */
const STAGE_PAD = 16;

export function LabelTemplatePreview({
  shape,
  level,
  logoUrl,
  onPlacements,
}: {
  shape: LabelShape;
  /** The lamp itself ships without a barcode, so its preview must not show one. */
  level: LabelLevel;
  logoUrl: string | null;
  /** Given, the drawing can be arranged by hand. Absent, it is a drawing. */
  onPlacements?: (next: LabelPlacements) => void;
}) {
  // A zero-height probe rather than the scrolling stage: measuring the element
  // that scrolls would feed its own scrollbar back into the fit calculation.
  const probe = useRef<HTMLDivElement>(null);
  const [room, setRoom] = useState(0);
  const [zoom, setZoom] = useState<'fit' | number>('fit');
  const [measuring, setMeasuring] = useState(false);
  const [arranging, setArranging] = useState(false);
  const [selected, setSelected] = useState<LabelFieldKey | null>(null);

  useEffect(() => {
    const el = probe.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 0;
      if (width > 0) setRoom(width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const data = useMemo(
    () => ({
      ...SAMPLE_LABEL_DATA,
      gtin: level === 'product' ? null : SAMPLE_LABEL_DATA.gtin,
      logoUrl,
    }),
    [level, logoUrl]
  );

  const content = useMemo(() => contentOf(data, shape.visibility), [data, shape.visibility]);
  const layout = useMemo(() => layoutLabel(shape, content), [shape, content]);
  const measures = useMemo(() => measureItems(layout), [layout]);

  // What the handles grab: the boxes of the drawing on screen, whether the engine
  // or a person put them there. Handing back the whole set on every change is what
  // captures the automatic layout the first time anything is dragged.
  const boxes = useMemo(() => placementsOf(layout), [layout]);
  const turns = useMemo(() => drawnTurns(layout, shape), [layout, shape]);

  /**
   * What the engine would do with this label, kept alongside what is on screen.
   *
   * It is the reference both ways back: the size a block started at, and the place it
   * started in. Recomputed rather than remembered, so it is still the right answer
   * after the label has been resized — a 60mm template's natural barcode is not the
   * one a 130mm template was arranged from.
   */
  const engine = useMemo(
    () => layoutLabel({ ...shape, placements: undefined }, content),
    [shape, content]
  );
  const engineBoxes = useMemo(() => placementsOf(engine), [engine]);
  const engineTurns = useMemo(() => drawnTurns(engine, shape), [engine, shape]);
  const manual = Object.keys(shape.placements ?? {}).length > 0;

  /**
   * The size the engine gives this block, as it applies to the way it is turned now.
   *
   * A barcode the engine drew standing up is 19 × 30; asking for its original size
   * while it lies across has to mean 30 × 19, or the button would turn the block by
   * changing its sides instead of giving it back the size it had.
   */
  function naturalSize(field: LabelFieldKey): { w: number; h: number } | null {
    const box = engineBoxes[field];
    if (!box) return null;
    const same = isTurned(engineTurns[field]) === isTurned(turns[field]);
    return same ? { w: box.w, h: box.h } : { w: box.h, h: box.w };
  }

  /**
   * Every change to the arrangement goes out through here, carrying the quarter turns
   * with it.
   *
   * The boxes the editor works on are the drawing's own, and those hold no turn: a
   * field only carries one once it has been turned deliberately, which is what keeps
   * the direction settings live for everything else. So a drag or a typed millimetre
   * arrives without one, and the turn already stored has to be put back or moving a
   * block by half a millimetre would quietly stand it back up.
   */
  function commit(next: LabelPlacements, reset?: LabelFieldKey) {
    if (!onPlacements) return;
    const stored = shape.placements ?? {};
    const out: LabelPlacements = { ...next };
    for (const { key } of LABEL_FIELDS) {
      const box = out[key];
      const turn = stored[key]?.turn;
      if (key === reset || !box || box.turn !== undefined || turn === undefined) continue;
      out[key] = { ...box, turn };
    }
    onPlacements(out);
  }

  /** One field handed back to the engine, without unsettling the rest. */
  function autoBox(field: LabelFieldKey) {
    const box = engineBoxes[field];
    if (!box) return;
    // Its direction goes back as well: a field handed to the engine has no opinion of
    // its own left, which is why this one is exempt from carrying its turn over.
    commit({ ...boxes, [field]: box }, field);
  }

  const gutter = measuring ? MEASURE_GUTTER : 0;
  const naturalPx = layout.canvas.w * PX_PER_MM;
  const fit = room > 0 ? (room - gutter * 2 - STAGE_PAD * 2) / naturalPx : 1;
  const scale = zoom === 'fit' ? Math.min(MAX_SCALE, Math.max(MIN_SCALE, fit)) : zoom;

  return (
    <div className="space-y-2">
      <div ref={probe} className="h-0 w-full" />

      <div className="flex items-center gap-3">
        <p className="text-xs font-medium text-gray-700">
          {layout.canvas.w} × {layout.canvas.h} mm
        </p>
        <p className="text-[11px] text-gray-500">
          {shape.orientation === 'portrait' ? 'artwork turned' : 'artwork across'}
          {layout.fold !== null ? `, fold at ${layout.fold} mm` : ', single panel'}
        </p>
        <div className="ml-auto flex items-center gap-2 text-[11px] text-gray-500">
          {onPlacements && (
            <button
              type="button"
              onClick={() => {
                setArranging((on) => !on);
                setSelected(null);
              }}
              aria-pressed={arranging}
              className={`inline-flex items-center gap-1 px-2 py-1 border transition-colors ${arranging ? 'border-gray-900 text-gray-900 font-medium' : 'border-gray-200 hover:border-gray-400'}`}
            >
              <Move className="h-3 w-3" />
              Arrange
            </button>
          )}
          <button
            type="button"
            onClick={() => setMeasuring((on) => !on)}
            aria-pressed={measuring}
            className={`inline-flex items-center gap-1 px-2 py-1 border transition-colors ${measuring ? 'border-gray-900 text-gray-900 font-medium' : 'border-gray-200 hover:border-gray-400'}`}
          >
            <Ruler className="h-3 w-3" />
            Measure
          </button>
          <div className="flex items-center gap-1">
            {(['fit', 1, 1.5, 2] as const).map((z) => (
              <button
                key={String(z)}
                type="button"
                onClick={() => setZoom(z)}
                className={`px-2 py-1 border transition-colors ${zoom === z ? 'border-gray-900 text-gray-900 font-medium' : 'border-gray-200 hover:border-gray-400'}`}
              >
                {z === 'fit' ? 'Fit' : `${z}×`}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="overflow-auto bg-gray-100 border border-gray-200" style={{ padding: STAGE_PAD }}>
        <div
          className="relative"
          style={{
            width: naturalPx * scale + gutter * 2,
            height: layout.canvas.h * PX_PER_MM * scale + gutter * 2,
          }}
        >
          <div
            className="absolute"
            style={{
              left: gutter,
              top: gutter,
              transform: `scale(${scale})`,
              transformOrigin: 'top left',
            }}
          >
            <LabelSvg template={shape} data={data} showPlaceholders rootId={PREVIEW_ROOT_ID} />
          </div>
          {measuring && (
            <LabelMeasures
              layout={layout}
              scale={PX_PER_MM * scale}
              gutter={gutter}
              items={measures}
            />
          )}
          {arranging && onPlacements && (
            <LabelArranger
              boxes={boxes}
              turns={turns}
              canvas={layout.canvas}
              fold={layout.fold}
              scale={PX_PER_MM * scale}
              gutter={gutter}
              selected={selected}
              onSelect={setSelected}
              onChange={commit}
            />
          )}
        </div>
      </div>

      {arranging && onPlacements && (
        <div className="space-y-2">
          {selected && boxes[selected] ? (
            <LabelPlacementFields
              field={selected}
              box={boxes[selected]}
              turn={turns[selected]}
              canvas={layout.canvas}
              fold={layout.fold}
              boxes={boxes}
              natural={naturalSize(selected)}
              onChange={commit}
              onReset={() => autoBox(selected)}
            />
          ) : (
            <p className="text-[11px] text-gray-500">
              Click a block to select it, then drag it or pull its handles — to any size you want,
              and the note under the drawing says if a symbol has gone below what prints reliably.
              R turns it a quarter. Arrow keys nudge it half a millimetre, hold Shift to move it
              further; hold Shift while dragging for tenths instead of halves. Edges and the fold
              line pull the box to them.
            </p>
          )}

          <p className="text-[11px] text-gray-500">
            {manual ? (
              <>
                This template is arranged by hand.{' '}
                <button
                  type="button"
                  onClick={() => {
                    onPlacements({});
                    setSelected(null);
                  }}
                  className="underline hover:text-gray-900"
                >
                  Hand all of it back to the engine
                </button>{' '}
                to have every size laid out automatically again.
              </>
            ) : (
              <>
                Laid out automatically. Moving anything takes over the whole arrangement, starting
                from exactly what you see, and this size stops re-arranging itself when the label
                changes.
              </>
            )}
          </p>
        </div>
      )}

      <p className="text-[11px] text-gray-500">
        Drawn on a sample product — family <strong>LEDA</strong>, a full Alhena Long SKU and the GS1
        sample barcode — because a size has to survive the longest strings you print, not the
        shortest. A real variant differs only in the words.
      </p>
    </div>
  );
}
