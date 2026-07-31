'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Download, FileCode, Loader2, Ruler, Settings } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { AdminSelect } from '@/components/ui/AdminSelect';
import { toast } from '@/components/ui/Toast';
import { LabelSvg } from '@/components/label/LabelSvg';
import { LabelMeasures, MEASURE_GUTTER, measureItems } from '@/components/label/LabelMeasures';
import { LABEL_LEVELS, type LabelTemplate } from '@/lib/label/geometry';
import { contentOf, layoutLabel } from '@/lib/label/layout';
import { formatUpcAHuman, isValidUpcA } from '@/lib/label/gtin';
import {
  deriveSpecLine,
  labelQrUrl,
  labelSiteOrigin,
  type LabelData,
} from '@/lib/label/labelData';
import {
  listLabelTemplates,
  setProductLabelTemplate,
  setVariantGtin,
} from '@/app/(admin)/admin/labels/actions';
import {
  downloadBlob,
  exportLabelPdf,
  exportLabelSvg,
  labelFileName,
} from '@/lib/label/exportLabel';
import type { ProductVariant } from '@/lib/types';

const fieldCls =
  'w-full px-3 py-2 border border-gray-300 rounded-none bg-white text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent';
const labelCls = 'block text-xs font-medium uppercase tracking-wide text-gray-500 mb-1';

/** CSS defines the millimetre exactly, which is what makes 1× a true trim size. */
const PX_PER_MM = 96 / 25.4;

export function LabelTab({
  variant,
  code,
  name,
  family,
  productId,
  productSlug,
  initialTemplateId,
  labelLogoUrl,
}: {
  variant: ProductVariant;
  code: string;
  name: string;
  family: string;
  productId: string | null;
  productSlug: string | null;
  initialTemplateId: string | null;
  labelLogoUrl: string | null;
}) {
  const [templates, setTemplates] = useState<LabelTemplate[]>([]);
  const [templateId, setTemplateId] = useState<string | null>(initialTemplateId);
  const [gtin, setGtin] = useState(variant.gtin || '');
  const [savedGtin, setSavedGtin] = useState(variant.gtin || '');
  const [gtinBusy, setGtinBusy] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  // Opens at 1×: the preview then shows the label at its true trim size, which is
  // the state you want to judge proportions in. Higher zooms are for inspection.
  const [zoom, setZoom] = useState(1);
  const [measuring, setMeasuring] = useState(false);
  const gutter = measuring ? MEASURE_GUTTER : 0;

  useEffect(() => {
    listLabelTemplates().then((rows) => {
      setTemplates(rows);
      setTemplateId((current) => current ?? rows.find((r) => r.is_default)?.id ?? rows[0]?.id ?? null);
    });
  }, []);

  const template = templates.find((t) => t.id === templateId) ?? null;

  const data: LabelData = useMemo(
    () => ({
      family,
      name,
      code,
      specLine: deriveSpecLine(variant),
      gtin: savedGtin && isValidUpcA(savedGtin) ? savedGtin : null,
      qrUrl: labelQrUrl(productSlug, variant.slug),
      logoUrl: labelLogoUrl,
      siteText: labelSiteOrigin().replace(/^https?:\/\//, ''),
      originText: 'Produced in China',
    }),
    [code, name, family, variant, savedGtin, productSlug, labelLogoUrl]
  );

  const isSvgLogo = Boolean(data.logoUrl && /\.svg(\?|$)/i.test(data.logoUrl));

  // Same call the renderer makes, so the notice below lists exactly what the
  // preview and the download left out for this variant — not a generic estimate.
  const layout = useMemo(
    () => (template ? layoutLabel(template, contentOf(data)) : null),
    [template, data]
  );

  // Same list behind the drawing and the legend, so a letter on the artwork and a
  // row under it can never come to disagree.
  const measures = useMemo(() => (layout ? measureItems(layout) : []), [layout]);

  async function handleSaveGtin() {
    setGtinBusy(true);
    const result = await setVariantGtin(variant.id, gtin);
    setGtinBusy(false);
    if ('error' in result) {
      toast.error(result.error);
      return;
    }
    setSavedGtin(result.gtin || '');
    setGtin(result.gtin || '');
    toast.success(result.gtin ? `GTIN ${formatUpcAHuman(result.gtin)} saved.` : 'GTIN cleared.');
  }

  async function handleTemplateChange(id: string) {
    // The dropdown reports its placeholder as an empty string; sent as-is it
    // reaches Postgres as an invalid uuid instead of clearing the choice.
    const next = id || null;
    setTemplateId(next);
    if (!productId) return;
    const result = await setProductLabelTemplate(productId, next);
    if ('error' in result) toast.error(result.error);
  }

  /**
   * Both exports clone the live preview, so the placeholder guides have to leave
   * the DOM first — a dashed "LOGO" box must never reach the factory.
   */
  async function withoutPlaceholders<T>(run: () => T | Promise<T>): Promise<T> {
    setExporting(true);
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    );
    try {
      return await run();
    } finally {
      setExporting(false);
    }
  }

  async function handleDownloadPdf() {
    if (!template) return;
    setPdfBusy(true);
    try {
      const blob = await withoutPlaceholders(() => exportLabelPdf(template));
      downloadBlob(blob, labelFileName(code, 'pdf'));
      toast.success(`PDF at ${template.width_mm} × ${template.height_mm} mm.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'PDF export failed.');
    } finally {
      setPdfBusy(false);
    }
  }

  async function handleDownloadSvg() {
    try {
      const blob = await withoutPlaceholders(() => exportLabelSvg());
      downloadBlob(blob, labelFileName(code, 'svg'));
      toast.success('SVG ready — opens in Illustrator with editable vectors.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'SVG export failed.');
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-[11px] text-gray-500">
        Artwork for the factory. The template sets the trim size and where the fold falls; every
        element keeps a fixed physical size so the barcode stays within GS1 minimums and the type
        matches the labels already in production. <strong>PDF</strong> is the print-ready file at
        exact millimetres, <strong>SVG</strong> is the editable handoff to Illustrator for CMYK.
      </p>

      <div className="bg-white border border-gray-200 p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <label className={labelCls}>Template</label>
            <AdminSelect
              aria-label="Label template"
              value={templateId || ''}
              placeholder={
                templates.length === 0 ? '— No templates configured —' : '— Select a template —'
              }
              onChange={handleTemplateChange}
              // Grouped by packaging level so the list reads lamp → product box →
              // inner → master, the order the goods are actually packed in.
              options={templates.map((t) => ({
                value: t.id,
                group: LABEL_LEVELS.find((l) => l.value === t.level)?.label ?? t.level,
                label: `${t.name} · ${t.width_mm}×${t.height_mm}mm ${t.orientation === 'portrait' ? '↕' : '↔'} · ${t.sections === 2 ? `fold ${t.fold_mm}mm` : 'single'}`,
              }))}
            />
            <p className="mt-1 text-[11px] text-gray-500">
              {templates.length === 0 ? (
                <>
                  Add label sizes in <strong>Settings → Labels</strong> and they appear here.
                </>
              ) : productId ? (
                <>
                  Saved on the family, so every variant of this product prints the same label. Sizes
                  are managed in <strong>Settings → Labels</strong>.
                </>
              ) : (
                'Assign this variant to a family to remember the choice.'
              )}
            </p>
          </div>
          <div>
            <label className={labelCls}>Barcode (UPC-A)</label>
            <div className="flex gap-2">
              <input
                className={fieldCls}
                value={gtin}
                onChange={(e) => setGtin(e.target.value)}
                placeholder="12 digits"
                inputMode="numeric"
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleSaveGtin}
                disabled={gtinBusy || gtin === savedGtin}
              >
                {gtinBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
              </Button>
            </div>
            <p className="mt-1 text-[11px] text-gray-500">
              {savedGtin
                ? formatUpcAHuman(savedGtin)
                : 'From your GS1 range. The check digit is verified on save.'}
            </p>
          </div>
        </div>

        <Link
          href="/admin/settings"
          className="inline-flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-900"
        >
          <Settings className="w-3.5 h-3.5" />
          Manage label sizes
        </Link>
      </div>

      {layout && layout.dropped.length > 0 && (
        <div className="border border-amber-300 bg-amber-50 p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="space-y-1">
              <p className="text-xs font-medium text-amber-900">
                This size cannot carry everything, so the label below leaves out{' '}
                {layout.dropped.map((d) => d.key).join(', ')}.
              </p>
              {layout.dropped.map((d) => (
                <p key={d.key} className="text-[11px] text-amber-800">
                  {d.reason}
                </p>
              ))}
              <p className="text-[11px] text-amber-800">
                Type and margins already shrank to fit. Every size in{' '}
                <strong>Settings → Labels</strong> carries everything while its fields follow the
                template’s direction, so check there whether one of them has been pinned across or
                turned.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Not losses, but choices the layout made that change how the printed piece
          behaves — a shorter symbol still scans, only less forgivingly. */}
      {layout && layout.notes.length > 0 && (
        <div className="border border-gray-200 bg-gray-50 p-3 space-y-1">
          {layout.notes.map((note) => (
            <p key={note} className="text-[11px] text-gray-600">
              {note}
            </p>
          ))}
        </div>
      )}

      {!data.qrUrl && (
        <div className="border border-amber-300 bg-amber-50 p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <p className="text-[11px] text-amber-800">
              This variant has no public page yet, so there is nothing for the QR to open. Assign it
              to a product family in the <strong>Builder</strong> tab and save.
            </p>
          </div>
        </div>
      )}

      {!data.logoUrl ? (
        <p className="text-[11px] text-gray-500 border border-gray-200 bg-gray-50 p-3">
          No label logo uploaded yet. Add one in <strong>Settings → Label Logo</strong> — upload it
          as SVG so the label stays fully vector for print.
        </p>
      ) : (
        !isSvgLogo && (
          <div className="border border-amber-300 bg-amber-50 p-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <p className="text-[11px] text-amber-800">
                The label logo is a bitmap, so it is the one element that will not stay sharp when
                the factory scales the artwork, and it reaches Illustrator as a linked image instead
                of editable vectors. Re-upload it as <strong>SVG</strong> in{' '}
                <strong>Settings → Label Logo</strong>.
              </p>
            </div>
          </div>
        )
      )}

      <div className="flex items-center gap-2">
        <Button type="button" onClick={handleDownloadPdf} disabled={!template || pdfBusy}>
          {pdfBusy ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Download className="w-4 h-4 mr-2" />
          )}
          Download PDF
        </Button>
        <Button type="button" variant="secondary" onClick={handleDownloadSvg} disabled={!template}>
          <FileCode className="w-4 h-4 mr-2" />
          Download SVG
        </Button>
        <div className="ml-auto flex items-center gap-3 text-xs text-gray-500">
          <button
            type="button"
            onClick={() => setMeasuring((on) => !on)}
            aria-pressed={measuring}
            className={`inline-flex items-center gap-1.5 px-2 py-1 border transition-colors ${measuring ? 'border-gray-900 text-gray-900 font-medium' : 'border-gray-200 hover:border-gray-400'}`}
          >
            <Ruler className="w-3.5 h-3.5" />
            Measurements
          </button>
          <div className="flex items-center gap-1">
            <span>Zoom</span>
            {[1, 1.5, 2, 3].map((z) => (
              <button
                key={z}
                type="button"
                onClick={() => setZoom(z)}
                className={`px-2 py-1 border transition-colors ${zoom === z ? 'border-gray-900 text-gray-900 font-medium' : 'border-gray-200 hover:border-gray-400'}`}
              >
                {z}×
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-gray-100 border border-gray-200 p-8 overflow-auto">
        {template && layout ? (
          // The label is positioned rather than laid out inline so the dimensions
          // can be drawn in the margin around it, in screen pixels, without the
          // zoom transform shrinking the numbers with the artwork.
          <div
            className="relative"
            style={{
              width: layout.canvas.w * PX_PER_MM * zoom + gutter * 2,
              height: layout.canvas.h * PX_PER_MM * zoom + gutter * 2,
            }}
          >
            <div
              className="absolute"
              style={{ left: gutter, top: gutter, transform: `scale(${zoom})`, transformOrigin: 'top left' }}
            >
              <LabelSvg template={template} data={data} showPlaceholders={!exporting} />
            </div>
            {measuring && (
              <LabelMeasures
                layout={layout}
                scale={PX_PER_MM * zoom}
                gutter={gutter}
                items={measures}
              />
            )}
          </div>
        ) : (
          <p className="text-xs text-gray-500">Select a template to see the label.</p>
        )}
      </div>

      {template && (
        <p className="text-[11px] text-gray-500">
          Trim {template.width_mm} × {template.height_mm} mm,{' '}
          {template.orientation === 'portrait' ? 'artwork turned 90°' : 'artwork horizontal'}
          {template.sections === 2
            ? `, fold at ${template.fold_mm} mm from the left`
            : ', single panel'}
          .{data.qrUrl ? ` The QR opens ${data.qrUrl}` : ''}
        </p>
      )}

      {/* The sizes behind the drawing: what the factory would otherwise have to
          measure off the file, including the type, which has no dimension line. */}
      {measuring && measures.length > 0 && (
        <div className="border border-gray-200 bg-white p-4 space-y-2">
          <p className="text-[11px] uppercase tracking-wide text-gray-500">Sizes, in millimetres</p>
          <dl className="grid grid-cols-1 gap-x-8 gap-y-0.5 text-[11px] text-gray-700 sm:grid-cols-2">
            {measures.map((item) => (
              <div
                key={item.term}
                className="flex items-center justify-between gap-3 border-b border-gray-100 py-1"
              >
                <dt className="flex items-center gap-2 text-gray-500">
                  {item.tag && (
                    <span
                      className="inline-flex h-4 w-4 items-center justify-center text-[10px] font-bold text-gray-900"
                      style={{ backgroundColor: item.spot?.color }}
                    >
                      {item.tag}
                    </span>
                  )}
                  {item.term}
                </dt>
                <dd className="font-medium tabular-nums">{item.value}</dd>
              </div>
            ))}
          </dl>
          <p className="text-[11px] text-gray-500">
            Type is measured as its cap-to-baseline size, the value you would set in Illustrator. The
            barcode box is the whole symbol including its quiet zones and the digits under the bars,
            so the bar height is given separately.
          </p>
        </div>
      )}
    </div>
  );
}
