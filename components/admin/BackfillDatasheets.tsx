'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileDown, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { listVariantsMissingDatasheet } from '@/app/(admin)/admin/variants/actions';
import { useDatasheetBatch } from './useDatasheetBatch';
import { toast } from '@/components/ui/Toast';

/** Generates the datasheet for every variant that has none. */
export function BackfillDatasheets() {
  const router = useRouter();
  const [scanning, setScanning] = useState(false);

  const batch = useDatasheetBatch(({ done, total, failures }) => {
    if (failures.length > 0) {
      toast.error(`${done}/${total} PDFs generated. Failed: ${failures.join(' · ')}`);
    } else {
      toast.success(`${done} Spec Sheet PDF${done === 1 ? '' : 's'} generated.`);
    }
    router.refresh();
  });

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
    batch.start(plan);
  }

  return (
    <>
      <Button variant="outline" onClick={startScan} disabled={scanning || batch.running}>
        {batch.running ? (
          <>
            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            {`Generating ${batch.position}/${batch.total}…`}
          </>
        ) : (
          <>
            <FileDown className="w-4 h-4 mr-2" />
            {scanning ? 'Checking…' : 'Generate missing PDFs'}
          </>
        )}
      </Button>

      {batch.stage}
    </>
  );
}
