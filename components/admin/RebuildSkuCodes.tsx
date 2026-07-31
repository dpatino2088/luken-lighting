'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Check, Loader2, RefreshCw, Wand2, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import {
  applySkuRebuild,
  listVariantsMissingDatasheet,
  planSkuRebuild,
} from '@/app/(admin)/admin/variants/actions';
import { changedFields, type SkuRebuildPlan } from '@/lib/sku/skuRebuild';
import { useDatasheetBatch } from './useDatasheetBatch';
import { toast } from '@/components/ui/Toast';

const FIELD_LABEL: Record<string, string> = {
  code: 'Long SKU',
  name: 'Name',
  shortDescription: 'Short description',
  longDescription: 'Technical description',
};

/**
 * Brings stored codes, names and descriptions back in line with the naming rules.
 *
 * Identity is generated from the spec sheet but stored on the variant, so a change
 * to the rules only reaches a variant when it is saved. This does that saving for
 * all of them — after showing what it would write, because a Long SKU is printed
 * on labels and quoted to customers.
 */
export function RebuildSkuCodes() {
  const router = useRouter();
  const [scanning, setScanning] = useState(false);
  const [applying, setApplying] = useState(false);
  const [plan, setPlan] = useState<SkuRebuildPlan | null>(null);

  // A stored PDF still shows the previous code, so every rebuilt sheet is exported
  // again right after the write.
  const sheets = useDatasheetBatch(({ done, total, failures }) => {
    if (failures.length > 0) {
      toast.error(`${done}/${total} PDFs regenerated. Failed: ${failures.join(' · ')}`);
    } else {
      toast.success(`${done} Spec Sheet PDF${done === 1 ? '' : 's'} regenerated.`);
    }
    router.refresh();
  });

  async function scan() {
    setScanning(true);
    const result = await planSkuRebuild();
    setScanning(false);

    if ('error' in result) {
      toast.error(result.error);
      return;
    }
    if (result.rows.length === 0) {
      toast.success(`All ${result.scanned} variants already match the naming rules.`);
      return;
    }
    setPlan(result);
  }

  async function apply() {
    setApplying(true);
    const result = await applySkuRebuild();
    setApplying(false);

    if ('error' in result) {
      toast.error(result.error);
      return;
    }
    if (result.failures.length > 0) {
      toast.error(`${result.updated} rebuilt. Failed: ${result.failures.join(' · ')}`);
    } else {
      toast.success(`${result.updated} variant${result.updated === 1 ? '' : 's'} rebuilt.`);
    }
    setPlan(null);
    router.refresh();

    if (result.variantIds.length === 0) return;
    const sheetPlan = await listVariantsMissingDatasheet(result.variantIds);
    if ('error' in sheetPlan) {
      toast.error(`Codes rebuilt, but the PDFs could not be listed: ${sheetPlan.error}`);
      return;
    }
    if (sheetPlan.jobs.length > 0) sheets.start(sheetPlan);
  }

  const ready = plan ? plan.rows.filter((r) => !r.blocked) : [];
  const blocked = plan ? plan.rows.filter((r) => r.blocked) : [];

  return (
    <>
      <Button
        variant="outline"
        onClick={scan}
        disabled={scanning || applying || sheets.running}
      >
        {scanning || sheets.running ? (
          <>
            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
            {sheets.running ? `PDF ${sheets.position}/${sheets.total}…` : 'Checking…'}
          </>
        ) : (
          <>
            <Wand2 className="mr-2 h-4 w-4" />
            Rebuild SKUs
          </>
        )}
      </Button>

      {sheets.stage}

      {plan && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => !applying && setPlan(null)}
        >
          <div
            className="flex max-h-[90vh] w-full max-w-4xl flex-col bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="rebuild-sku-title"
          >
            <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-6 py-4">
              <div>
                <h2 id="rebuild-sku-title" className="text-lg font-medium uppercase tracking-wide">
                  Rebuild SKUs
                </h2>
                <p className="mt-1 text-[13px] text-gray-600">
                  {ready.length} of {plan.scanned} variants no longer match the naming rules. URLs
                  are not affected — a slug is frozen when the variant is created.
                </p>
              </div>
              <button
                type="button"
                onClick={() => !applying && setPlan(null)}
                className="p-1 transition-colors hover:bg-gray-100"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4">
              <div className="divide-y divide-gray-100 border border-gray-200">
                {plan.rows.map((row) => (
                  <div key={row.variantId} className="p-4">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="text-xs uppercase tracking-widest text-gray-400">
                        {row.family || 'No family'}
                      </p>
                      <p className="text-[11px] text-gray-400">
                        {changedFields(row).map((f) => FIELD_LABEL[f]).join(' · ')}
                      </p>
                    </div>
                    <p className="mt-2 break-all font-mono text-xs text-gray-400 line-through">
                      {row.stored.code || '—'}
                    </p>
                    <p className="break-all font-mono text-xs text-gray-900">{row.rebuilt.code}</p>
                    {row.stored.name !== row.rebuilt.name && (
                      <p className="mt-1.5 text-[11px] text-gray-500">
                        {row.stored.name || '—'} → <span className="text-gray-800">{row.rebuilt.name}</span>
                      </p>
                    )}
                    {row.blocked && (
                      <p className="mt-2 flex items-start gap-1.5 text-[11px] text-amber-700">
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                        {row.blocked}
                      </p>
                    )}
                  </div>
                ))}
              </div>

              {plan.withoutSheet.length > 0 && (
                <p className="mt-3 text-[11px] text-gray-500">
                  Left alone ({plan.withoutSheet.length}): {plan.withoutSheet.join(', ')}. Their
                  identity was typed or imported rather than built, so there is no SKU to rebuild it
                  from.
                </p>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-gray-200 px-6 py-4">
              <p className="text-[11px] text-gray-500">
                {blocked.length > 0
                  ? `${blocked.length} skipped — see the warnings above. Their spec sheet PDFs are exported again afterwards.`
                  : 'The spec sheet PDFs are exported again afterwards, so they carry the new code.'}
              </p>
              <div className="flex items-center gap-2">
                <Button variant="secondary" size="sm" onClick={() => setPlan(null)} disabled={applying}>
                  Cancel
                </Button>
                <Button size="sm" onClick={apply} disabled={applying || ready.length === 0}>
                  {applying ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Rebuilding…
                    </>
                  ) : (
                    <>
                      <Check className="mr-2 h-4 w-4" />
                      Rebuild {ready.length}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
