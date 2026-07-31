'use client';

/**
 * Barcode and QR generation for labels.
 *
 * bwip-js returns a standalone <svg> with its own viewBox in module units. We
 * keep the inner markup and re-embed it in a nested <svg> sized in millimetres,
 * which is what lets the label control the exact physical size of the symbol
 * while staying pure vector — no raster anywhere, matching the existing
 * Illustrator artwork.
 */

export interface SymbolSvg {
  viewBox: string;
  /** Inner markup of the generated SVG, ready to nest. */
  inner: string;
}

type BwipOptions = {
  bcid: string;
  text: string;
  scale?: number;
  height?: number;
  includetext?: boolean;
  eclevel?: string;
};

let bwip: { toSVG: (opts: BwipOptions) => Promise<string> } | null = null;

async function loadBwip() {
  if (!bwip) {
    bwip = (await import('bwip-js/browser')) as unknown as typeof bwip;
  }
  return bwip!;
}

function splitSvg(svg: string): SymbolSvg {
  const viewBox = /viewBox="([^"]+)"/.exec(svg)?.[1] ?? '0 0 1 1';
  const inner = svg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
  return { viewBox, inner };
}

/** UPC-A bars only — the human-readable digits are set by the label itself. */
export async function upcaSvg(gtin: string): Promise<SymbolSvg> {
  const lib = await loadBwip();
  const svg = await lib.toSVG({
    bcid: 'upca',
    text: gtin,
    includetext: false,
    scale: 1,
    height: 10,
  });
  return splitSvg(svg);
}

export async function qrSvg(text: string): Promise<SymbolSvg> {
  const lib = await loadBwip();
  const svg = await lib.toSVG({
    bcid: 'qrcode',
    text,
    scale: 1,
    // Medium recovery: survives the scuffing a shipping box takes without
    // inflating the module count the way high correction would.
    eclevel: 'M',
  });
  return splitSvg(svg);
}
