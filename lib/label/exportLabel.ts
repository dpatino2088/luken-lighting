'use client';

import { serializeSpecSheetForPdf } from '@/lib/specsheet/serializeSpecSheet';
import { LABEL_ROOT_ID } from '@/components/label/LabelSvg';
import { LABEL_INK, type LabelTemplate } from '@/lib/label/geometry';

function safeName(value: string, suffix: string): string {
  const safe = (value || 'label').replace(/[^A-Za-z0-9._-]+/g, '-');
  return `${safe}-${suffix}`;
}

/**
 * PDF at the template's exact trim size, printed by the same Chromium pipeline
 * the spec sheet uses. `preferCSSPageSize` on the server means the millimetre
 * page size sent here is what lands in the file.
 */
export async function exportLabelPdf(template: LabelTemplate): Promise<Blob> {
  const snapshot = await serializeSpecSheetForPdf(LABEL_ROOT_ID);
  const res = await fetch('/api/spec-sheet-pdf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({
      ...snapshot,
      rootId: LABEL_ROOT_ID,
      pageSize: { width_mm: template.width_mm, height_mm: template.height_mm },
      // Bleed: the page rounds up a fraction of a millimetre, and it should ink
      // over rather than show a white hairline at the trim.
      background: LABEL_INK,
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
 * SVG straight from the DOM — this is the handoff to Illustrator, which opens it
 * with the vectors and type still editable so the designer can convert to CMYK.
 * No server round trip is needed because the preview is already the artwork.
 */
export function exportLabelSvg(): Blob {
  const node = document.getElementById(LABEL_ROOT_ID);
  if (!node) {
    throw new Error('Label preview not found. Open the Label tab once, then try again.');
  }

  const clone = node.cloneNode(true) as SVGElement;
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');

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
