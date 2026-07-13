'use client';

import { type SpecSheetData, type TechRow } from '@/lib/sku/specSheet';
import { buildSku, skuColorName, skuDriverControlText, skuTrackName, skuProfileName, cctKelvinFromCustom } from '@/lib/sku/skuRules';
import { cctRange, criValue, beamValue, wattsValue } from '@/lib/sku/mapToLuken';
import type { ProductAsset } from '@/lib/types';

function Placeholder({ children }: { children: React.ReactNode }) {
  return <span className="text-gray-300">{children}</span>;
}

function assetUrl(assets: ProductAsset[] | undefined, type: string): string {
  const matches = (assets || []).filter((a) => a.type === type && a.file_url);
  if (matches.length === 0) return '';
  // Use the most recently uploaded asset of this type (there can be several).
  const latest = matches.reduce((newest, a) =>
    new Date(a.created_at).getTime() >= new Date(newest.created_at).getTime() ? a : newest,
  );
  // Cache-bust keyed to the asset id so the browser (and the print pipeline)
  // can never render a stale, previously cached image.
  const sep = latest.file_url.includes('?') ? '&' : '?';
  return `${latest.file_url}${sep}v=${encodeURIComponent(latest.id)}`;
}

export function SheetPreview({
  data,
  assets,
  brandLogoUrl,
  familyOverview,
}: {
  data: SpecSheetData;
  assets?: ProductAsset[];
  brandLogoUrl?: string | null;
  /** Product family description (the web "Overview"), shown under the photo. */
  familyOverview?: string | null;
}) {
  const r = buildSku(data.sku);
  const title = data.name || data.productName;
  const code = data.code || r.shortCode;
  const colorName = skuColorName(data.sku.color);
  const driverControl = skuDriverControlText(data.sku);

  // Images are managed exclusively in product_assets (File & Assets tab). We do
  // NOT fall back to legacy inline URLs (data.photoUrl / data.diagramUrl) so that
  // deleting an asset really removes it from the sheet.
  const mainImage = assetUrl(assets, 'image');
  const photometryImage = assetUrl(assets, 'photometric_image');
  const dimensionsImage = assetUrl(assets, 'dimensions_image');

  const dims = [
    data.ancho && `${data.ancho} W`,
    data.alto && `${data.alto} H`,
    data.fondo && `${data.fondo} D`,
  ]
    .filter(Boolean)
    .join(' × ');

  const certs = (data.iconList || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const manualTech = data.datosTecnicos.filter((t) => t.campo);

  // General data rows come from the Builder / Product fields. Only rows that
  // actually have a value are shown, so accessories (e.g. a connector with no
  // color / mounting / driver) don't render a column of empty "—" fields.
  const generalRows = [
    { label: 'Dimensions', value: dims ? `${dims} mm` : '' },
    { label: 'Weight', value: data.peso ? `${data.peso} kg` : '' },
    { label: 'Track', value: skuTrackName(data.sku.track) },
    { label: 'Profile', value: skuProfileName(data.sku.profile) },
    { label: 'Color', value: colorName },
    { label: 'Mounting', value: data.sku.mounting },
    { label: 'Material', value: data.material },
    { label: 'IP rating', value: data.ipRating },
    { label: 'Electrical class', value: data.electricalClass },
    { label: 'Driver / control', value: driverControl },
  ].filter((row) => (row.value || '').trim());

  // Values coming straight from the Builder dropdowns (CCT, CRI, beam) are reused
  // on the sheet so they never have to be re-typed in Technical data. They are
  // skipped if the user already added a manual row with the same (aliased) field.
  const derivedTech: TechRow[] = [];
  const cct = data.sku.cct === 'CUSTOM' ? cctKelvinFromCustom(data.sku.cctCustom) : cctRange(data.sku.cct);
  if (cct.min != null) {
    derivedTech.push({
      campo: 'Color temperature',
      valor: cct.max != null && cct.max !== cct.min ? `${cct.min}–${cct.max}` : `${cct.min}`,
      unidad: 'K',
    });
  }
  const cri = criValue(data.sku.cri === 'CUSTOM' ? data.sku.criCustom : data.sku.cri);
  if (cri != null) derivedTech.push({ campo: 'CRI', valor: `${cri}+`, unidad: 'Ra' });
  const beam = beamValue(data.sku.optic === 'CUSTOM' ? data.sku.opticCustom : data.sku.optic);
  if (beam != null) derivedTech.push({ campo: 'Beam angle', valor: `${beam}`, unidad: '°' });
  const watts = wattsValue(data.sku.watts === 'CUSTOM' ? data.sku.wattsCustom : data.sku.watts);
  if (watts != null) derivedTech.push({ campo: 'System wattage', valor: `${watts}`, unidad: 'W' });

  const aliases: Record<string, string> = {
    'color temperature': 'cct',
    cct: 'cct',
    cri: 'cri',
    'cri (minimum)': 'cri',
    'beam angle': 'beam',
    beam: 'beam',
    'system wattage': 'watts',
    power: 'watts',
    wattage: 'watts',
  };
  const norm = (s: string) => aliases[s.trim().toLowerCase()] ?? s.trim().toLowerCase();
  // CCT / CRI / beam angle are ALWAYS taken from the Builder (Light quality).
  // Drop any manual rows that alias to those fields so stale/legacy rows (e.g.
  // an old "Color temperature: 0") can never override the real derived value.
  const derivedKeys = new Set(['cct', 'cri', 'beam', 'watts']);
  const manualExtra = manualTech.filter((t) => !derivedKeys.has(norm(t.campo)));
  const techRows: TechRow[] = [...derivedTech, ...manualExtra];
  const configRows = data.configuraciones.filter((c) => c.codigo || c.descripcion || c.componente);
  const overviewLines = (familyOverview || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  return (
    <div
      id="spec-sheet-print"
      className="spec-sheet mx-auto bg-white shadow-lg border border-gray-200 w-[8.5in] min-h-[11in]"
    >
      {/* Content is wrapped in a table so the spacer thead/tfoot repeat on every
          printed page, giving a consistent top/bottom margin across pages while
          @page margin stays 0 (no browser header/footer). */}
      <table className="print-page-table w-full border-collapse">
        <thead className="print-page-head hidden print:table-header-group">
          <tr>
            <td>
              <div className="h-[0.5in]" />
            </td>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="align-top px-[0.5in] pt-[0.5in] pb-[0.5in] print:py-0">
              <div className="space-y-5 text-[11px] leading-relaxed text-gray-800">
        {/* Header: product image (left) + Luken wordmark (right) + code bar */}
        <div className="flex items-stretch gap-4 break-inside-avoid">
          <div className="w-[38%] max-w-[220px] aspect-square shrink-0 bg-white border border-gray-200 flex items-center justify-center overflow-hidden">
            {mainImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={mainImage} alt={title} className="h-full w-full object-contain" />
            ) : (
              <span className="text-gray-300 text-[10px] uppercase tracking-widest text-center px-2">Product image</span>
            )}
          </div>
          <div className="flex-1 flex flex-col justify-between min-w-0">
            <div className="flex justify-end items-start">
              {brandLogoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={brandLogoUrl} alt="Brand logo" className="max-h-12 max-w-[200px] object-contain" />
              ) : (
                <span className="text-3xl font-light tracking-tight">Luken</span>
              )}
            </div>
            <div className="-ml-4 bg-gray-900 text-white text-[11px] font-mono px-3 py-[5px] text-right truncate">
              {code ? `CODE: ${code}` : <span className="text-gray-400">CODE</span>}
            </div>
          </div>
        </div>

        {/* Family name + overview (from the product family description) */}
        <div className="break-inside-avoid">
          <h1 className="text-3xl font-light tracking-widest uppercase text-gray-900">
            {data.productName || <Placeholder>Family name</Placeholder>}
          </h1>
          {overviewLines.length > 0 && (
            <div className="mt-3">
              <h2 className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-2">
                Overview
              </h2>
              <div className="space-y-1">
                {overviewLines.map((line, i) => (
                  <div key={i} className="flex gap-2 text-gray-600 leading-relaxed">
                    <span className="text-gray-300 flex-shrink-0">•</span>
                    <span>{line}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Name box (the SKU code itself lives in the black CODE bar above) */}
        <div className="bg-gray-50 border border-gray-200 p-3">
          <div className="text-sm font-medium text-gray-900">{title || <Placeholder>—</Placeholder>}</div>
          <div className="text-gray-600">{data.codeDescription || <Placeholder>—</Placeholder>}</div>
        </div>

        {/* Description */}
        <section>
          <h2 className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 border-b border-gray-300 pb-1 mb-2">
            Description
          </h2>
          <p>{data.description || <Placeholder>—</Placeholder>}</p>
        </section>

        {/* Product configurations (hidden when there are none) */}
        {configRows.length > 0 && (
          <section>
            <h2 className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 border-b border-gray-300 pb-1 mb-2">
              Product configurations
            </h2>
            <table className="w-full">
              <thead>
                <tr className="text-[9px] uppercase tracking-wide text-gray-400 text-left">
                  <th className="py-1 pr-2 font-medium">Code</th>
                  <th className="py-1 pr-2 font-medium">Description</th>
                  <th className="py-1 font-medium">Component</th>
                </tr>
              </thead>
              <tbody>
                {configRows.map((c, i) => (
                  <tr key={i} className="border-t border-gray-100 align-top">
                    <td className="py-1 pr-2 font-mono">{c.codigo}</td>
                    <td className="py-1 pr-2">{c.descripcion}</td>
                    <td className="py-1">{c.componente}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {/* General data (only fields that have a value; empty rows are hidden) */}
        {generalRows.length > 0 && (
          <section>
            <h2 className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 border-b border-gray-300 pb-1 mb-2">
              General data
            </h2>
            <table className="w-full">
              <tbody>
                {generalRows.map((row, i) => (
                  <tr key={row.label} className={i < generalRows.length - 1 ? 'border-b border-gray-100' : ''}>
                    <td className="py-1 pr-3 text-gray-400 uppercase text-[9px] w-32">{row.label}</td>
                    <td className="py-1">{row.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {/* Dimensions drawing (dynamic) */}
        {dimensionsImage && (
          <section>
            <h2 className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 border-b border-gray-300 pb-1 mb-2">
              Dimensions
            </h2>
            <div className="w-full bg-white border border-gray-200 flex items-center justify-center overflow-hidden p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={dimensionsImage} alt="Dimensions" className="max-h-[220px] w-auto object-contain" />
            </div>
          </section>
        )}

        {/* Technical data */}
        {techRows.length > 0 && (
          <section>
            <h2 className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 border-b border-gray-300 pb-1 mb-2">
              Technical data
            </h2>
            <div className="grid grid-cols-2 gap-x-8">
              {techRows.map((t, i) => (
                <div key={i} className="flex justify-between gap-3 border-b border-gray-100 py-1">
                  <span className="text-gray-600">{t.campo}</span>
                  <span className="text-right">
                    {t.valor || '—'} {t.unidad && t.unidad !== '-' ? t.unidad : ''}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Photometry (dynamic) */}
        {photometryImage && (
          <section>
            <h2 className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 border-b border-gray-300 pb-1 mb-2">
              Photometry
            </h2>
            <div className="flex justify-start">
              <div className="bg-white border border-gray-200 overflow-hidden p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photometryImage} alt="Photometry" className="max-h-[180px] w-auto object-contain" />
              </div>
            </div>
          </section>
        )}

        {/* Certifications */}
        {certs.length > 0 && (
          <section>
            <h2 className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 border-b border-gray-300 pb-1 mb-2">
              Certifications
            </h2>
            <div className="flex flex-wrap gap-2">
              {certs.map((c, i) => (
                <span key={i} className="border border-gray-300 px-2 py-0.5 text-[10px]">
                  {c}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* Notes */}
        {(data.controlNotes || data.footerNote) && (
          <section className="pt-2 border-t border-gray-200 text-[10px] text-gray-500 space-y-1">
            {data.controlNotes && <p>{data.controlNotes}</p>}
            {data.footerNote && <p>{data.footerNote}</p>}
          </section>
        )}
              </div>
            </td>
          </tr>
        </tbody>
        <tfoot className="print-page-foot hidden print:table-footer-group">
          <tr>
            <td>
              <div className="h-[0.5in]" />
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
