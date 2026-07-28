/** @type {import('next').NextConfig} */
const nextConfig = {
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

