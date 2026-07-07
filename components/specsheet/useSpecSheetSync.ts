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

// Series = first 3 letters of EACH word in the family name (joined by "-"),
// plus any trailing number. e.g.
//   "Alhena 15"   → "ALH15"
//   "Santorini"   → "SAN"
//   "Draco Point" → "DRA-POI"
//   "Orion 65"    → "ORI65"
const derive3 = (name: string) => {
  const cleaned = name.trim();
  if (!cleaned) return '';
  const trailingNum = cleaned.match(/(\d+)\s*$/)?.[1] ?? '';
  const words = cleaned
    .split(/\s+/)
    .map((w) => w.replace(/[^A-Za-z]/g, ''))
    .filter(Boolean)
    .map((w) => w.slice(0, 3).toUpperCase());
  return words.join('-') + trailingNum;
};

// The auto description = SKU long description + the structured product
// attributes owned by the Builder (mounting type, material, IP rating,
// electrical class) so the description reflects the full product, not just
// the SKU segments.
const composeDescription = (longDesc: string, d: SpecSheetData): string => {
  const extras = [d.montaje, d.material, d.ipRating, d.electricalClass]
    .map((s) => (s || '').trim())
    .filter(Boolean);
  return [longDesc, ...extras].filter(Boolean).join(' / ');
};

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
      const nextName = [prev.productName.trim(), r.nameBody].filter(Boolean).join(' ');
      const want = {
        name: link.name ? nextName : prev.name,
        code: link.code ? r.shortCode : prev.code,
        codeDescription: link.codeDescription ? r.shortDesc : prev.codeDescription,
        description: link.description ? composeDescription(r.longDesc, prev) : prev.description,
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
  }, [data.sku, data.productName, data.montaje, data.material, data.ipRating, data.electricalClass, link]);

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
        name: [prev.productName.trim(), r.nameBody].filter(Boolean).join(' '),
        code: r.shortCode,
        codeDescription: r.shortDesc,
        description: composeDescription(r.longDesc, prev),
      };
    });
  };

  return { link, setLinkedField, setSku, relinkAll };
}
