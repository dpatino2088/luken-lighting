/**
 * Minimal CSS injected into Chromium PDF documents.
 *
 * The document loads the app's real stylesheets, so layout, spacing, and fonts
 * must come from there — never from this file. Only two things are needed here:
 * page setup, and neutralizing the two print tricks that work in a browser tab
 * but break a headless PDF (`body * { visibility: hidden }` and the absolute
 * positioning used to lift the sheet out of its tab container).
 */

/** Page size in millimetres. Omit for US Letter. */
export interface PdfPageSize {
  width_mm: number;
  height_mm: number;
}

export function pdfDocumentCss(options?: {
  pageSize?: PdfPageSize | null;
  /** Element the document is built around — `#id` gets the reset below. */
  rootId?: string;
  /**
   * Page background. Chromium rounds the page box up by ~0.2mm, so artwork sized
   * to the exact trim leaves a hairline of page showing. Setting this to the
   * artwork's own colour turns that sliver into bleed instead of a white edge.
   */
  background?: string;
}): string {
  const rootId = options?.rootId || 'spec-sheet-print';
  const background = options?.background || '#ffffff';
  const size = options?.pageSize
    ? `${options.pageSize.width_mm}mm ${options.pageSize.height_mm}mm`
    : 'letter';

  return `
@page {
  size: ${size};
  margin: 0;
}

html, body {
  margin: 0 !important;
  padding: 0 !important;
  background: ${background} !important;
  -webkit-print-color-adjust: exact !important;
  print-color-adjust: exact !important;
}

/* The sheet is the only node in this document; nothing needs hiding. */
body,
body * {
  visibility: visible !important;
}

#${rootId} {
  position: static !important;
  left: auto !important;
  top: auto !important;
  display: block !important;
  margin: 0 auto !important;
  border: none !important;
  box-shadow: none !important;
  background: ${background} !important;
}
`;
}

/** US Letter defaults, kept for the spec sheet path. */
export const PDF_DOCUMENT_CSS = pdfDocumentCss();
