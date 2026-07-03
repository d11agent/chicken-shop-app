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

/**
 * Sanitize raw text from a numeric-entry TextInput (price, qty, payment amount) so the
 * field only ever holds a plain, editable number — never a formatted display string.
 * Strips everything except digits and '.', and collapses any extra decimal points down
 * to the first one (e.g. a locale keyboard inserting "," or a stray double-tap producing
 * "10..5" both resolve to "10.5"). Call this from every numeric TextInput's onChangeText;
 * never write a toLocaleString()/formatPaise() result back into an editable input's value.
 */
export function sanitizeDecimalInput(raw: string): string {
  const digitsAndDots = raw.replace(/[^0-9.]/g, '');
  const firstDot = digitsAndDots.indexOf('.');
  if (firstDot === -1) return digitsAndDots;
  return digitsAndDots.slice(0, firstDot + 1) + digitsAndDots.slice(firstDot + 1).replace(/\./g, '');
}
