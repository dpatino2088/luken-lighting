'use client';

import { useEffect, useState } from 'react';

export interface InlineLogo {
  viewBox: string;
  inner: string;
}

/**
 * Pulls the label logo into the document as real vector markup.
 *
 * A `<image href="https://…logo.svg">` renders fine in the browser but arrives
 * in Illustrator as a broken link, and the exported SVG is the whole point of
 * the handoff. Inlining makes the logo part of the artwork: editable in
 * Illustrator, embedded in the PDF, and independent of the storage URL.
 *
 * Raster logos cannot be inlined this way, so they stay a linked <image> and the
 * Label tab tells the user to upload an SVG.
 */
export function useInlineLogo(logoUrl: string | null): InlineLogo | null {
  const [logo, setLogo] = useState<InlineLogo | null>(null);

  useEffect(() => {
    let alive = true;
    setLogo(null);
    if (!logoUrl) return;

    fetch(logoUrl)
      .then(async (res) => {
        const type = res.headers.get('content-type') || '';
        const isSvg = type.includes('svg') || /\.svg(\?|$)/i.test(logoUrl);
        if (!res.ok || !isSvg) return null;
        return res.text();
      })
      .then((text) => {
        if (!alive || !text) return;
        const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
        const svg = doc.querySelector('svg');
        if (!svg || doc.querySelector('parsererror')) return;

        // Fall back to width/height when the file omits a viewBox, otherwise the
        // nested <svg> has no coordinate system to scale from.
        const viewBox =
          svg.getAttribute('viewBox') ||
          `0 0 ${parseFloat(svg.getAttribute('width') || '0') || 100} ${
            parseFloat(svg.getAttribute('height') || '0') || 100
          }`;

        setLogo({ viewBox, inner: svg.innerHTML });
      })
      .catch(() => {
        /* keep the linked <image> fallback */
      });

    return () => {
      alive = false;
    };
  }, [logoUrl]);

  return logo;
}
