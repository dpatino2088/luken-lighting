/**
 * UPC-A helpers.
 *
 * A GTIN is not a random number: the first digits are the GS1 company prefix
 * licensed to Luken, and the last digit is a checksum derived from the rest.
 * Inventing codes produces symbols that collide with other companies' products
 * and get rejected by retailers, so the only thing generated here is the check
 * digit — the item reference always comes from an allocated range.
 */

/** Modulo-10 check digit over the first 11 digits of a UPC-A. */
export function upcCheckDigit(first11: string): number {
  if (!/^[0-9]{11}$/.test(first11)) {
    throw new Error('UPC-A check digit needs exactly 11 digits');
  }
  let sum = 0;
  for (let i = 0; i < 11; i++) {
    // Odd positions (1-based) weigh 3.
    sum += Number(first11[i]) * (i % 2 === 0 ? 3 : 1);
  }
  return (10 - (sum % 10)) % 10;
}

export function isValidUpcA(gtin: string): boolean {
  if (!/^[0-9]{12}$/.test(gtin)) return false;
  return upcCheckDigit(gtin.slice(0, 11)) === Number(gtin[11]);
}

/** Complete an 11-digit body into a full UPC-A. */
export function completeUpcA(first11: string): string {
  return first11 + String(upcCheckDigit(first11));
}

/**
 * Human-readable grouping printed under the bars: `8 50035 35539 8`.
 * Matches how the existing Luken artwork sets the digits.
 */
export function formatUpcAHuman(gtin: string): string {
  if (!/^[0-9]{12}$/.test(gtin)) return gtin;
  return `${gtin[0]} ${gtin.slice(1, 6)} ${gtin.slice(6, 11)} ${gtin[11]}`;
}
