import { PaymentMode, UnitType, type UdharEntryType, UDHAR_SIGN } from '../../db/constants';

/**
 * Pure billing math — no DB, no side effects. All money is INTEGER PAISE.
 * This is the financial core; keep it exhaustively tested (see calc.test.ts).
 */

/** Input describing one line before it is persisted. */
export interface LineInput {
  mode: UnitType;
  /** qty mode: units (kg / pcs), may be fractional. */
  quantity?: number;
  /** qty mode: frozen price per unit, in paise. */
  unitPrice?: number;
  /** amount mode: the rupee amount the customer asked for, in paise. */
  amount?: number;
}

/** One payment split within a bill. */
export interface SplitInput {
  mode: PaymentMode;
  amount: number; // paise
}

/**
 * Total for a single line in paise.
 * - qty mode:    round(quantity * unitPrice)
 * - amount mode: amount as-is
 * Throws on missing/negative inputs — a bad line must never silently become ₹0.
 */
export function computeLineTotal(line: LineInput): number {
  if (line.mode === UnitType.qty) {
    const q = line.quantity;
    const p = line.unitPrice;
    if (q == null || p == null) {
      throw new Error('qty line requires quantity and unitPrice');
    }
    if (q < 0 || p < 0) throw new Error('qty line values must be non-negative');
    return Math.round(q * p);
  }
  // amount mode
  const a = line.amount;
  if (a == null) throw new Error('amount line requires amount');
  if (a < 0) throw new Error('amount must be non-negative');
  return Math.round(a);
}

/** Sum of all line totals (paise). */
export function computeBillTotal(lines: LineInput[]): number {
  return lines.reduce((sum, line) => sum + computeLineTotal(line), 0);
}

/** Sum of payment splits (paise). */
export function sumSplits(splits: SplitInput[]): number {
  return splits.reduce((sum, s) => sum + s.amount, 0);
}

/** Portion of a bill taken on credit (paise) — the udhar amount. */
export function udharPortion(splits: SplitInput[]): number {
  return splits
    .filter((s) => s.mode === PaymentMode.udhar)
    .reduce((sum, s) => sum + s.amount, 0);
}

/**
 * A customer phone is mandatory the moment any udhar (even partial) is on the bill.
 * (Spec 4.3 / edge case 7 / CLAUDE.md domain rule.)
 */
export function requiresPhone(splits: SplitInput[]): boolean {
  return udharPortion(splits) > 0;
}

export interface BillValidation {
  ok: boolean;
  errors: string[];
}

/**
 * Validate a bill before confirm. Splits must be present, non-negative, and sum
 * exactly to the bill total (no float slop — everything is integer paise).
 */
export function validateBill(params: {
  total: number;
  splits: SplitInput[];
  customerHasPhone: boolean;
}): BillValidation {
  const { total, splits, customerHasPhone } = params;
  const errors: string[] = [];

  if (total <= 0) errors.push('Bill total must be greater than zero.');
  if (splits.length === 0) errors.push('At least one payment split is required.');
  if (splits.some((s) => s.amount < 0)) errors.push('Payment amounts cannot be negative.');

  const paid = sumSplits(splits);
  if (paid !== total) {
    errors.push(`Payments (${paid}) must equal bill total (${total}).`);
  }

  if (requiresPhone(splits) && !customerHasPhone) {
    errors.push('Phone number is required when any amount is on udhar.');
  }

  return { ok: errors.length === 0, errors };
}

/** Signed contribution of a ledger entry to the running udhar balance (paise). */
export function signedUdharAmount(entryType: UdharEntryType, amount: number): number {
  return UDHAR_SIGN[entryType] * amount;
}

/** Current udhar balance (paise) from an append-only list of ledger entries. */
export function udharBalance(entries: { entryType: UdharEntryType; amount: number }[]): number {
  return entries.reduce((sum, e) => sum + signedUdharAmount(e.entryType, e.amount), 0);
}
