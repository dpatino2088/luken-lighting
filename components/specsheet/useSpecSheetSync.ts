'use client';

import { useEffect, type Dispatch, type SetStateAction } from 'react';
import type { SkuState } from '@/lib/sku/skuRules';
import {
  deriveIdentity,
  deriveSeries,
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
 * sheet — a hand override survives a reload instead of being clobbered by the
 * auto-sync on mount. Instantiate ONCE in the parent that owns `data` and share
 * the returned handlers with both the Builder (SKU inputs / Re-apply) and the
 * Product tab (Name / Code / descriptions). Instantiating it more than once
 * against the same data would run duplicate effects that clobber each other.
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

  // Auto-fill derived fields (Name, code, descriptions) from the SKU while their
  // link flag is on. Fields switched to manual (flag off) are left untouched.
  useEffect(() => {
    onChange((prev) => {
      const derived = deriveIdentity(prev);
      const l = prev.link;
      const want = {
        name: l.name ? derived.name : prev.name,
        code: l.code ? derived.code : prev.code,
        codeDescription: l.codeDescription ? derived.codeDescription : prev.codeDescription,
        description: l.description ? derived.description : prev.description,
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
  }, [data.sku, data.productName, data.material, data.ipRating, data.electricalClass, data.ancho, data.alto, data.fondo, data.datosTecnicos, link]);

  // Editing a field by hand switches it to manual (stops the sync) and stores
  // the value — both persisted inside `data`.
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
      return { ...prev, sku, seriesLinked };
    });
  };

  const relinkAll = () => {
    onChange((prev) => {
      const nextSku = { ...prev.sku, series: deriveSeries(prev.productName) };
      const withLinks: SpecSheetData = {
        ...prev,
        sku: nextSku,
        seriesLinked: true,
        link: { name: true, code: true, codeDescription: true, description: true },
      };
      const derived = deriveIdentity(withLinks);
      return {
        ...withLinks,
        name: derived.name,
        code: derived.code,
        codeDescription: derived.codeDescription,
        description: derived.description,
      };
    });
  };

  return { link, setLinkedField, setSku, relinkAll };
}
