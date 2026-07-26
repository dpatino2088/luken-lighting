'use client';

import { useEffect, type Dispatch, type SetStateAction } from 'react';
import type { SkuState } from '@/lib/sku/skuRules';
import {
  deriveSeries,
  syncIdentityFromSku,
  type LinkFlags,
  type SpecSheetData,
} from '@/lib/sku/specSheet';

export type { LinkFlags };

export interface SpecSheetSync {
  link: LinkFlags;
  setLinkedField: (key: keyof LinkFlags, value: string) => void;
  setSku: (sku: SkuState) => void;
  relinkAll: () => void;
}

/**
 * Owns the SKU ↔ identity auto-sync for a spec sheet. The auto/manual state
 * (`link` + `seriesLinked`) lives INSIDE `data` so it is persisted with the
 * sheet. Instantiating ONCE in the parent that owns `data` and share the
 * returned handlers with both the Builder and the Product tab.
 *
 * Builder SKU changes always re-sync Name / Code / descriptions (Builder is
 * source of truth). Hand edits in the Product tab last only until the next
 * SKU-driven change (or Re-apply).
 */
export function useSpecSheetSync(
  data: SpecSheetData,
  onChange: Dispatch<SetStateAction<SpecSheetData>>,
): SpecSheetSync {
  const link = data.link;

  // Auto-derive the 3-letter SKU series from the product/family name (while linked).
  useEffect(() => {
    onChange((prev) => {
      if (!prev.seriesLinked) return prev;
      const derived = deriveSeries(prev.productName);
      return prev.sku.series === derived ? prev : { ...prev, sku: { ...prev.sku, series: derived } };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.productName, data.seriesLinked]);

  // Keep identity locked to the current Builder SKU (+ description inputs).
  // Any SKU / productName / material / lumen change re-applies Name/Code/descriptions
  // so the title, Product tab, Preview and Save never keep a stale previous code.
  useEffect(() => {
    onChange((prev) => syncIdentityFromSku(prev));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    data.sku,
    data.productName,
    data.material,
    data.ipRating,
    data.electricalClass,
    data.ancho,
    data.alto,
    data.fondo,
    data.datosTecnicos,
  ]);

  // Editing a field by hand switches it to manual (stops the sync) and stores
  // the value — until the next Builder SKU change re-syncs via the effect above.
  const setLinkedField = (key: keyof LinkFlags, value: string) => {
    onChange((prev) => ({
      ...prev,
      [key]: value,
      link: prev.link[key] ? { ...prev.link, [key]: false } : prev.link,
    }));
  };

  const setSku = (sku: SkuState) => {
    onChange((prev) => {
      // Typing a series that isn't the auto-derived one unlinks the series.
      const seriesLinked =
        prev.seriesLinked &&
        (sku.series === prev.sku.series || sku.series === deriveSeries(prev.productName));
      // Apply identity immediately (don't wait for the effect) so title/preview
      // update in the same render cycle as the SKU black box.
      return syncIdentityFromSku({ ...prev, sku, seriesLinked });
    });
  };

  const relinkAll = () => {
    onChange((prev) => {
      const nextSku = { ...prev.sku, series: deriveSeries(prev.productName) };
      return syncIdentityFromSku({
        ...prev,
        sku: nextSku,
        seriesLinked: true,
      });
    });
  };

  return { link, setLinkedField, setSku, relinkAll };
}
