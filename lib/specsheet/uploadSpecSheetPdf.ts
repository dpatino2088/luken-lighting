'use client';

import { replaceVariantDatasheetPdf } from '@/app/(admin)/admin/variants/actions';
import { exportSpecSheetPdfBlob, specSheetPdfFileName } from '@/lib/specsheet/exportSpecSheetPdf';
import type { ProductAsset } from '@/lib/types';

/**
 * Live Preview → Chromium print PDF → server replaces documents bucket + asset row.
 */
export async function uploadSpecSheetPdfFromPreview(
  variantId: string,
  code: string
): Promise<{ error?: string; url?: string; asset?: ProductAsset }> {
  const blob = await exportSpecSheetPdfBlob();
  if (!blob || blob.size < 100) {
    return { error: 'Generated PDF was empty' };
  }

  const fileName = specSheetPdfFileName(code);
  const formData = new FormData();
  formData.append('file', blob, fileName);

  const result = await replaceVariantDatasheetPdf(variantId, code, formData);
  if (result.error) return { error: result.error };
  return {
    url: result.url,
    asset: result.asset as ProductAsset | undefined,
  };
}
