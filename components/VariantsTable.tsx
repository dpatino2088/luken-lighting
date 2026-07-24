import { Fragment } from 'react';
import Link from 'next/link';
import { ProductVariant } from '@/lib/types';
import { formatCCT } from '@/lib/utils';
import { ExternalLink } from 'lucide-react';
import { VariantThumb } from '@/components/VariantThumb';

interface VariantsTableProps {
  variants: ProductVariant[];
  productSlug?: string;
}

const CONTROL_LABELS: Record<string, string> = {
  'on-off': 'On/Off',
  phase: 'Phase Cut',
  dali: 'DALI',
  '0-10v': '0-10V',
  '1-10v': '1-10V',
  casambi: 'Casambi',
  zigbee: 'Zigbee',
  dmx: 'DMX512',
  push: 'Push-dim',
};

/** Group the (already filtered) variants into ordered sections by `_group`. */
function groupVariants(variants: ProductVariant[]): { name: string; items: ProductVariant[] }[] {
  const map = new Map<string, { sort: number; items: ProductVariant[] }>();
  for (const v of variants) {
    const name = v._group || 'Other';
    const sort = v._groupSort ?? 999;
    if (!map.has(name)) map.set(name, { sort, items: [] });
    map.get(name)!.items.push(v);
  }
  return [...map.entries()]
    .sort((a, b) => a[1].sort - b[1].sort)
    .map(([name, { items }]) => ({ name, items }));
}

export function VariantsTable({ variants, productSlug }: VariantsTableProps) {
  if (variants.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">No product codes available.</p>
      </div>
    );
  }

  const groups = groupVariants(variants);
  // Only show section headers when there is more than one group; a single-group
  // product renders as a flat list (no redundant header).
  const showHeaders = groups.length > 1;
  const variantHref = (v: ProductVariant) =>
    `/products/${productSlug || (v as any).product?.slug}/${v.slug}`;

  return (
    <>
      {/* Desktop table */}
      <div className="hidden md:block border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-white border-b border-gray-100">
              <th className="px-5 py-3 w-16" />
              <th className="px-5 py-3 text-left text-xs font-medium tracking-wide text-gray-600">
                Code
              </th>
              <th className="px-5 py-3 text-left text-xs font-medium tracking-wide text-gray-600">
                Power
              </th>
              <th className="px-5 py-3 text-left text-xs font-medium tracking-wide text-gray-600">
                Lumens
              </th>
              <th className="px-5 py-3 text-left text-xs font-medium tracking-wide text-gray-600">
                CCT
              </th>
              <th className="px-5 py-3 text-left text-xs font-medium tracking-wide text-gray-600">
                IP
              </th>
              <th className="px-5 py-3 text-left text-xs font-medium tracking-wide text-gray-600">
                Control
              </th>
              <th className="px-5 py-3 w-10" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {groups.map((group) => (
              <Fragment key={group.name}>
                {showHeaders && (
                  <tr className="bg-gray-50/60 border-t border-gray-100">
                    <td
                      colSpan={8}
                      className="px-5 py-2 text-[13px] font-medium tracking-wide text-gray-500"
                    >
                      {group.name}
                      <span className="ml-2 text-gray-400">({group.items.length})</span>
                    </td>
                  </tr>
                )}
                {group.items.map((v) => (
                  <tr
                    key={v.id}
                    className="group bg-white transition-colors hover:bg-gray-50/70"
                  >
                    <td className="px-5 py-3">
                      <Link href={variantHref(v)} target="_blank" className="block">
                        <VariantThumb v={v} />
                      </Link>
                    </td>
                    <td className="px-5 py-3.5">
                      <Link
                        href={variantHref(v)}
                        target="_blank"
                        className="text-sm font-medium text-gray-900 hover:text-brand-copper transition-colors"
                      >
                        {v.full_code || v.code || '—'}
                      </Link>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-gray-600">
                      {(v.power_w_system || v.power_w) ? `${v.power_w_system || v.power_w}W` : '—'}
                    </td>
                    <td className="px-5 py-3.5 text-sm text-gray-600">
                      {(v.lumens_system || v.lumens) ? `${v.lumens_system || v.lumens}lm` : '—'}
                    </td>
                    <td className="px-5 py-3.5 text-sm text-gray-600">
                      {(v.cct_min || v.cct_max) ? formatCCT(v.cct_min, v.cct_max) : '—'}
                    </td>
                    <td className="px-5 py-3.5 text-sm text-gray-600">
                      {v.ip_rating || '—'}
                    </td>
                    <td className="px-5 py-3.5 text-sm text-gray-600">
                      {v.control_types && v.control_types.length > 0
                        ? v.control_types.map((c) => CONTROL_LABELS[c] || c).join(', ')
                        : '—'}
                    </td>
                    <td className="px-5 py-3.5">
                      <Link
                        href={variantHref(v)}
                        target="_blank"
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <ExternalLink className="h-4 w-4 text-gray-400" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile card list */}
      <div className="md:hidden space-y-6">
        {groups.map((group) => (
          <div key={group.name} className="space-y-3">
            {showHeaders && (
              <h3 className="text-[13px] font-medium tracking-wide text-gray-500">
                {group.name}
                <span className="ml-2 text-gray-400">({group.items.length})</span>
              </h3>
            )}
            {group.items.map((v) => (
              <Link
                key={v.id}
                href={variantHref(v)}
                target="_blank"
                className="flex gap-3 border border-gray-200 p-4 hover:border-gray-400 transition-colors"
              >
                <VariantThumb v={v} className="h-14 w-14" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between mb-2 gap-2">
                    <p className="text-sm font-medium text-gray-900 break-all">{v.full_code || v.code}</p>
                    <ExternalLink className="h-4 w-4 text-gray-400 flex-shrink-0 mt-0.5" />
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600">
                    {(v.power_w_system || v.power_w) && <span>{v.power_w_system || v.power_w}W</span>}
                    {(v.lumens_system || v.lumens) && <span>{v.lumens_system || v.lumens}lm</span>}
                    {(v.cct_min || v.cct_max) && <span>{formatCCT(v.cct_min, v.cct_max)}</span>}
                    {v.ip_rating && <span>{v.ip_rating}</span>}
                    {v.control_types && v.control_types.length > 0 && (
                      <span>{v.control_types.map((c) => CONTROL_LABELS[c] || c).join(', ')}</span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ))}
      </div>
    </>
  );
}
