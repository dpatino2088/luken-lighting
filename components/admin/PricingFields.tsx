'use client';

import { useState } from 'react';
import {
  calcPriceFromMarkup,
  calcMarkupPct,
  calcDistributorPrice,
  calcMarginPct,
  calcMsrp,
  convertToEur,
  formatUsd,
  formatEur,
} from '@/lib/pricing';

type Num = number | '';

const fieldClass =
  'w-full px-3 py-2 border border-gray-300 rounded-none bg-white text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent';
const labelClass = 'block text-xs font-medium uppercase tracking-wide text-gray-500 mb-1';

interface Props {
  initialCostUsd: number | null;
  initialDistributorPrice: number | null;
  eurToUsdRate?: number;
  /** Fires whenever cost or distributor price changes (source of truth for saving). */
  onChange?: (costUsd: number | null, distributorPrice: number | null) => void;
  /** When provided, hidden inputs are rendered so the fields work inside a <form>. */
  costName?: string;
  priceName?: string;
}

/**
 * Bidirectional pricing controls. Cost is the base; Markup %, Margin % and
 * Distributor Price are three interlinked lenses on the same number:
 *   price = cost * (1 + markup/100)      markup = price/cost - 1
 *   price = cost / (1 - margin/100)      margin = 1 - cost/price
 * Editing any one recomputes the others. When cost changes, the last-edited
 * driver is preserved. Only cost + distributor price are persisted upstream.
 */
export function PricingFields({
  initialCostUsd,
  initialDistributorPrice,
  eurToUsdRate = 0,
  onChange,
  costName,
  priceName,
}: Props) {
  const c0 = initialCostUsd ?? '';
  const p0 = initialDistributorPrice ?? '';
  const seedMarkup = initialCostUsd && initialDistributorPrice ? calcMarkupPct(initialCostUsd, initialDistributorPrice) : '';
  const seedMargin = initialCostUsd && initialDistributorPrice ? calcMarginPct(initialCostUsd, initialDistributorPrice) : '';

  const [cost, setCost] = useState<Num>(c0);
  const [price, setPrice] = useState<Num>(p0);
  const [markup, setMarkup] = useState<Num>(seedMarkup);
  const [margin, setMargin] = useState<Num>(seedMargin);
  const [driver, setDriver] = useState<'markup' | 'margin' | 'price'>('price');

  const emit = (nextCost: Num, nextPrice: Num) => {
    onChange?.(nextCost === '' ? null : Number(nextCost), nextPrice === '' ? null : Number(nextPrice));
  };

  const applyCost = (raw: string) => {
    const nc: Num = raw === '' ? '' : Number(raw);
    setCost(nc);
    if (nc === '' || Number(nc) <= 0) {
      emit(nc, price);
      return;
    }
    const cv = Number(nc);
    if (driver === 'markup' && markup !== '') {
      const np = calcPriceFromMarkup(cv, Number(markup));
      setPrice(np);
      setMargin(calcMarginPct(cv, np));
      emit(nc, np);
    } else if (driver === 'margin' && margin !== '' && Number(margin) < 100) {
      const np = calcDistributorPrice(cv, Number(margin));
      setPrice(np);
      setMarkup(calcMarkupPct(cv, np));
      emit(nc, np);
    } else if (price !== '') {
      setMarkup(calcMarkupPct(cv, Number(price)));
      setMargin(calcMarginPct(cv, Number(price)));
      emit(nc, price);
    } else {
      emit(nc, price);
    }
  };

  const applyMarkup = (raw: string) => {
    const mk: Num = raw === '' ? '' : Number(raw);
    setDriver('markup');
    setMarkup(mk);
    if (cost !== '' && Number(cost) > 0 && mk !== '') {
      const cv = Number(cost);
      const np = calcPriceFromMarkup(cv, Number(mk));
      setPrice(np);
      setMargin(calcMarginPct(cv, np));
      emit(cost, np);
    }
  };

  const applyMargin = (raw: string) => {
    const mg: Num = raw === '' ? '' : Number(raw);
    setDriver('margin');
    setMargin(mg);
    if (cost !== '' && Number(cost) > 0 && mg !== '' && Number(mg) < 100) {
      const cv = Number(cost);
      const np = calcDistributorPrice(cv, Number(mg));
      setPrice(np);
      setMarkup(calcMarkupPct(cv, np));
      emit(cost, np);
    }
  };

  const applyPrice = (raw: string) => {
    const np: Num = raw === '' ? '' : Number(raw);
    setDriver('price');
    setPrice(np);
    if (cost !== '' && Number(cost) > 0 && np !== '' && Number(np) > 0) {
      const cv = Number(cost);
      setMarkup(calcMarkupPct(cv, Number(np)));
      setMargin(calcMarginPct(cv, Number(np)));
    }
    emit(cost, np);
  };

  const marginInvalid = margin !== '' && Number(margin) >= 100;
  const costN = cost === '' ? null : Number(cost);
  const priceN = price === '' ? null : Number(price);
  const msrp = priceN ? calcMsrp(priceN) : null;

  return (
    <div className="space-y-4">
      {costName ? <input type="hidden" name={costName} value={cost === '' ? '' : cost} /> : null}
      {priceName ? <input type="hidden" name={priceName} value={price === '' ? '' : price} /> : null}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <label className={labelClass}>Cost USD</label>
          <input className={fieldClass} type="number" step="0.01" min="0" value={cost} onChange={(e) => applyCost(e.target.value)} placeholder="0.00" />
        </div>
        <div>
          <label className={labelClass}>Markup %</label>
          <input className={fieldClass} type="number" step="0.01" value={markup} onChange={(e) => applyMarkup(e.target.value)} placeholder="e.g. 66.67" />
          <p className="text-[11px] text-gray-400 mt-1">On cost</p>
        </div>
        <div>
          <label className={labelClass}>Margin %</label>
          <input
            className={
              'w-full px-3 py-2 border rounded-none bg-white text-sm text-gray-900 focus:outline-none focus:ring-2 focus:border-transparent ' +
              (marginInvalid ? 'border-red-400 focus:ring-red-500' : 'border-gray-300 focus:ring-gray-900')
            }
            type="number"
            step="0.01"
            value={margin}
            onChange={(e) => applyMargin(e.target.value)}
            placeholder="e.g. 40"
          />
          {marginInvalid ? (
            <p className="text-[11px] text-red-500 mt-1">Margin must be under 100%</p>
          ) : (
            <p className="text-[11px] text-gray-400 mt-1">On selling price</p>
          )}
        </div>
        <div>
          <label className={labelClass}>Distributor Price USD</label>
          <input className={fieldClass} type="number" step="0.01" min="0" value={price} onChange={(e) => applyPrice(e.target.value)} placeholder="0.00" />
        </div>
      </div>

      {/* Live viewer: how the current price breaks down */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 border-t border-gray-100 pt-3 text-center">
        <div>
          <p className="text-[10px] text-gray-400 uppercase tracking-wide">Cost</p>
          <p className="text-sm font-medium text-gray-700 tabular-nums">{costN ? formatUsd(costN) : '—'}</p>
        </div>
        <div>
          <p className="text-[10px] text-gray-400 uppercase tracking-wide">Markup</p>
          <p className="text-sm font-medium text-gray-700 tabular-nums">{markup !== '' ? `${Number(markup).toFixed(2)}%` : '—'}</p>
        </div>
        <div>
          <p className="text-[10px] text-gray-400 uppercase tracking-wide">Margin</p>
          <p className="text-sm font-medium text-gray-700 tabular-nums">{margin !== '' ? `${Number(margin).toFixed(2)}%` : '—'}</p>
        </div>
        <div>
          <p className="text-[10px] text-gray-400 uppercase tracking-wide">Distributor · MSRP (2×)</p>
          <p className="text-sm font-medium text-gray-700 tabular-nums">
            {priceN ? formatUsd(priceN) : '—'}{msrp ? ` · ${formatUsd(msrp)}` : ''}
          </p>
          {priceN && eurToUsdRate > 0 ? (
            <p className="text-[11px] text-gray-400 tabular-nums">{formatEur(convertToEur(priceN, eurToUsdRate))}{msrp ? ` · ${formatEur(convertToEur(msrp, eurToUsdRate))}` : ''}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
