/**
 * Currency helpers. Money is stored everywhere as INTEGER PAISE to avoid float bugs.
 * ₹1 = 100 paise. Convert to rupees only for display / user input parsing.
 */

/** Rupees (possibly fractional) -> integer paise. Rounds to nearest paisa. */
export function rupeesToPaise(rupees: number): number {
  return Math.round(rupees * 100);
}

/** Integer paise -> rupees (float). For calculations prefer staying in paise. */
export function paiseToRupees(paise: number): number {
  return paise / 100;
}

/** Format integer paise as an Indian-rupee display string, e.g. 12550 -> "₹125.50". */
export function formatPaise(paise: number, withSymbol = true): string {
  const rupees = (paise / 100).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return withSymbol ? `₹${rupees}` : rupees;
}
