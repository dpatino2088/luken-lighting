'use client';

import { useMemo } from 'react';
import { buildSku } from '@/lib/sku/skuRules';
import type { SpecSheetData } from '@/lib/sku/specSheet';
import type { SpecSheetSync } from '@/components/specsheet/useSpecSheetSync';

const fieldClass =
  'w-full px-3 py-2 border border-gray-300 rounded-none bg-white text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent';
const labelClass = 'block text-xs font-medium uppercase tracking-wide text-gray-500 mb-1';

/**
 * The built identity of the product: Name / Code / descriptions. These are
 * generated in the Builder (SKU) and shown here in the Product tab, where they
 * can be reviewed and overridden by hand (which stops the auto-sync until
 * "Re-apply from SKU" is pressed).
 */
export function IdentityFields({ data, sync }: { data: SpecSheetData; sync: SpecSheetSync }) {
  const { link, setLinkedField, relinkAll } = sync;
  const skuPreview = useMemo(() => buildSku(data.sku), [data.sku]);
  const anyManual = !link.name || !link.code || !link.codeDescription || !link.description;

  return (
    <div className="bg-white border border-gray-200 p-6 space-y-5">
      <div className="flex items-start justify-between gap-3 border-b border-gray-200 pb-3">
        <div>
          <h2 className="text-lg font-medium uppercase tracking-wide">Identity</h2>
          <p className="mt-0.5 text-[11px] text-gray-500">
            Generated in the Builder. Editing a field by hand switches it to manual and stops the sync. SKU:{' '}
            <span className="font-mono">{skuPreview.shortCode || '—'}</span>
          </p>
        </div>
        <button
          type="button"
          onClick={relinkAll}
          disabled={!anyManual}
          className="shrink-0 border border-gray-300 px-2.5 py-1 text-[11px] font-medium text-gray-600 hover:border-gray-400 disabled:opacity-40 disabled:hover:border-gray-300"
        >
          Re-apply from SKU
        </button>
      </div>

      <div className="space-y-3">
        <div>
          <label className={labelClass}>Name {link.name ? '(auto)' : '(manual)'}</label>
          <input className={fieldClass} value={data.name} onChange={(e) => setLinkedField('name', e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>Code / SKU {link.code ? '(auto)' : '(manual)'}</label>
          <input className={fieldClass + ' font-mono'} value={data.code} onChange={(e) => setLinkedField('code', e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>Short description {link.codeDescription ? '(auto)' : '(manual)'}</label>
          <input className={fieldClass} value={data.codeDescription} onChange={(e) => setLinkedField('codeDescription', e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>Technical description {link.description ? '(auto)' : '(manual)'}</label>
          <textarea rows={4} className={fieldClass} value={data.description} onChange={(e) => setLinkedField('description', e.target.value)} />
        </div>
      </div>
    </div>
  );
}
