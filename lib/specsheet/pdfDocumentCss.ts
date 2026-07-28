/**
 * Minimal CSS injected into Chromium PDF documents.
 *
 * The document loads the app's real stylesheets, so layout, spacing, and fonts
 * must come from there — never from this file. Only two things are needed here:
 * page setup, and neutralizing the two print tricks that work in a browser tab
 * but break a headless PDF (`body * { visibility: hidden }` and the absolute
 * positioning used to lift the sheet out of its tab container).
 */
export const PDF_DOCUMENT_CSS = `
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

/* The sheet is the only node in this document; nothing needs hiding. */
body,
body * {
  visibility: visible !important;
}

#spec-sheet-print {
  position: static !important;
  left: auto !important;
  top: auto !important;
  display: block !important;
  margin: 0 auto !important;
  border: none !important;
  box-shadow: none !important;
  background: #ffffff !important;
}
`;
