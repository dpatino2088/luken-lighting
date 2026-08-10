'use client';

import { LABEL_ROOT_ID } from '@/components/label/LabelSvg';
import { LABEL_INK, type LabelTemplate } from '@/lib/label/geometry';

function safeName(value: string, suffix: string): string {
  const safe = (value || 'label').replace(/[^A-Za-z0-9._-]+/g, '-');
  return `${safe}-${suffix}`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
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

function labelLetterCss(): string {
  return `
@page {
  size: letter;
  margin: 0;
}
html, body {
  margin: 0 !important;
  padding: 0 !important;
  background: #ffffff !important;
  -webkit-print-color-adjust: exact !important;
  print-color-adjust: exact !important;
}
body, body * {
  visibility: visible !important;
}
#label-letter-sheet {
  position: relative !important;
  display: flex !important;
  flex-direction: column !important;
  box-sizing: border-box !important;
  width: 215.9mm !important;
  height: 279.4mm !important;
  margin: 0 !important;
  padding: 18mm !important;
  background: #ffffff !important;
  color: #111111 !important;
  font-family: Helvetica, Arial, sans-serif !important;
}
#label-letter-sheet .label-letter-header {
  margin: 0 0 10mm !important;
  font-size: 11pt !important;
  letter-spacing: 0.08em !important;
  text-transform: uppercase !important;
  color: #666666 !important;
}
#label-letter-sheet .label-letter-art {
  line-height: 0 !important;
  flex: 0 0 auto !important;
}
#label-letter-sheet .label-letter-art img {
  display: block !important;
  margin: 0 !important;
  max-width: none !important;
  max-height: none !important;
  border: none !important;
  image-rendering: -webkit-optimize-contrast;
}
#label-letter-sheet .label-letter-spacer {
  flex: 1 1 auto !important;
  min-height: 12mm !important;
}
#label-letter-sheet .label-letter-footer {
  flex: 0 0 auto !important;
  border-top: 1px solid #cccccc !important;
  padding-top: 8mm !important;
  font-size: 10pt !important;
  line-height: 1.45 !important;
  color: #111111 !important;
  word-break: break-word !important;
}
#label-letter-sheet .label-letter-footer .label {
  display: block !important;
  color: #666666 !important;
  text-transform: uppercase !important;
  letter-spacing: 0.06em !important;
  font-size: 8pt !important;
  margin-bottom: 1mm !important;
}
#label-letter-sheet .label-letter-footer p {
  margin: 0 0 4mm !important;
}
#label-letter-sheet .label-letter-footer p:last-child {
  margin-bottom: 0 !important;
}
`;
}

/**
 * US Letter PDF for the manufacturer: label artwork at the top (rasterised from
 * the live preview so type cannot reflow past the trim), identifying text in
 * the footer for PRO.
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

  const sheetHtml = `<div id="label-letter-sheet">
  <p class="label-letter-header">Label artwork · ${escapeHtml(sizeLine)}</p>
  <div class="label-letter-art">
    <img
      src="${art.dataUrl}"
      alt="Label ${escapeHtml(sizeLine)}"
      style="width:${art.widthMm}mm;height:${art.heightMm}mm;"
    />
  </div>
  <div class="label-letter-spacer" aria-hidden="true"></div>
  <div class="label-letter-footer">
    <p><span class="label">Description</span>${escapeHtml(description)}</p>
    <p><span class="label">Manufacturer SKU</span>${escapeHtml(manufacturerSku)}</p>
    <p><span class="label">Luken SKU</span>${escapeHtml(code)}</p>
  </div>
</div>`;

  // Fonts are already baked into the PNG — no need to ship app stylesheets.
  const snapshot = {
    css: labelLetterCss(),
    styleHrefs: [] as string[],
    htmlClass: '',
    bodyClass: '',
  };

  const res = await fetch('/api/spec-sheet-pdf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({
      html: sheetHtml,
      css: snapshot.css,
      styleHrefs: snapshot.styleHrefs,
      htmlClass: snapshot.htmlClass,
      bodyClass: snapshot.bodyClass,
      rootId: 'label-letter-sheet',
      pageSize: null,
      background: '#FFFFFF',
      mediaType: 'screen',
      skipDocumentCss: true,
    }),
  });

  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const j = (await res.json()) as { error?: string };
      if (j.error) detail = j.error;
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }

  return res.blob();
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
