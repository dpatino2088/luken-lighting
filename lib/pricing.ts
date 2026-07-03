/**
 * Margin-on-selling-price formula: sellingPrice = cost / (1 - margin/100)
 * e.g. cost=80, margin=20% -> 80 / 0.80 = 100 (profit $20 = 20% of $100)
 */
export function calcDistributorPrice(cost: number, marginPct: number): number {
  if (marginPct >= 100) return 0;
  return Math.round((cost / (1 - marginPct / 100)) * 100) / 100;
}

/** Reverse: given cost and distributor price, what margin % was applied? */
export function calcMarginPct(cost: number, distributorPrice: number): number {
  if (distributorPrice <= 0) return 0;
  return Math.round(((1 - cost / distributorPrice) * 100) * 100) / 100;
}

/**
 * Markup-on-cost formula: sellingPrice = cost * (1 + markup/100)
 * e.g. cost=80, markup=25% -> 80 * 1.25 = 100
 */
export function calcPriceFromMarkup(cost: number, markupPct: number): number {
  return Math.round(cost * (1 + markupPct / 100) * 100) / 100;
}

/** Reverse: given cost and selling price, what markup % was applied? */
export function calcMarkupPct(cost: number, price: number): number {
  if (cost <= 0) return 0;
  return Math.round((price / cost - 1) * 100 * 100) / 100;
}

/** MSRP is always 2x the distributor price (distributor keeps 50% margin) */
export function calcMsrp(distributorPrice: number): number {
  return Math.round(distributorPrice * 2 * 100) / 100;
}

/** Convert USD to EUR: usd / eurToUsdRate (e.g. $12 / 1.2 = €10) */
export function convertToEur(usd: number, eurToUsdRate: number): number {
  if (eurToUsdRate <= 0) return 0;
  return Math.round((usd / eurToUsdRate) * 100) / 100;
}

export function formatUsd(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

export function formatEur(amount: number): string {
  return `€${amount.toFixed(2)}`;
}
