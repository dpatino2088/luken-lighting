'use client';

import { createClient } from '@/lib/supabase/client';
import { saveVariantAsset } from '@/app/(admin)/admin/variants/actions';
import { exportSpecSheetPdfBlob, specSheetPdfFileName } from '@/lib/specsheet/exportSpecSheetPdf';

/**
 * Render the live Preview → PDF → upload to documents bucket as type `datasheet`
 * (replaces the previous auto/manual datasheet for this variant).
 */
export async function uploadSpecSheetPdfFromPreview(
  variantId: string,
  code: string
): Promise<{ error?: string; url?: string }> {
  const supabase = createClient();
  if (!supabase) return { error: 'Supabase not configured' };

  const blob = await exportSpecSheetPdfBlob();
  const fileName = specSheetPdfFileName(code);
  const filePath = `${variantId}/datasheet-${Date.now()}.pdf`;

  const { error: uploadError } = await supabase.storage
    .from('documents')
    .upload(filePath, blob, {
      upsert: true,
      contentType: 'application/pdf',
      cacheControl: '31536000',
    });

  if (uploadError) return { error: uploadError.message };

  const { data: urlData } = supabase.storage.from('documents').getPublicUrl(filePath);
  const title = `Spec Sheet / Datasheet (PDF) - ${fileName}`;
  const result = await saveVariantAsset(variantId, 'datasheet', title, urlData.publicUrl, 'pdf');
  if (result.error) return { error: result.error };
  return { url: urlData.publicUrl };
}
