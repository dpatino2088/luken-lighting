'use client';

import { LABEL_ROOT_ID } from '@/components/label/LabelSvg';
import { LABEL_INK, type LabelTemplate } from '@/lib/label/geometry';

function safeName(value: string, suffix: string): string {
  const safe = (value || 'label').replace(/[^A-Za-z0-9._-]+/g, '-');
  return `${safe}-${suffix}`;
}

export type LabelPdfMeta = {
  description?: string | null;
  manufacturerSku?: string | null;
  code?: string | null;
  family?: string | null;
  name?: string | null;
};

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error || new Error('Failed to read blob'));
    reader.readAsDataURL(blob);
  });
}

async function fetchAsDataUrl(url: string): Promise<string | null> {
  try {
    const abs = new URL(url, window.location.href).href;
    const res = await fetch(abs, { credentials: 'same-origin' });
    if (!res.ok) return null;
    return blobToDataUrl(await res.blob());
  } catch {
    try {
      // Cross-origin public assets (Supabase) — retry without credentials.
      const res = await fetch(url, { mode: 'cors' });
      if (!res.ok) return null;
      return blobToDataUrl(await res.blob());
    } catch {
      return null;
    }
  }
}

/**
 * Pull every @font-face the preview is using and rewrite src urls to data URIs
 * so a standalone SVG (and the canvas rasteriser) keeps Archivo Black / Source Sans.
 */
async function collectEmbeddedFontCss(): Promise<string> {
  const chunks: string[] = [];

  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      continue;
    }

    for (const rule of Array.from(rules)) {
      if (!(rule instanceof CSSFontFaceRule)) continue;
      let css = rule.cssText;
      const matches = Array.from(css.matchAll(/url\((["']?)([^"')]+)\1\)/g));
      for (const match of matches) {
        const rawUrl = match[2];
        if (!rawUrl || rawUrl.startsWith('data:')) continue;
        const abs = new URL(rawUrl, sheet.href || window.location.href).href;
        const data = await fetchAsDataUrl(abs);
        if (data) css = css.split(rawUrl).join(data);
      }
      chunks.push(css);
    }
  }

  return chunks.join('\n');
}

/** Turn linked <image href> into data URLs so canvas drawing is not tainted / blank. */
async function inlineSvgImages(svg: SVGElement) {
  const images = Array.from(svg.querySelectorAll('image'));
  await Promise.all(
    images.map(async (img) => {
      const href =
        img.getAttribute('href') ||
        img.getAttributeNS('http://www.w3.org/1999/xlink', 'href');
      if (!href || href.startsWith('data:')) return;
      const data = await fetchAsDataUrl(href);
      if (!data) return;
      img.setAttribute('href', data);
      img.setAttributeNS('http://www.w3.org/1999/xlink', 'href', data);
    })
  );
}

/**
 * Lock each text run to the exact advance width measured in the live preview.
 * Even if Chromium substitutes a face, spacingAndGlyphs keeps the perimeter.
 */
function lockTextLengths(live: SVGElement, clone: SVGElement) {
  const liveTexts = Array.from(live.querySelectorAll('text'));
  const cloneTexts = Array.from(clone.querySelectorAll('text'));
  const n = Math.min(liveTexts.length, cloneTexts.length);
  for (let i = 0; i < n; i++) {
    const src = liveTexts[i] as SVGTextElement;
    const dst = cloneTexts[i] as SVGTextElement;
    try {
      const length = src.getComputedTextLength();
      if (!length || !Number.isFinite(length)) continue;
      dst.setAttribute('textLength', String(length));
      dst.setAttribute('lengthAdjust', 'spacingAndGlyphs');
      const cs = window.getComputedStyle(src);
      if (cs.fontFamily) dst.setAttribute('font-family', cs.fontFamily);
      if (cs.fontWeight) dst.setAttribute('font-weight', cs.fontWeight);
      if (cs.fontSize) {
        // Prefer the fitted attribute already on the node.
        if (!dst.getAttribute('font-size')) {
          dst.setAttribute('font-size', cs.fontSize);
        }
      }
    } catch {
      /* measurement can fail on detached nodes — ignore */
    }
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to rasterise label SVG'));
    img.src = url;
  });
}

/**
 * Rasterise the on-screen label exactly as the preview draws it.
 * Chromium's PDF pass must not re-layout SVG type — that is what pushed text
 * past the trim. A 300 dpi PNG keeps the preview geometry and sits on Letter.
 */
async function rasterizeLabelPreview(
  live: SVGSVGElement,
  widthMm: number,
  heightMm: number
): Promise<{ dataUrl: string; widthMm: number; heightMm: number }> {
  await document.fonts.ready.catch(() => undefined);

  const clone = live.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');

  lockTextLengths(live, clone);
  await inlineSvgImages(clone);

  const fontCss = await collectEmbeddedFontCss();
  if (fontCss) {
    const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
    style.textContent = fontCss;
    clone.insertBefore(style, clone.firstChild);
  }

  // Canvas drawImage needs pixel dimensions on the SVG root; viewBox stays in mm.
  const dpi = 300;
  const pxPerMm = dpi / 25.4;
  const pxW = Math.max(1, Math.round(widthMm * pxPerMm));
  const pxH = Math.max(1, Math.round(heightMm * pxPerMm));
  clone.setAttribute('width', String(pxW));
  clone.setAttribute('height', String(pxH));
  if (!clone.getAttribute('viewBox')) {
    clone.setAttribute('viewBox', `0 0 ${widthMm} ${heightMm}`);
  }

  const xml = new XMLSerializer().serializeToString(clone);
  const blob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  try {
    const img = await loadImage(url);
    const canvas = document.createElement('canvas');
    canvas.width = pxW;
    canvas.height = pxH;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas unavailable for label PDF');
    ctx.drawImage(img, 0, 0, pxW, pxH);
    return {
      dataUrl: canvas.toDataURL('image/png'),
      widthMm,
      heightMm,
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * US Letter PDF for the manufacturer: label artwork at the top (rasterised from
 * the live preview so type cannot reflow past the trim), identifying text in the
 * footer for PRO.
 *
 * Built entirely in the browser with jsPDF — the artwork is already a PNG, so we
 * do not call /api/spec-sheet-pdf (Chromium on Vercel). That path still serves
 * Spec Sheets; Labels were failing with a bare HTTP 500 when Chromium died.
 */
export async function exportLabelPdf(
  template: LabelTemplate,
  meta: LabelPdfMeta = {}
): Promise<Blob> {
  const root = document.getElementById(LABEL_ROOT_ID);
  if (!root || !(root instanceof SVGSVGElement)) {
    throw new Error('Label preview not found. Open the Label tab once, then try again.');
  }

  const art = await rasterizeLabelPreview(root, template.width_mm, template.height_mm);

  const description =
    (meta.description || '').trim() ||
    [meta.family, meta.name].filter(Boolean).join(' — ') ||
    '—';
  const manufacturerSku = (meta.manufacturerSku || '').trim() || '—';
  const code = (meta.code || '').trim() || '—';
  const sizeLine = `${template.width_mm} × ${template.height_mm} mm`;

  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const pad = 18;
  const contentW = pageW - pad * 2;

  // Header
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(11);
  pdf.setTextColor(102, 102, 102);
  pdf.text(`LABEL ARTWORK · ${sizeLine}`.toUpperCase(), pad, pad + 4);

  // Artwork (physical mm size, top-left under header)
  const artY = pad + 14;
  pdf.addImage(art.dataUrl, 'PNG', pad, artY, art.widthMm, art.heightMm);

  // Footer block anchored to the bottom margin
  const lineH = 4.2;
  const labelH = 3.2;
  const gap = 4;
  const rows = [
    { label: 'DESCRIPTION', value: description },
    { label: 'MANUFACTURER SKU', value: manufacturerSku },
    { label: 'LUKEN SKU', value: code },
  ];

  const valueLines = rows.map((row) =>
    pdf.splitTextToSize(row.value, contentW) as string[]
  );
  const blockH =
    1 + // rule
    8 + // padding above first label
    valueLines.reduce((sum, lines) => sum + labelH + lines.length * lineH + gap, 0);

  let y = pageH - pad - blockH;
  pdf.setDrawColor(204, 204, 204);
  pdf.setLineWidth(0.25);
  pdf.line(pad, y, pageW - pad, y);
  y += 8;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const lines = valueLines[i];
    pdf.setFontSize(8);
    pdf.setTextColor(102, 102, 102);
    pdf.text(row.label, pad, y);
    y += labelH;
    pdf.setFontSize(10);
    pdf.setTextColor(17, 17, 17);
    pdf.text(lines, pad, y);
    y += lines.length * lineH + gap;
  }

  return pdf.output('blob');
}

/**
 * SVG straight from the DOM — Illustrator handoff with editable vectors.
 * Fonts are embedded and text lengths locked to the preview fit.
 */
export async function exportLabelSvg(): Promise<Blob> {
  const node = document.getElementById(LABEL_ROOT_ID);
  if (!node || !(node instanceof SVGSVGElement)) {
    throw new Error('Label preview not found. Open the Label tab once, then try again.');
  }

  await document.fonts.ready.catch(() => undefined);
  const clone = node.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
  lockTextLengths(node, clone);
  await inlineSvgImages(clone);

  const fontCss = await collectEmbeddedFontCss();
  if (fontCss) {
    const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
    style.textContent = fontCss;
    clone.insertBefore(style, clone.firstChild);
  }

  const markup = `<?xml version="1.0" encoding="UTF-8"?>\n${new XMLSerializer().serializeToString(clone)}`;
  return new Blob([markup], { type: 'image/svg+xml;charset=utf-8' });
}

export function labelFileName(code: string, ext: 'pdf' | 'svg'): string {
  return safeName(code, `label.${ext}`);
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export const LABEL_TRIM_BACKGROUND = LABEL_INK;
