'use client';

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

/**
 * Absolute URLs of the app's real stylesheets, so Chromium loads the exact same
 * CSS the Preview is using — including @font-face for Inter and every Tailwind
 * arbitrary-value utility. Far more faithful (and far smaller) than shipping
 * serialized rule text.
 */
function collectStyleHrefs(): string[] {
  const hrefs: string[] = [];
  document.querySelectorAll('link[rel~="stylesheet"]').forEach((node) => {
    const href = (node as HTMLLinkElement).getAttribute('href');
    if (!href) return;
    try {
      hrefs.push(new URL(href, window.location.href).href);
    } catch {
      /* skip unparseable href */
    }
  });
  return Array.from(new Set(hrefs));
}

/** Inline <style> blocks (dev-mode CSS, next/font declarations). */
function collectInlineStyles(): string {
  const MAX = 1_500_000;
  let css = '';
  document.querySelectorAll('style').forEach((node) => {
    const text = node.textContent || '';
    if (!text || css.length + text.length + 1 > MAX) return;
    css += `\n${text}`;
  });
  return css;
}

/**
 * Last-resort collector, used only when the document exposes no stylesheet
 * links or inline styles.
 *
 * Selector text in `cssRules` is escaped (`.w-\[38\%\]`), so matching against
 * raw class tokens (`w-[38%]`) needs the backslashes stripped first — otherwise
 * every arbitrary-value utility is silently dropped and the layout collapses.
 */
export function collectDocumentCss(html = ''): string {
  const MAX = 1_200_000;
  const classSet = new Set<string>();
  for (const m of html.matchAll(/\bclass=["']([^"']*)["']/g)) {
    for (const c of m[1].split(/\s+/)) {
      if (c) classSet.add(c);
    }
  }

  const priority: string[] = [];
  const rest: string[] = [];

  for (const sheet of Array.from(document.styleSheets)) {
    try {
      for (const rule of Array.from(sheet.cssRules)) {
        const text = rule.cssText;
        const isPriority =
          text.includes('@page') ||
          text.includes('@media print') ||
          text.includes('@font-face') ||
          text.includes(':root') ||
          text.includes('spec-sheet') ||
          text.includes('print-page') ||
          text.includes('#spec-sheet-print');
        if (isPriority) {
          priority.push(text);
          continue;
        }
        const unescaped = text.replace(/\\/g, '');
        let used = classSet.size === 0;
        if (!used) {
          for (const c of classSet) {
            if (unescaped.includes(c)) {
              used = true;
              break;
            }
          }
        }
        if (used) rest.push(text);
      }
    } catch {
      // Cross-origin sheets are not readable — ignore.
    }
  }

  let css = priority.join('\n');
  for (const rule of rest) {
    if (css.length + rule.length + 1 > MAX) break;
    css += `\n${rule}`;
  }
  return css;
}

function absolutizeUrls(root: HTMLElement) {
  root.querySelectorAll('img[src]').forEach((node) => {
    const img = node as HTMLImageElement;
    try {
      img.setAttribute('src', new URL(img.getAttribute('src') || '', window.location.href).href);
    } catch {
      /* keep as-is */
    }
  });
  root.querySelectorAll('[href]').forEach((node) => {
    const el = node as HTMLAnchorElement;
    const href = el.getAttribute('href');
    if (!href || href.startsWith('#') || href.startsWith('data:')) return;
    try {
      el.setAttribute('href', new URL(href, window.location.href).href);
    } catch {
      /* keep as-is */
    }
  });
}

export type SerializedSpecSheet = {
  html: string;
  css: string;
  styleHrefs: string[];
  htmlClass: string;
  bodyClass: string;
};

/**
 * Snapshot `#spec-sheet-print` for Chromium print→PDF.
 *
 * The clone is handed over untouched: the server loads the app's own
 * stylesheets and renders in print media, which is the same pipeline as Chrome's
 * "Save as PDF". Restyling anything here would make the PDF diverge from the
 * Preview, so keep this to a faithful snapshot.
 */
export async function serializeSpecSheetForPdf(
  rootId = 'spec-sheet-print'
): Promise<SerializedSpecSheet> {
  const source = document.getElementById(rootId);
  if (!source) {
    throw new Error('Spec sheet preview not found. Open the Preview tab once, then try again.');
  }

  const revealed = revealHiddenAncestors(source);
  try {
    await waitForImages(source);
    await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

    const clone = source.cloneNode(true) as HTMLElement;
    clone.removeAttribute('id');
    clone.id = 'spec-sheet-print';
    absolutizeUrls(clone);

    const html = clone.outerHTML;
    const styleHrefs = collectStyleHrefs();
    const inlineCss = collectInlineStyles();
    // Only fall back to serialized rule text when the document exposes neither.
    const css = styleHrefs.length > 0 || inlineCss.trim() ? inlineCss : collectDocumentCss(html);

    return {
      html,
      css,
      styleHrefs,
      // Inter is wired through a class on <html> plus `font-sans` on <body>;
      // dropping them is what made the PDF fall back to a system font.
      htmlClass: document.documentElement.className || '',
      bodyClass: document.body.className || '',
    };
  } finally {
    restoreRevealed(revealed);
  }
}
