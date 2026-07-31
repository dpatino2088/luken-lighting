'use client';

import { TURN_LABEL, type Turn } from '@/lib/label/geometry';
import type { LabelLayout, LineKey } from '@/lib/label/layout';

/**
 * Dimensions drawn over the preview, for reading sizes off the screen the way you
 * would off a die line.
 *
 * A sibling of the artwork, never a child of it: both exports work from the
 * `#label-print` SVG alone, so nothing here can reach the factory. It also means
 * the annotations can be sized in screen pixels rather than millimetres — a 10px
 * number stays readable at 1×, where 2mm of type would not.
 *
 * The sizes themselves are keyed to the drawing by letter rather than written
 * beside each element. On a 60 × 40 label at 1× there is no room to write
 * `19.2 × 30.1` next to a block 19mm wide without it running across the next one,
 * and half-legible overlapping numbers are worse than none.
 */

/** Room the dimension lines need around the label, in screen pixels. */
export const MEASURE_GUTTER = 46;

/** Trim and fold, on the grey around the label. */
const OUTER = '#1D4ED8';
/** Elements, on the dark artwork itself. */
const INNER = '#22D3EE';
/** The space the type is set in — the same room the layout engine fits it to. */
const TYPE = '#FBBF24';

const FONT = 10;
const BADGE = 14;

function fmt(mm: number): string {
  const rounded = Math.round(mm * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

/** Names the quarter a block is on, and says nothing at all when it is upright. */
function turnSuffix(turn: Turn): string {
  return turn === 0 ? '' : `, ${TURN_LABEL[turn].toLowerCase()}`;
}

export interface MeasureItem {
  /** Letter tying the row to a box on the drawing. Null for whole-label sizes. */
  tag: string | null;
  term: string;
  value: string;
  spot: { x: number; y: number; w: number; h: number; color: string } | null;
}

const LINE_TERM: Record<LineKey, string> = {
  family: 'Family name',
  name: 'Product name',
  code: 'Long SKU',
  spec: 'Electrical line',
};

/**
 * Every size worth having in front of you, in millimetres: the outline, the
 * elements the engine placed, and the type, which has no box to point at.
 *
 * One list, used by the drawing and by the table under it, so a letter on the
 * artwork and a row in the legend can never come to disagree.
 */
export function measureItems(layout: LabelLayout): MeasureItem[] {
  const items: MeasureItem[] = [
    {
      tag: null,
      term: 'Trim',
      value: `${fmt(layout.canvas.w)} × ${fmt(layout.canvas.h)}`,
      spot: null,
    },
  ];

  if (layout.fold !== null) {
    items.push({
      tag: null,
      term: 'Panels, fold at',
      value: `${fmt(layout.fold)} + ${fmt(layout.canvas.w - layout.fold)}`,
      spot: null,
    });
  }

  let letter = 65; // 'A'
  const tagged = (
    term: string,
    value: string,
    rect: { x: number; y: number; w: number; h: number },
    color: string
  ) => {
    items.push({
      tag: String.fromCharCode(letter++),
      term,
      value,
      spot: { ...rect, color },
    });
  };

  if (layout.barcode) {
    tagged(
      `Barcode${turnSuffix(layout.barcode.turn)}`,
      `${fmt(layout.barcode.w)} × ${fmt(layout.barcode.h)}, bars ${fmt(layout.barcode.barHeight)}`,
      layout.barcode,
      INNER
    );
  }

  if (layout.qr) {
    // The box is the quiet zone, which is as much a print requirement as the
    // symbol: nothing may be set inside it.
    tagged(
      'QR, with quiet zone',
      `${fmt(layout.qr.w)} + ${fmt(layout.qr.quiet)} all round`,
      {
        x: layout.qr.x - layout.qr.quiet,
        y: layout.qr.y - layout.qr.quiet,
        w: layout.qr.w + layout.qr.quiet * 2,
        h: layout.qr.h + layout.qr.quiet * 2,
      },
      INNER
    );
  }

  if (layout.logo) {
    tagged(
      `Logo${turnSuffix(layout.logo.turn)}`,
      `${fmt(layout.logo.w)} × ${fmt(layout.logo.h)}`,
      layout.logo,
      INNER
    );
  }

  const lines = layout.lines;
  if (lines.length > 0) {
    const along = Math.max(...lines.map((l) => l.maxWidth));
    // The box the type is set in, which is what the engine fits to and what the
    // arranger drags. Deriving it back from the baselines instead would need a
    // different sum per quarter turn, and would report the ink rather than the room.
    const block = layout.textArea;
    if (block.w > 0 && block.h > 0) {
      tagged(`Type block${turnSuffix(lines[0].turn)}`, `column ${fmt(along)}`, block, TYPE);
    }

    for (const key of ['family', 'name', 'code', 'spec'] as LineKey[]) {
      const parts = lines.filter((l) => l.key === key);
      if (parts.length === 0) continue;
      items.push({
        tag: null,
        term: LINE_TERM[key],
        value:
          parts.length > 1
            ? `${fmt(parts[0].size)} (${parts.length} lines)`
            : fmt(parts[0].size),
        spot: null,
      });
    }
  }

  return items;
}

/** Dimension line with end ticks and the measurement over the middle of it. */
function HDim({
  x1,
  x2,
  y,
  label,
  from,
}: {
  x1: number;
  x2: number;
  y: number;
  label: string;
  /** Where the witness lines run to: the edge being measured. */
  from?: number;
}) {
  return (
    <g stroke={OUTER} fill={OUTER}>
      {from !== undefined && (
        <g opacity={0.45} strokeWidth={0.75}>
          <line x1={x1} y1={y} x2={x1} y2={from} />
          <line x1={x2} y1={y} x2={x2} y2={from} />
        </g>
      )}
      <line x1={x1} y1={y} x2={x2} y2={y} strokeWidth={1} />
      <line x1={x1} y1={y - 3.5} x2={x1} y2={y + 3.5} strokeWidth={1} />
      <line x1={x2} y1={y - 3.5} x2={x2} y2={y + 3.5} strokeWidth={1} />
      <text
        x={(x1 + x2) / 2}
        y={y - 4}
        textAnchor="middle"
        fontSize={FONT}
        fontWeight={600}
        stroke="none"
      >
        {label}
      </text>
    </g>
  );
}

function VDim({ y1, y2, x, label, from }: { y1: number; y2: number; x: number; label: string; from?: number }) {
  return (
    <g stroke={OUTER} fill={OUTER}>
      {from !== undefined && (
        <g opacity={0.45} strokeWidth={0.75}>
          <line x1={x} y1={y1} x2={from} y2={y1} />
          <line x1={x} y1={y2} x2={from} y2={y2} />
        </g>
      )}
      <line x1={x} y1={y1} x2={x} y2={y2} strokeWidth={1} />
      <line x1={x - 3.5} y1={y1} x2={x + 3.5} y2={y1} strokeWidth={1} />
      <line x1={x - 3.5} y1={y2} x2={x + 3.5} y2={y2} strokeWidth={1} />
      <text
        transform={`translate(${x - 4}, ${(y1 + y2) / 2}) rotate(-90)`}
        textAnchor="middle"
        fontSize={FONT}
        fontWeight={600}
        stroke="none"
      >
        {label}
      </text>
    </g>
  );
}

export function LabelMeasures({
  layout,
  scale,
  gutter = MEASURE_GUTTER,
  items,
}: {
  layout: LabelLayout;
  /** Screen pixels per millimetre, zoom included. */
  scale: number;
  gutter?: number;
  items: MeasureItem[];
}) {
  const W = layout.canvas.w * scale;
  const H = layout.canvas.h * scale;
  const width = W + gutter * 2;
  const height = H + gutter * 2;
  const X = (mm: number) => gutter + mm * scale;
  const Y = (mm: number) => gutter + mm * scale;

  const left = gutter;
  const top = gutter;
  const right = gutter + W;
  const bottom = gutter + H;
  const fold = layout.fold;

  return (
    <svg
      className="absolute inset-0 pointer-events-none"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      fontFamily="ui-sans-serif, system-ui, sans-serif"
      aria-hidden="true"
    >
      <rect
        x={left}
        y={top}
        width={W}
        height={H}
        fill="none"
        stroke={OUTER}
        strokeWidth={1}
        opacity={0.5}
      />
      <HDim x1={left} x2={right} y={top - 26} from={top} label={`${fmt(layout.canvas.w)} mm`} />
      <VDim y1={top} y2={bottom} x={left - 26} from={left} label={`${fmt(layout.canvas.h)} mm`} />

      {fold !== null && (
        <>
          <line
            x1={X(fold)}
            y1={top}
            x2={X(fold)}
            y2={bottom}
            stroke={OUTER}
            strokeWidth={1}
            strokeDasharray="5 3"
            opacity={0.85}
          />
          <HDim x1={left} x2={X(fold)} y={bottom + 22} from={bottom} label={fmt(fold)} />
          <HDim
            x1={X(fold)}
            x2={right}
            y={bottom + 22}
            from={bottom}
            label={fmt(layout.canvas.w - fold)}
          />
        </>
      )}

      {items.map((item) =>
        item.spot && item.tag ? (
          <g key={item.tag}>
            <rect
              x={X(item.spot.x)}
              y={Y(item.spot.y)}
              width={item.spot.w * scale}
              height={item.spot.h * scale}
              fill="none"
              stroke={item.spot.color}
              strokeWidth={1}
              strokeDasharray="3 2"
              opacity={0.9}
            />
            {/* Above the box, so it never sits over the artwork it points at — the
                type block starts exactly where the family name does, and a badge in
                that corner would cover its first letter. Inside only when the box is
                against the top edge and there is nowhere above to go. */}
            <Badge
              x={X(item.spot.x)}
              y={Y(item.spot.y)}
              inside={Y(item.spot.y) - top < BADGE + 3}
              color={item.spot.color}
              label={item.tag}
            />
          </g>
        ) : null
      )}
    </svg>
  );
}

function Badge({
  x,
  y,
  inside,
  color,
  label,
}: {
  x: number;
  y: number;
  inside: boolean;
  color: string;
  label: string;
}) {
  const bx = inside ? x + 1 : x;
  const by = inside ? y + 1 : y - BADGE - 2;
  return (
    <g>
      <rect x={bx} y={by} width={BADGE} height={BADGE} fill={color} />
      <text
        x={bx + BADGE / 2}
        y={by + BADGE - 4}
        textAnchor="middle"
        fontSize={FONT}
        fontWeight={700}
        fill="#0B1220"
      >
        {label}
      </text>
    </g>
  );
}
