import Link from 'next/link';
import { ProductVariant } from '@/lib/types';
import { formatCCT } from '@/lib/utils';
import { ExternalLink } from 'lucide-react';

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

export function VariantsTable({ variants, productSlug }: VariantsTableProps) {
  if (variants.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">No product codes available.</p>
      </div>
    );
  }

  return (
    <>
      {/* Desktop table */}
      <div className="hidden md:block border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                Code
              </th>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                Power
              </th>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                Lumens
              </th>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                CCT
              </th>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                IP
              </th>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                Control
              </th>
              <th className="px-5 py-3 w-10" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {variants.map((v, i) => (
              <tr
                key={v.id}
                className={`group transition-colors hover:bg-gray-50 ${
                  i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
                }`}
              >
                <td className="px-5 py-3.5">
                  <Link
                    href={`/products/${productSlug || (v as any).product?.slug}/${v.slug}`}
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
                    href={`/products/${productSlug || (v as any).product?.slug}/${v.slug}`}
                    target="_blank"
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <ExternalLink className="h-4 w-4 text-gray-400" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile card list */}
      <div className="md:hidden space-y-3">
        {variants.map((v) => (
          <Link
            key={v.id}
            href={`/products/${productSlug || (v as any).product?.slug}/${v.slug}`}
            target="_blank"
            className="block border border-gray-200 p-4 hover:border-gray-400 transition-colors"
          >
            <div className="flex items-start justify-between mb-2">
              <div>
                <p className="text-sm font-medium text-gray-900">{v.full_code || v.code}</p>
              </div>
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
          </Link>
        ))}
      </div>
    </>
  );
}
