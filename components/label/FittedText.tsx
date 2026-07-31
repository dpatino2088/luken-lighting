'use client';

import { useEffect, useRef, useState } from 'react';
import type { Turn } from '@/lib/label/geometry';

/**
 * SVG text that shrinks to stay inside its column.
 *
 * Long SKUs are the norm here — `ALH15-32-TRA-LED-MOD-WH-CR90-CT30-OP36` is a
 * real code — and at a fixed size it would run under the QR and off the label.
 * The width is measured from the live DOM rather than estimated from character
 * count, because the preview *is* the artwork: whatever fits on screen is what
 * the PDF and the SVG hand to the factory.
 *
 * Measurement waits on `document.fonts.ready`: measuring before Archivo Black
 * loads would size the type against a fallback face and come out wrong.
 */
export function FittedText({
  x,
  y,
  turn = 0,
  maxWidth,
  fontSize,
  minFontSize,
  fontFamily,
  fill,
  children,
}: {
  x: number;
  y: number;
  /** Quarter turn of the line, anticlockwise, about the start of its baseline. */
  turn?: Turn;
  maxWidth: number;
  fontSize: number;
  minFontSize: number;
  fontFamily: string;
  fill: string;
  children: string;
}) {
  const ref = useRef<SVGTextElement>(null);
  const [size, setSize] = useState(fontSize);
  // Only when shrinking alone cannot save it: condense the glyphs to the column.
  const [compress, setCompress] = useState(false);

  useEffect(() => {
    let alive = true;
    const el = ref.current;
    if (!el || !children) return;

    const fit = () => {
      if (!alive || !el) return;
      // Measure at the nominal size regardless of what a previous pass set, so
      // the result does not drift when the text changes.
      el.setAttribute('font-size', String(fontSize));
      el.removeAttribute('textLength');
      const length = el.getComputedTextLength();
      if (!length) return;

      if (length <= maxWidth) {
        setSize(fontSize);
        setCompress(false);
        return;
      }
      const scaled = (fontSize * maxWidth) / length;
      setSize(Math.max(minFontSize, scaled));
      setCompress(scaled < minFontSize);
    };

    document.fonts.ready.then(fit).catch(fit);
    return () => {
      alive = false;
    };
  }, [children, fontSize, maxWidth, minFontSize]);

  return (
    <text
      ref={ref}
      // Turned, the position moves into the transform: the measurement above is
      // unaffected, since getComputedTextLength is taken along the baseline
      // whichever way that baseline points.
      {...(turn === 0
        ? { x, y }
        : { transform: `translate(${x}, ${y}) rotate(${-turn})` })}
      fontFamily={fontFamily}
      fontSize={size}
      fill={fill}
      {...(compress ? { textLength: maxWidth, lengthAdjust: 'spacingAndGlyphs' as const } : {})}
    >
      {children}
    </text>
  );
}
