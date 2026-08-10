import { NextResponse } from 'next/server';
import { getCurrentUser, getCurrentUserRole } from '@/lib/auth';
import { launchPdfBrowser } from '@/lib/specsheet/launchBrowser';
import { pdfDocumentCss, type PdfPageSize } from '@/lib/specsheet/pdfDocumentCss';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type Body = {
  html?: string;
  css?: string;
  styleHrefs?: string[];
  htmlClass?: string;
  bodyClass?: string;
  /** Millimetre page size for fixed-format output such as labels. */
  pageSize?: { width_mm?: number; height_mm?: number } | null;
  rootId?: string;
  background?: string;
  /**
   * Chromium media. Spec sheets need `print` (their @media print rules).
   * Labels use `screen` so globals.css cannot hide everything except #spec-sheet-print.
   */
  mediaType?: 'print' | 'screen';
  /** When true, skip the generic page CSS that forces position:static on the root. */
  skipDocumentCss?: boolean;
};

function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

/**
 * Rebuild the Preview's document: same <html>/<body> classes (Inter lives on a
 * class), same stylesheets, then optional PDF_DOCUMENT_CSS last so its page setup wins.
 */
function buildDocument(body: {
  html: string;
  css: string;
  styleHrefs: string[];
  htmlClass: string;
  bodyClass: string;
  baseHref: string;
  pageSize: PdfPageSize | null;
  rootId: string;
  background: string | null;
  skipDocumentCss: boolean;
}): string {
  const links = body.styleHrefs
    .map((href) => `<link rel="stylesheet" href="${escapeAttr(href)}" />`)
    .join('\n');

  const documentCss = body.skipDocumentCss
    ? ''
    : pdfDocumentCss({
        pageSize: body.pageSize,
        rootId: body.rootId,
        background: body.background || undefined,
      });

  return `<!DOCTYPE html>
<html lang="en" class="${escapeAttr(body.htmlClass)}">
<head>
<meta charset="utf-8" />
<base href="${escapeAttr(body.baseHref)}" />
<title>Label</title>
${links}
${body.css ? `<style>\n${body.css}\n</style>` : ''}
${documentCss ? `<style>\n${documentCss}\n</style>` : ''}
</head>
<body class="${escapeAttr(body.bodyClass)}">
${body.html}
</body>
</html>`;
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const role = await getCurrentUserRole();
  if (role !== 'admin' && role !== 'editor') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const html = typeof body.html === 'string' ? body.html.trim() : '';
  const css = typeof body.css === 'string' ? body.css : '';
  if (!html || html.length > 4_000_000) {
    return NextResponse.json({ error: 'Missing or oversized html' }, { status: 400 });
  }
  if (css.length > 4_000_000) {
    return NextResponse.json({ error: 'Oversized css' }, { status: 400 });
  }

  const w = Number(body.pageSize?.width_mm);
  const h = Number(body.pageSize?.height_mm);
  const pageSize: PdfPageSize | null =
    Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0
      ? { width_mm: w, height_mm: h }
      : null;
  const rootId = typeof body.rootId === 'string' && /^[A-Za-z][\w-]*$/.test(body.rootId)
    ? body.rootId
    : 'spec-sheet-print';
  const mediaType = body.mediaType === 'screen' ? 'screen' : 'print';
  const skipDocumentCss = Boolean(body.skipDocumentCss);

  const documentHtml = buildDocument({
    html,
    css,
    styleHrefs: Array.isArray(body.styleHrefs)
      ? body.styleHrefs.filter((h): h is string => typeof h === 'string').slice(0, 50)
      : [],
    htmlClass: typeof body.htmlClass === 'string' ? body.htmlClass : '',
    bodyClass: typeof body.bodyClass === 'string' ? body.bodyClass : '',
    baseHref: new URL(request.url).origin,
    pageSize,
    rootId,
    background: /^#[0-9A-Fa-f]{3,8}$/.test(String(body.background || ''))
      ? String(body.background)
      : null,
    skipDocumentCss,
  });

  const browser = await launchPdfBrowser();
  try {
    const page = await browser.newPage();
    // Spec sheets need print media for their thead/tfoot spacers. Labels use
    // screen so globals.css cannot hide everything outside #spec-sheet-print.
    await page.emulateMediaType(mediaType);
    await page.setViewport({ width: 816, height: 1056, deviceScaleFactor: 1 });
    await page.setContent(documentHtml, {
      waitUntil: 'load',
      timeout: 45_000,
    });
    await page.waitForNetworkIdle({ idleTime: 500, timeout: 15_000 }).catch(() => undefined);

    await page.evaluate(async () => {
      await Promise.all(
        Array.from(document.images).map((img) =>
          img.complete
            ? Promise.resolve()
            : new Promise<void>((resolve) => {
                img.addEventListener('load', () => resolve(), { once: true });
                img.addEventListener('error', () => resolve(), { once: true });
              })
        )
      );
      // Without this the first paint can use a fallback face, shifting metrics.
      await document.fonts.ready;
    });

    // preferCSSPageSize lets the injected @page rule drive the sheet size, so a
    // label comes out at its exact millimetre trim instead of on a Letter page.
    const pdf = await page.pdf({
      ...(pageSize ? {} : { format: 'Letter' as const }),
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    });

    return new NextResponse(Buffer.from(pdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'PDF generation failed';
    console.error('[spec-sheet-pdf]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    await browser.close().catch(() => undefined);
  }
}
