/**
 * Shared domain enums / union types for the data layer.
 * Kept as `as const` objects so they double as runtime values and TS types.
 */

export const TableName = {
  menuItems: 'menu_items',
  customers: 'customers',
  bills: 'bills',
  billLineItems: 'bill_line_items',
  paymentSplits: 'payment_splits',
  udharEntries: 'udhar_entries',
  cashSummary: 'cash_summary',
  rawMaterial: 'raw_material',
  wastage: 'wastage',
} as const;

/** Menu item / line-item entry mode. */
export const UnitType = {
  qty: 'qty', // quantity-based (half kg, 1kg, pao)
  amount: 'amount', // amount-based ("₹100 ka de do")
} as const;
export type UnitType = (typeof UnitType)[keyof typeof UnitType];

/** Bill lifecycle: draft (editable) -> confirmed (locked) -> voided (void+recreate). */
export const BillStatus = {
  draft: 'draft',
  confirmed: 'confirmed',
  voided: 'voided',
} as const;
export type BillStatus = (typeof BillStatus)[keyof typeof BillStatus];

/** Payment split modes (mixable within one bill). */
export const PaymentMode = {
  cash: 'cash',
  online: 'online',
  udhar: 'udhar',
} as const;
export type PaymentMode = (typeof PaymentMode)[keyof typeof PaymentMode];

/** Append-only udhar ledger entry types. Balance = SUM(debit) - SUM(payment) - SUM(writeoff). */
export const UdharEntryType = {
  debit: 'debit', // credit given (udhar taken on a bill)
  payment: 'payment', // customer paid back (partial payments allowed)
  writeoff: 'writeoff', // bad debt written off (counted as loss in net profit)
} as const;
export type UdharEntryType = (typeof UdharEntryType)[keyof typeof UdharEntryType];

/** Udhar entry status — display hint only, never the source of truth for balance. */
export const UdharStatus = {
  active: 'active',
  writtenOff: 'written_off',
} as const;
export type UdharStatus = (typeof UdharStatus)[keyof typeof UdharStatus];
