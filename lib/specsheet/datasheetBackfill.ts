import type { SpecSheetData } from '@/lib/sku/specSheet';
import type { ProductAsset } from '@/lib/types';

/**
 * One variant to render offscreen and export. Carries everything SheetPreview
 * needs, so the batch reproduces the exact sheet the editor would have produced.
 */
export type DatasheetJob = {
  variantId: string;
  code: string;
  data: SpecSheetData;
  assets: ProductAsset[];
  familyOverview: string | null;
};

export type DatasheetBackfillPlan = {
  jobs: DatasheetJob[];
  brandLogoUrl: string | null;
};
