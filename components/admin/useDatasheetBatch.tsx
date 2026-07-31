'use client';

import { useEffect, useRef, useState } from 'react';
import { SheetPreview } from '@/components/specsheet/SheetPreview';
import { uploadSpecSheetPdfFromPreview } from '@/lib/specsheet/uploadSpecSheetPdf';
import { SHEET_WIDTH_PX } from '@/lib/specsheet/sheetGeometry';
import type { DatasheetBackfillPlan, DatasheetJob } from '@/lib/specsheet/datasheetBackfill';

export interface DatasheetBatchSummary {
  done: number;
  total: number;
  failures: string[];
}

/**
 * Exports a datasheet PDF for a list of variants, one at a time.
 *
 * The export reads the live Preview DOM, so each sheet is mounted offscreen and
 * exported through the same pipeline the editor uses — a batch cannot drift from
 * a hand-made Save. Mount `stage` somewhere in the tree for that to work.
 */
export function useDatasheetBatch(onFinish: (summary: DatasheetBatchSummary) => void) {
  const [jobs, setJobs] = useState<DatasheetJob[] | null>(null);
  const [brandLogoUrl, setBrandLogoUrl] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const failures = useRef<string[]>([]);
  const finish = useRef(onFinish);
  finish.current = onFinish;

  function start(plan: DatasheetBackfillPlan) {
    failures.current = [];
    setBrandLogoUrl(plan.brandLogoUrl);
    setIndex(0);
    setJobs(plan.jobs);
  }

  // One job per commit: the sheet for `index` is already painted when this runs.
  useEffect(() => {
    if (!jobs || index >= jobs.length) return;
    let cancelled = false;

    (async () => {
      // Give the offscreen sheet a frame to lay out before serializing it.
      await new Promise((resolve) => setTimeout(resolve, 250));
      if (cancelled) return;

      const job = jobs[index];
      try {
        const result = await uploadSpecSheetPdfFromPreview(job.variantId, job.code);
        if (result.error) failures.current.push(`${job.code || job.variantId}: ${result.error}`);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'unknown error';
        failures.current.push(`${job.code || job.variantId}: ${message}`);
      }
      if (!cancelled) setIndex((i) => i + 1);
    })();

    return () => {
      cancelled = true;
    };
  }, [jobs, index]);

  useEffect(() => {
    if (!jobs || index < jobs.length) return;
    const failed = failures.current.slice();
    const total = jobs.length;
    setJobs(null);
    setIndex(0);
    finish.current({ done: total - failed.length, total, failures: failed });
  }, [jobs, index]);

  const running = jobs !== null;
  const current = running && index < jobs.length ? jobs[index] : null;

  return {
    start,
    running,
    /** 1-based position of the sheet being exported. */
    position: jobs ? Math.min(index + 1, jobs.length) : 0,
    total: jobs?.length ?? 0,
    stage: current ? (
      <div
        aria-hidden
        className="fixed left-[-120vw] top-0 pointer-events-none opacity-0"
        style={{ width: SHEET_WIDTH_PX }}
      >
        <SheetPreview
          key={current.variantId}
          data={current.data}
          assets={current.assets}
          brandLogoUrl={brandLogoUrl}
          familyOverview={current.familyOverview ?? undefined}
        />
      </div>
    ) : null,
  };
}
