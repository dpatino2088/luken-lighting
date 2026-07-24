'use client';

import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

const LETTER_W_IN = 8.5;
const LETTER_H_IN = 11;

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
          // Cached / broken images can leave us hanging.
          setTimeout(done, 4000);
        })
    )
  );
}

/**
 * Capture `#spec-sheet-print` into a US Letter PDF blob (same layout as Preview).
 * Temporarily reveals hidden ancestors so layout has real dimensions.
 */
export async function exportSpecSheetPdfBlob(
  rootId = 'spec-sheet-print'
): Promise<Blob> {
  const el = document.getElementById(rootId);
  if (!el) throw new Error('Spec sheet preview not found. Open Preview once, then save again.');

  const hiddenAncestors: HTMLElement[] = [];
  let node: HTMLElement | null = el;
  while (node) {
    if (node.hasAttribute('hidden')) {
      hiddenAncestors.push(node);
      node.removeAttribute('hidden');
    }
    node = node.parentElement;
  }

  // Off-screen hosts (left: -120vw) still have layout; force a paint.
  await waitForImages(el);
  await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

  try {
    const canvas = await html2canvas(el, {
      scale: 2,
      useCORS: true,
      allowTaint: false,
      backgroundColor: '#ffffff',
      logging: false,
      // Avoid capturing only the scrolled viewport of the tab.
      windowWidth: el.scrollWidth,
      windowHeight: el.scrollHeight,
    });

    const imgData = canvas.toDataURL('image/jpeg', 0.92);
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'in', format: 'letter' });
    const imgWidth = LETTER_W_IN;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = 0;

    pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
    heightLeft -= LETTER_H_IN;

    while (heightLeft > 0.01) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
      heightLeft -= LETTER_H_IN;
    }

    return pdf.output('blob');
  } finally {
    for (const n of hiddenAncestors) n.setAttribute('hidden', '');
  }
}

export function specSheetPdfFileName(code: string): string {
  const safe = (code || 'spec-sheet').replace(/[^A-Za-z0-9._-]+/g, '-');
  return `${safe}-spec-sheet.pdf`;
}
