'use client';

import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { buildSku, type SkuState } from '@/lib/sku/skuRules';
import type { SpecSheetData } from '@/lib/sku/specSheet';

export interface LinkFlags {
  name: boolean;
  code: boolean;
  codeDescription: boolean;
  description: boolean;
}

export interface SpecSheetSync {
  link: LinkFlags;
  setLinkedField: (key: keyof LinkFlags, value: string) => void;
  setSku: (sku: SkuState) => void;
  relinkAll: () => void;
}

const derive3 = (name: string) => name.replace(/[^A-Za-z0-9]/g, '').slice(0, 3).toUpperCase();

/**
 * Owns the SKU ↔ identity auto-sync for a spec sheet. Instantiate ONCE in the
 * parent that owns `data` and share the returned handlers with both the Builder
 * (SKU inputs / Re-apply) and the Product tab (Name / Code / descriptions).
 * Instantiating it more than once against the same data would run duplicate
 * effects that clobber each other.
 */
export function useSpecSheetSync(
  data: SpecSheetData,
  onChange: Dispatch<SetStateAction<SpecSheetData>>,
): SpecSheetSync {
  const [link, setLink] = useState<LinkFlags>({ name: true, code: true, codeDescription: true, description: true });
  const [seriesLinked, setSeriesLinked] = useState(true);

  // Auto-derive the 3-letter SKU series from the product/family name (while linked).
  useEffect(() => {
    if (!seriesLinked) return;
    onChange((prev) => {
      const derived = derive3(prev.productName);
      return prev.sku.series === derived ? prev : { ...prev, sku: { ...prev.sku, series: derived } };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.productName, seriesLinked]);

  // Auto-fill derived fields (Name, code, descriptions) from the SKU while linked.
  useEffect(() => {
    onChange((prev) => {
      const r = buildSku(prev.sku);
      const nextName = [prev.productName.trim(), r.shortBody].filter(Boolean).join(' ');
      const want = {
        name: link.name ? nextName : prev.name,
        code: link.code ? r.shortCode : prev.code,
        codeDescription: link.codeDescription ? r.shortDesc : prev.codeDescription,
        description: link.description ? r.longDesc : prev.description,
      };
      if (
        want.name === prev.name &&
        want.code === prev.code &&
        want.codeDescription === prev.codeDescription &&
        want.description === prev.description
      ) {
        return prev;
      }
      return { ...prev, ...want };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.sku, data.productName, link]);

  const setLinkedField = (key: keyof LinkFlags, value: string) => {
    if (link[key]) setLink((prev) => ({ ...prev, [key]: false }));
    onChange((prev) => ({ ...prev, [key]: value }));
  };

  const setSku = (sku: SkuState) => {
    if (sku.series !== data.sku.series && sku.series !== derive3(data.productName)) setSeriesLinked(false);
    onChange((prev) => ({ ...prev, sku }));
  };

  const relinkAll = () => {
    setSeriesLinked(true);
    setLink({ name: true, code: true, codeDescription: true, description: true });
    onChange((prev) => {
      const derived = derive3(prev.productName);
      const nextSku = { ...prev.sku, series: derived };
      const r = buildSku(nextSku);
      return {
        ...prev,
        sku: nextSku,
        name: [prev.productName.trim(), r.shortBody].filter(Boolean).join(' '),
        code: r.shortCode,
        codeDescription: r.shortDesc,
        description: r.longDesc,
      };
    });
  };

  return { link, setLinkedField, setSku, relinkAll };
}
