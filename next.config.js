/** @type {import('next').NextConfig} */
const nextConfig = {
  // `next dev` and `next build` both own `.next`, so a build run to check that a
  // change compiles will overwrite the chunks the running dev server is serving and
  // leave it throwing MODULE_NOT_FOUND on every request. Set NEXT_DIST_DIR to build
  // somewhere else and leave the dev server alone. Unset in deploys, so Vercel and
  // `npm run build` keep using `.next`.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  images: {
    // Vercel Image Optimization returns 402 (OPTIMIZED_IMAGE_REQUEST_PAYMENT_REQUIRED)
    // on this plan — serve Supabase public URLs directly so category/product
    // heroes actually render. Bucket itself is fine (public site-images 200).
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/**',
      },
      {
        protocol: 'https',
        hostname: 'vspbmzksafpaysqrtgxg.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
    // Keep Chromium binaries out of the webpack bundle (API route loads them at runtime).
    serverComponentsExternalPackages: ['@sparticuz/chromium', 'puppeteer-core'],
  },
}

module.exports = nextConfig

