'use client';

import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { SHEET_HEIGHT_PX, SHEET_PAD_PX, SHEET_WIDTH_PX } from '@/lib/specsheet/sheetGeometry';
import { serializeSpecSheetForPdf } from '@/lib/specsheet/serializeSpecSheet';

export { SHEET_HEIGHT_PX, SHEET_PAD_PX, SHEET_WIDTH_PX } from '@/lib/specsheet/sheetGeometry';

async function waitForImages(root: HTMLElement): Promise<void> {
  const imgs = Array.from(root.querySelectorAll('img'));
  await Promise.all(
    imgs.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete && img.naturalWidth > 0) {
            resolve();
            return;
          }
          const done = () => resolve();
          img.addEventListener('load', done, { once: true });
          img.addEventListener('error', done, { once: true });
          setTimeout(done, 4000);
        })
    )
  );
}

function revealHiddenAncestors(el: HTMLElement): HTMLElement[] {
  const hidden: HTMLElement[] = [];
  let node: HTMLElement | null = el;
  while (node) {
    if (node.hasAttribute('hidden')) {
      hidden.push(node);
      node.removeAttribute('hidden');
    }
    const style = window.getComputedStyle(node);
    if (style.opacity === '0' || style.visibility === 'hidden') {
      hidden.push(node);
      node.style.setProperty('opacity', '1', 'important');
      node.style.setProperty('visibility', 'visible', 'important');
      node.dataset.specSheetReveal = '1';
    }
    node = node.parentElement;
  }
  return hidden;
}

function restoreRevealed(nodes: HTMLElement[]) {
  for (const n of nodes) {
    if (n.dataset.specSheetReveal === '1') {
      n.style.removeProperty('opacity');
      n.style.removeProperty('visibility');
      delete n.dataset.specSheetReveal;
    } else {
      n.setAttribute('hidden', '');
    }
  }
}

/** Chromium print→PDF (same engine as browser Preview / Save as PDF). */
async function exportViaChromium(): Promise<Blob> {
  const snapshot = await serializeSpecSheetForPdf();
  const res = await fetch('/api/spec-sheet-pdf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(snapshot),
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
 * Fallback raster path (html2canvas). Only used if Chromium API is unavailable.
 * Not pixel-identical to Preview — keep for offline/dev resilience only.
 */
async function exportViaHtml2Canvas(rootId = 'spec-sheet-print'): Promise<Blob> {
  const source = document.getElementById(rootId);
  if (!source) {
    throw new Error('Spec sheet preview not found. Open the Preview tab once, then try again.');
  }

  const revealed = revealHiddenAncestors(source);
  await waitForImages(source);
  await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

  const host = document.createElement('div');
  host.setAttribute('data-spec-sheet-capture-host', '1');
  host.style.cssText = [
    'position:fixed',
    'left:0',
    'top:0',
    'width:' + SHEET_WIDTH_PX + 'px',
    'z-index:2147483646',
    'opacity:1',
    'pointer-events:none',
    'background:#ffffff',
    'transform:translateX(-100vw)',
  ].join(';');

  const clone = source.cloneNode(true) as HTMLElement;
  clone.id = `${rootId}-capture`;
  clone.style.cssText = [
    'width:' + SHEET_WIDTH_PX + 'px',
    'min-height:' + SHEET_HEIGHT_PX + 'px',
    'max-width:' + SHEET_WIDTH_PX + 'px',
    'margin:0',
    'box-shadow:none',
    'border:none',
    'background:#ffffff',
    'opacity:1',
    'transform:none',
    'position:relative',
    'display:block',
  ].join(';');

  clone.querySelectorAll('.print-page-head, .print-page-foot').forEach((el) => {
    (el as HTMLElement).style.display = 'none';
  });

  const pad = clone.querySelector('.spec-sheet-pad') as HTMLElement | null;
  if (pad) {
    pad.style.setProperty('padding', `${SHEET_PAD_PX}px`, 'important');
    pad.style.setProperty('box-sizing', 'border-box', 'important');
    pad.style.setProperty('width', '100%', 'important');
  }

  host.appendChild(clone);
  document.body.appendChild(host);

  try {
    await waitForImages(clone);
    await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

    const canvas = await html2canvas(clone, {
      scale: 2,
      useCORS: true,
      allowTaint: false,
      backgroundColor: '#ffffff',
      logging: false,
      width: SHEET_WIDTH_PX,
      windowWidth: SHEET_WIDTH_PX,
      scrollX: 0,
      scrollY: 0,
      x: 0,
      y: 0,
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'in', format: 'letter' });
    const pageW = 8.5;
    const pageH = 11;
    const imgW = pageW;
    const imgH = (canvas.height * imgW) / canvas.width;

    let heightLeft = imgH;
    let position = 0;

    pdf.addImage(imgData, 'PNG', 0, position, imgW, imgH);
    heightLeft -= pageH;

    while (heightLeft > 0.02) {
      position = heightLeft - imgH;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, imgW, imgH);
      heightLeft -= pageH;
    }

    return pdf.output('blob');
  } finally {
    host.remove();
    restoreRevealed(revealed);
  }
}

/**
 * Capture `#spec-sheet-print` into a US Letter PDF via Chromium print
 * (guaranteed match to Chrome Preview / Save as PDF).
 * No html2canvas fallback — that path diverges from Preview layout.
 */
export async function exportSpecSheetPdfBlob(
  _rootId = 'spec-sheet-print'
): Promise<Blob> {
  return exportViaChromium();
}

/** Last-resort raster export (dev/debug only — layout may diverge from Preview). */
export async function exportSpecSheetPdfBlobRasterFallback(
  rootId = 'spec-sheet-print'
): Promise<Blob> {
  return exportViaHtml2Canvas(rootId);
}

export function specSheetPdfFileName(code: string): string {
  const safe = (code || 'spec-sheet').replace(/[^A-Za-z0-9._-]+/g, '-');
  return `${safe}-spec-sheet.pdf`;
}
