'use client';

import { saveVariantAsset } from '@/app/(admin)/admin/variants/actions';
import { createClient } from '@/lib/supabase/client';
import { exportSpecSheetPdfBlob, specSheetPdfFileName } from '@/lib/specsheet/exportSpecSheetPdf';
import type { ProductAsset } from '@/lib/types';

/**
 * Live Preview → PDF blob → client storage upload → server asset row.
 *
 * We intentionally do NOT send the PDF through a Server Action as FormData:
 * large Chromium PDFs often exceed the action body path and the client then
 * sees `undefined` (toast: "Cannot read properties of undefined (reading 'error')").
 * Manual File & Assets uploads already use this client→storage pattern.
 */
export async function uploadSpecSheetPdfFromPreview(
  variantId: string,
  code: string
): Promise<{ error?: string; url?: string; asset?: ProductAsset }> {
  let blob: Blob;
  try {
    blob = await exportSpecSheetPdfBlob();
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : 'PDF generation failed',
    };
  }

  if (!blob || blob.size < 100) {
    return { error: 'Generated PDF was empty' };
  }

  const supabase = createClient();
  if (!supabase) return { error: 'Supabase not configured' };

  const stamp = Date.now();
  const fileName = 'datasheet.pdf';
  const filePath = `${variantId}/${fileName}`;
  const file = new File([blob], specSheetPdfFileName(code), { type: 'application/pdf' });

  const { error: uploadError } = await supabase.storage.from('documents').upload(filePath, file, {
    upsert: true,
    contentType: 'application/pdf',
    cacheControl: '0',
  });
  if (uploadError) {
    return { error: `Storage upload failed: ${uploadError.message}` };
  }

  // Drop legacy timestamped datasheets left by earlier versions.
  const { data: listed } = await supabase.storage.from('documents').list(variantId, { limit: 100 });
  const stalePaths = (listed || [])
    .filter((obj) => obj.name.startsWith('datasheet') && obj.name !== fileName)
    .map((obj) => `${variantId}/${obj.name}`);
  if (stalePaths.length > 0) {
    await supabase.storage.from('documents').remove(stalePaths);
  }

  const { data: urlData } = supabase.storage.from('documents').getPublicUrl(filePath);
  const publicUrl = `${urlData.publicUrl}?v=${stamp}`;
  const safeCode = (code || 'spec-sheet').replace(/[^A-Za-z0-9._-]+/g, '-');
  const title = `Spec Sheet / Datasheet (PDF) - ${safeCode}-spec-sheet.pdf`;

  let result: Awaited<ReturnType<typeof saveVariantAsset>> | undefined;
  try {
    result = await saveVariantAsset(variantId, 'datasheet', title, publicUrl, 'pdf');
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : 'Could not save datasheet asset',
    };
  }

  if (!result) {
    return { error: 'Could not save datasheet asset (no response from server)' };
  }
  if (result.error) return { error: result.error };

  return {
    url: publicUrl,
    asset: result.asset as ProductAsset | undefined,
  };
}
