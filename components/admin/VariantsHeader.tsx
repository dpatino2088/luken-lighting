'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus, Upload } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { CsvImportWizard } from './CsvImportWizard';
import { BackfillDatasheets } from './BackfillDatasheets';

export function VariantsHeader() {
  const [showImport, setShowImport] = useState(false);

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-light tracking-widest uppercase mb-2">
            Variants
          </h1>
          <p className="text-gray-600">
            Manage product variants
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/admin/variants/new">
            <Button variant="primary">
              <Plus className="w-4 h-4 mr-2" />
              Add Variant
            </Button>
          </Link>
          <Button variant="outline" onClick={() => setShowImport(true)}>
            <Upload className="w-4 h-4 mr-2" />
            Import Variants
          </Button>
          <BackfillDatasheets />
        </div>
      </div>

      {showImport && <CsvImportWizard onClose={() => setShowImport(false)} />}
    </>
  );
}
