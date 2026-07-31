'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  FONT_DISPLAY,
  FONT_TEXT,
  LABEL_INK,
  LABEL_PAPER,
  quarterFrame,
  type LabelShape,
} from '@/lib/label/geometry';
import { contentOf, layoutLabel } from '@/lib/label/layout';
import { formatUpcAHuman } from '@/lib/label/gtin';
import { qrSvg, upcaSvg, type SymbolSvg } from '@/lib/label/symbols';
import { FittedText } from '@/components/label/FittedText';
import { useInlineLogo } from '@/lib/label/useInlineLogo';
import type { LabelData } from '@/lib/label/labelData';

/** Root id the PDF exporter serializes. */
export const LABEL_ROOT_ID = 'label-print';

export function LabelSvg({
  template,
  data,
  showPlaceholders = false,
  rootId = LABEL_ROOT_ID,
}: {
  /** A saved template or one still being typed into the Settings form. */
  template: LabelShape;
  data: LabelData;
  /** Draws guides for artwork that has not been supplied yet. Preview only. */
  showPlaceholders?: boolean;
  /**
   * Both exports look the artwork up by id, so a second drawing on the page — the
   * one in Settings, of a size that is not even saved yet — must carry a different
   * one. It then cannot be picked up by a download, and the ids stay unique.
   */
  rootId?: string;
}) {
  const [barcode, setBarcode] = useState<SymbolSvg | null>(null);
  const [qr, setQr] = useState<SymbolSvg | null>(null);
  const inlineLogo = useInlineLogo(data.logoUrl);

  useEffect(() => {
    let alive = true;
    if (!data.gtin) {
      setBarcode(null);
      return;
    }
    upcaSvg(data.gtin)
      .then((s) => {
        if (alive) setBarcode(s);
      })
      .catch(() => {
        if (alive) setBarcode(null);
      });
    return () => {
      alive = false;
    };
  }, [data.gtin]);

  useEffect(() => {
    let alive = true;
    if (!data.qrUrl) {
      setQr(null);
      return;
    }
    qrSvg(data.qrUrl)
      .then((s) => {
        if (alive) setQr(s);
      })
      .catch(() => {
        if (alive) setQr(null);
      });
    return () => {
      alive = false;
    };
  }, [data.qrUrl]);

  // Every position comes from here, including which pieces made it onto the
  // label at this size. The preview is the artwork, so the same call decides both.
  const layout = useMemo(() => layoutLabel(template, contentOf(data)), [template, data]);

  // Every turned element is drawn upright inside its own frame and the frame is
  // rotated into place. Proportions survive that; stretching a wordmark into a tall
  // box does not, and neither does hand-writing a transform per element per quarter.
  const barFrame = layout.barcode
    ? quarterFrame(layout.barcode, layout.barcode.turn)
    : { transform: undefined, w: 0, h: 0 };
  const siteFrame = layout.site ? quarterFrame(layout.site, layout.site.turn) : null;
  const logoFrame = layout.logo ? quarterFrame(layout.logo, layout.logo.turn) : null;
  const logoDraw = logoFrame
    ? // Inside the frame it is always upright at the origin; the placeholder still
      // reports the space taken on the label, which is the frame the other way round.
      { x: 0, y: 0, w: logoFrame.w, h: logoFrame.h, spot: { w: logoFrame.w, h: logoFrame.h } }
    : null;

  return (
    <svg
      id={rootId}
      xmlns="http://www.w3.org/2000/svg"
      xmlnsXlink="http://www.w3.org/1999/xlink"
      // The canvas is always horizontal. A piece applied vertically is this same
      // rectangle with its fields turned, so the file the supplier receives keeps
      // one shape and only the artwork inside it changes.
      width={`${layout.canvas.w}mm`}
      height={`${layout.canvas.h}mm`}
      viewBox={`0 0 ${layout.canvas.w} ${layout.canvas.h}`}
      // Physical units: the factory measures this file, so the SVG must carry
      // real millimetres rather than a pixel box that happens to look right.
      style={{ display: 'block' }}
    >
      <rect x={0} y={0} width={layout.canvas.w} height={layout.canvas.h} fill={LABEL_INK} />

      {layout.fold !== null && (
        <>
          {/* Fold marks: short ticks top and bottom, as in the current artwork,
              so the die line does not print across the face of the label. */}
          <line
            x1={layout.fold}
            y1={0}
            x2={layout.fold}
            y2={layout.canvas.h * 0.28}
            stroke={LABEL_PAPER}
            strokeWidth={0.2}
          />
          <line
            x1={layout.fold}
            y1={layout.canvas.h * 0.72}
            x2={layout.fold}
            y2={layout.canvas.h}
            stroke={LABEL_PAPER}
            strokeWidth={0.2}
          />
        </>
      )}

      {/* Barcode on its white block: bars with their digits beneath, drawn upright
          in the block's own frame and then turned with it. That is what keeps the
          digits under the bars at every quarter instead of beside them at one turn
          and over them at another. Bar height is whatever the layout allowed, which
          on a short label or a hand-squeezed box is less than nominal. */}
      {layout.barcode && data.gtin && barcode && (
        <g transform={barFrame.transform}>
          <rect x={0} y={0} width={barFrame.w} height={barFrame.h} fill={LABEL_PAPER} />
          <svg
            x={layout.barcode.quiet}
            y={0}
            width={layout.barcode.symbolW}
            height={layout.barcode.barHeight}
            viewBox={barcode.viewBox}
            preserveAspectRatio="none"
            dangerouslySetInnerHTML={{ __html: barcode.inner }}
          />
          {/* Inside the white block: dark ink on the dark field would be invisible. */}
          <text
            x={barFrame.w / 2}
            y={layout.barcode.barHeight + layout.barcode.digitSize}
            fontFamily={FONT_TEXT}
            fontSize={layout.barcode.digitSize}
            fill={LABEL_INK}
            textAnchor="middle"
          >
            {formatUpcAHuman(data.gtin)}
          </text>
        </g>
      )}

      {/* Site + origin, two rows in their own frame, so the second row steps away
          from the first whichever way the block is turned. */}
      {layout.site && siteFrame && (
        <text
          transform={siteFrame.transform}
          x={0}
          y={layout.site.size}
          fontFamily={FONT_TEXT}
          fontSize={layout.site.size}
          fill={LABEL_PAPER}
        >
          <tspan fontWeight="700">{data.siteText}</tspan>
          <tspan x={0} dy={layout.site.size * 1.15} fontSize={layout.site.size * 0.85}>
            {data.originText}
          </tspan>
        </text>
      )}

      {/* Family → name → Long SKU → electrical line, in whatever sizes fit. A long
          SKU arrives already broken at its hyphens, one entry per line. */}
      {layout.lines.map((line, index) => (
        <FittedText
          key={`${line.key}-${index}`}
          x={line.x}
          y={line.y}
          turn={line.turn}
          maxWidth={line.maxWidth}
          fontSize={line.size}
          minFontSize={Math.max(1.2, line.size * 0.5)}
          fontFamily={line.key === 'family' ? FONT_DISPLAY : FONT_TEXT}
          fill={LABEL_PAPER}
        >
          {line.text}
        </FittedText>
      ))}

      {/* QR to the product page, on its own white quiet zone. Left uncaptioned:
          the GTIN belongs under the bars, and printing it here too suggested the
          QR encoded the barcode number rather than the product URL. */}
      {layout.qr && qr && (
        <>
          <rect
            x={layout.qr.x - layout.qr.quiet}
            y={layout.qr.y - layout.qr.quiet}
            width={layout.qr.w + layout.qr.quiet * 2}
            height={layout.qr.h + layout.qr.quiet * 2}
            fill={LABEL_PAPER}
          />
          {/* Turning a square symbol changes nothing anyone can see, but the setting
              exists per field, so it is honoured rather than silently ignored. */}
          <g
            transform={
              layout.qr.turn === 0
                ? undefined
                : `rotate(${-layout.qr.turn}, ${layout.qr.x + layout.qr.w / 2}, ${layout.qr.y + layout.qr.h / 2})`
            }
          >
            <svg
              x={layout.qr.x}
              y={layout.qr.y}
              width={layout.qr.w}
              height={layout.qr.h}
              viewBox={qr.viewBox}
              fill={LABEL_INK}
              dangerouslySetInnerHTML={{ __html: qr.inner }}
            />
          </g>
        </>
      )}

      {/* Brand logo — uploaded once in Settings and shared by every label */}
      {logoDraw && logoFrame && (
        <g transform={logoFrame.transform}>
          {inlineLogo ? (
            <svg
              x={logoDraw.x}
              y={logoDraw.y}
              width={logoDraw.w}
              height={logoDraw.h}
              viewBox={inlineLogo.viewBox}
              preserveAspectRatio="xMaxYMax meet"
              fill={LABEL_PAPER}
              dangerouslySetInnerHTML={{ __html: inlineLogo.inner }}
            />
          ) : data.logoUrl ? (
            <image
              href={data.logoUrl}
              x={logoDraw.x}
              y={logoDraw.y}
              width={logoDraw.w}
              height={logoDraw.h}
              preserveAspectRatio="xMaxYMax meet"
            />
          ) : (
            // Shows the space the logo will occupy while none is uploaded, so the
            // proportions can be judged now. Stripped before any export.
            showPlaceholders && (
              <g data-preview-only="true">
                <rect
                  x={logoDraw.x}
                  y={logoDraw.y}
                  width={logoDraw.w}
                  height={logoDraw.h}
                  fill="none"
                  stroke={LABEL_PAPER}
                  strokeWidth={0.2}
                  strokeDasharray="1 1"
                  opacity={0.5}
                />
                <text
                  x={logoDraw.x + logoDraw.w / 2}
                  y={logoDraw.y + logoDraw.h * 0.68}
                  fontFamily={FONT_TEXT}
                  fontSize={Math.min(2.6, logoDraw.h * 0.5)}
                  fill={LABEL_PAPER}
                  textAnchor="middle"
                  opacity={0.5}
                >
                  LOGO {logoDraw.spot.w.toFixed(0)} × {logoDraw.spot.h.toFixed(0)} mm
                </text>
              </g>
            )
          )}
        </g>
      )}
    </svg>
  );
}
