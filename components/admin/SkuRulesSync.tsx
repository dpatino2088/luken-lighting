'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw } from 'lucide-react';
import {
  ensureSkuRebuild,
  listVariantsMissingDatasheet,
} from '@/app/(admin)/admin/variants/actions';
import { useDatasheetBatch } from './useDatasheetBatch';
import { toast } from '@/components/ui/Toast';

/**
 * Keeps stored identity in step with the naming rules, without being asked.
 *
 * A variant row stores what the rules generated — code, name, both descriptions —
 * so a rule change leaves every row behind until someone opens the variant and
 * saves it. That is how the Variants list and the Product tab came to disagree.
 * Each row carries the rules build that wrote it; this runs one pass whenever the
 * catalog is behind, then exports the affected sheets so the PDFs carry the new
 * code too.
 *
 * It costs one count when there is nothing to do.
 */
export function SkuRulesSync() {
  const router = useRouter();
  const [working, setWorking] = useState(false);
  const started = useRef(false);

  const sheets = useDatasheetBatch(({ done, total, failures }) => {
    setWorking(false);
    if (failures.length > 0) {
      toast.error(`${done}/${total} PDFs regenerated. Failed: ${failures.join(' · ')}`);
    }
    router.refresh();
  });

  useEffect(() => {
    // Once per mount: the pass is idempotent, but re-running it on every render
    // would be a write loop.
    if (started.current) return;
    started.current = true;

    (async () => {
      const result = await ensureSkuRebuild();
      if ('error' in result) return; // A viewer without write access, or no session.
      if (result.stale === 0) return;

      setWorking(true);
      if (result.updated > 0) {
        toast.success(
          `${result.updated} variant${result.updated === 1 ? '' : 's'} brought up to the current naming rules.`
        );
      }
      if (result.skipped > 0) {
        toast.error(
          `${result.skipped} variant${result.skipped === 1 ? '' : 's'} could not be rebuilt — two would share the same Long SKU. Open Rebuild SKUs to see which.`
        );
      }
      router.refresh();

      if (result.variantIds.length === 0) {
        setWorking(false);
        return;
      }
      const plan = await listVariantsMissingDatasheet(result.variantIds);
      if ('error' in plan || plan.jobs.length === 0) {
        setWorking(false);
        return;
      }
      sheets.start(plan);
    })();
    // The batch helper is stable for the life of the component.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!working) return null;

  return (
    <>
      <span className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-gray-500">
        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
        {sheets.running ? `Updating PDFs ${sheets.position}/${sheets.total}` : 'Updating catalog'}
      </span>
      {sheets.stage}
    </>
  );
}
