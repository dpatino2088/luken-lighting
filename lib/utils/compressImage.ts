/**
 * Client-side image resize/compression.
 *
 * All image uploads in the admin go straight from the browser to Supabase
 * Storage, so the file that gets stored (and later served to visitors) is
 * whatever the user picked — often an untouched 4000px camera photo or
 * export. This resizes to a sane max dimension and re-encodes to WebP
 * before upload, which is where the real savings come from (usually a
 * 70-95% size reduction vs. the original).
 *
 * Falls back to the original file whenever compression can't help
 * (non-raster files, SVGs, unsupported browser APIs, or cases where the
 * re-encoded result isn't actually smaller).
 */

export interface CompressImageOptions {
  /** Max width or height in px; the image is scaled down to fit, never up. */
  maxDimension?: number;
  /** WebP/JPEG quality, 0-1. */
  quality?: number;
  /** Output mime type. Defaults to image/webp (best size/quality tradeoff, wide support). */
  mimeType?: 'image/webp' | 'image/jpeg' | 'image/png';
}

const DEFAULTS: Required<CompressImageOptions> = {
  maxDimension: 2000,
  quality: 0.82,
  mimeType: 'image/webp',
};

const EXT_BY_MIME: Record<string, string> = {
  'image/webp': 'webp',
  'image/jpeg': 'jpg',
  'image/png': 'png',
};

export async function compressImage(
  file: File,
  options: CompressImageOptions = {}
): Promise<File> {
  const opts = { ...DEFAULTS, ...options };

  // Don't touch non-images, SVGs (vector, re-encoding would rasterize them),
  // or GIFs (canvas would flatten animation to a single frame).
  if (!file.type.startsWith('image/') || file.type === 'image/svg+xml' || file.type === 'image/gif') {
    return file;
  }

  if (typeof document === 'undefined' || typeof createImageBitmap === 'undefined') {
    return file;
  }

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, opts.maxDimension / Math.max(bitmap.width, bitmap.height));
    const targetWidth = Math.max(1, Math.round(bitmap.width * scale));
    const targetHeight = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      bitmap.close?.();
      return file;
    }

    ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight);
    bitmap.close?.();

    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob(resolve, opts.mimeType, opts.quality)
    );
    if (!blob || blob.size >= file.size) {
      // Compression didn't help (already small/optimized) — keep the original.
      return file;
    }

    const ext = EXT_BY_MIME[opts.mimeType] || 'webp';
    const baseName = file.name.replace(/\.[^./\\]+$/, '');
    return new File([blob], `${baseName}.${ext}`, { type: opts.mimeType });
  } catch {
    // Any failure (decode error, unsupported format, etc.) — upload the original.
    return file;
  }
}
