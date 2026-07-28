import { NextResponse } from 'next/server';
import { getCurrentUser, getCurrentUserRole } from '@/lib/auth';
import { launchPdfBrowser } from '@/lib/specsheet/launchBrowser';
import { PDF_DOCUMENT_CSS } from '@/lib/specsheet/pdfDocumentCss';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type Body = {
  html?: string;
  css?: string;
  styleHrefs?: string[];
  htmlClass?: string;
  bodyClass?: string;
};

function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

/**
 * Rebuild the Preview's document: same <html>/<body> classes (Inter lives on a
 * class), same stylesheets, then PDF_DOCUMENT_CSS last so its page setup wins.
 */
function buildDocument(body: {
  html: string;
  css: string;
  styleHrefs: string[];
  htmlClass: string;
  bodyClass: string;
  baseHref: string;
}): string {
  const links = body.styleHrefs
    .map((href) => `<link rel="stylesheet" href="${escapeAttr(href)}" />`)
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en" class="${escapeAttr(body.htmlClass)}">
<head>
<meta charset="utf-8" />
<base href="${escapeAttr(body.baseHref)}" />
<title>Spec Sheet</title>
${links}
${body.css ? `<style>\n${body.css}\n</style>` : ''}
<style>
${PDF_DOCUMENT_CSS}
</style>
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

  const documentHtml = buildDocument({
    html,
    css,
    styleHrefs: Array.isArray(body.styleHrefs)
      ? body.styleHrefs.filter((h): h is string => typeof h === 'string').slice(0, 50)
      : [],
    htmlClass: typeof body.htmlClass === 'string' ? body.htmlClass : '',
    bodyClass: typeof body.bodyClass === 'string' ? body.bodyClass : '',
    baseHref: new URL(request.url).origin,
  });

  const browser = await launchPdfBrowser();
  try {
    const page = await browser.newPage();
    // Print media so the sheet's own @media print rules apply — per-page top and
    // bottom insets come from the repeating thead/tfoot spacers, exactly as in
    // Chrome's "Save as PDF".
    await page.emulateMediaType('print');
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

    const pdf = await page.pdf({
      format: 'Letter',
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
