import puppeteer, { type Browser } from 'puppeteer-core';

function localChromePath(): string | null {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  if (process.env.PUPPETEER_EXECUTABLE_PATH) return process.env.PUPPETEER_EXECUTABLE_PATH;
  if (process.platform === 'darwin') {
    return '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  }
  if (process.platform === 'win32') {
    return 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  }
  return '/usr/bin/google-chrome';
}

function isServerlessRuntime(): boolean {
  return Boolean(
    process.env.VERCEL ||
      process.env.AWS_LAMBDA_FUNCTION_NAME ||
      process.env.USE_CHROMIUM_BINARY === '1'
  );
}

/** Launch headless Chromium — same print engine as Chrome "Save as PDF". */
export async function launchPdfBrowser(): Promise<Browser> {
  if (isServerlessRuntime()) {
    const chromium = (await import('@sparticuz/chromium')).default;
    // WebGL/swiftshader extraction is slow and unnecessary for print→PDF.
    chromium.setGraphicsMode = false;

    const executablePath = await chromium.executablePath();
    if (!executablePath) {
      throw new Error('Chromium binary missing on serverless runtime.');
    }

    const args = await puppeteer.defaultArgs({
      args: chromium.args,
      headless: 'shell',
    });

    return puppeteer.launch({
      args,
      defaultViewport: { width: 816, height: 1056, deviceScaleFactor: 1 },
      executablePath,
      headless: 'shell',
      ignoreHTTPSErrors: true,
    });
  }

  const executablePath = localChromePath();
  if (!executablePath) {
    throw new Error('No Chrome executable found. Set CHROME_PATH.');
  }

  return puppeteer.launch({
    executablePath,
    headless: true,
    defaultViewport: { width: 816, height: 1056, deviceScaleFactor: 1 },
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--font-render-hinting=none'],
    ignoreHTTPSErrors: true,
  });
}
