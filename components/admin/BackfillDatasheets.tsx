'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileDown, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { SheetPreview } from '@/components/specsheet/SheetPreview';
import { listVariantsMissingDatasheet } from '@/app/(admin)/admin/variants/actions';
import { uploadSpecSheetPdfFromPreview } from '@/lib/specsheet/uploadSpecSheetPdf';
import { SHEET_WIDTH_PX } from '@/lib/specsheet/sheetGeometry';
import { toast } from '@/components/ui/Toast';
import type { DatasheetJob } from '@/lib/specsheet/datasheetBackfill';

/**
 * Generates the datasheet for every variant that has none.
 *
 * The export reads the live Preview DOM, so each sheet is mounted offscreen one
 * at a time and exported through the same pipeline the editor uses — the batch
 * cannot drift from a hand-made Save.
 */
export function BackfillDatasheets() {
  const router = useRouter();
  const [scanning, setScanning] = useState(false);
  const [jobs, setJobs] = useState<DatasheetJob[] | null>(null);
  const [brandLogoUrl, setBrandLogoUrl] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const failures = useRef<string[]>([]);

  async function startScan() {
    setScanning(true);
    const plan = await listVariantsMissingDatasheet();
    setScanning(false);

    if ('error' in plan) {
      toast.error(plan.error);
      return;
    }
    if (plan.jobs.length === 0) {
      toast.success('Every variant already has a Spec Sheet PDF.');
      return;
    }
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
    const failed = failures.current.length;
    const done = jobs.length - failed;
    if (failed > 0) {
      toast.error(`${done}/${jobs.length} PDFs generated. Failed: ${failures.current.join(' · ')}`);
    } else {
      toast.success(`${done} Spec Sheet PDF${done === 1 ? '' : 's'} generated.`);
    }
    setJobs(null);
    setIndex(0);
    router.refresh();
  }, [jobs, index, router]);

  const running = jobs !== null;
  const current = running && index < jobs.length ? jobs[index] : null;

  return (
    <>
      <Button variant="outline" onClick={startScan} disabled={scanning || running}>
        {running ? (
          <>
            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            {`Generating ${Math.min(index + 1, jobs.length)}/${jobs.length}…`}
          </>
        ) : (
          <>
            <FileDown className="w-4 h-4 mr-2" />
            {scanning ? 'Checking…' : 'Generate missing PDFs'}
          </>
        )}
      </Button>

      {current && (
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
      )}
    </>
  );
}
