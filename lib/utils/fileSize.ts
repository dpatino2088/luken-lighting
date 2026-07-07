/**
 * Shared file-size guardrails for client-side uploads.
 *
 * Camera/drone photos can easily exceed 20MB. We compress images in the
 * browser before upload (see compressImage), but we still reject absurdly
 * large originals up front to avoid a long, doomed upload and to give the
 * user immediate feedback.
 */

/** Max accepted size for an image the user picks (before compression). */
export const MAX_IMAGE_UPLOAD_BYTES = 15 * 1024 * 1024; // 15MB

/** Human-friendly MB string, e.g. "18.4MB". */
export function formatMB(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

/**
 * Returns an error message if the image is too large, otherwise null.
 * Callers surface the message via toast.error.
 */
export function checkImageSize(file: File, max = MAX_IMAGE_UPLOAD_BYTES): string | null {
  if (file.size > max) {
    return `Image is too large (${formatMB(file.size)}). Maximum is ${formatMB(max)}. Please resize it and try again.`;
  }
  return null;
}
