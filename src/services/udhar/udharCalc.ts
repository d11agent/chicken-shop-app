import { UdharEntryType } from '../../db/constants';
import { signedUdharAmount, udharBalance } from '../billing/calc';

/**
 * Pure udhar-ledger math — aging, advance credit, overview sort order. No DB, no
 * side effects. All money is INTEGER PAISE, all dates are UTC epoch ms.
 */

export const AGING_YELLOW_DAYS = 15;
export const AGING_RED_DAYS = 60;
export type AgingFlag = 'none' | 'yellow' | 'red';
const MS_PER_DAY = 86_400_000;

/** One ledger row's shape as needed for aging math (dates as epoch ms, not Date). */
export interface LedgerEntry {
  entryType: UdharEntryType;
  amount: number; // paise
  createdAt: number; // epoch ms
  billId?: string;
}

/**
 * Oldest still-outstanding debit date, FIFO. A void_reversal always cancels exactly
 * one debit (same bill_id, matching amount — guaranteed by voidBill), so it's netted
 * out of the pool directly rather than treated as a generic reducing amount; otherwise
 * a void-cancelled recent debit could wrongly "absorb" the reducing pool and launder an
 * older real debt's age down to zero. Everything else (payment/writeoff/writeoff_reversal)
 * is a generic reducing/un-reducing amount consumed oldest-debit-first — this is what
 * makes a partial payment against an old debt NOT advance its reported age.
 */
export function oldestUnsettledDebitDate(entries: LedgerEntry[]): number | null {
  const voidedBillIds = new Set(
    entries
      .filter((e) => e.entryType === UdharEntryType.voidReversal && e.billId)
      .map((e) => e.billId as string),
  );
  const unpaidDebits = entries
    .filter((e) => e.entryType === UdharEntryType.debit && !(e.billId && voidedBillIds.has(e.billId)))
    .slice()
    .sort((a, b) => a.createdAt - b.createdAt); // sort a COPY, never mutate the input

  const reducingTotal = entries.reduce((sum, e) => {
    if (e.entryType === UdharEntryType.debit || e.entryType === UdharEntryType.voidReversal) return sum;
    // payment/writeoff contribute +amount (they settle debt); writeoff_reversal contributes
    // -amount (it un-settles debt, shrinking how much of the pool is actually retired).
    return sum - signedUdharAmount(e.entryType, e.amount);
  }, 0);

  let remaining = reducingTotal;
  for (const debit of unpaidDebits) {
    if (remaining < debit.amount) return debit.createdAt;
    remaining -= debit.amount;
  }
  return null;
}

/** Most recent payment date, independent of the aging clock. */
export function lastPaymentDate(entries: LedgerEntry[]): number | null {
  const dates = entries.filter((e) => e.entryType === UdharEntryType.payment).map((e) => e.createdAt);
  return dates.length ? Math.max(...dates) : null;
}

/** 15+ days since the oldest unsettled debit = yellow, 60+ = red, else none. */
export function agingFlag(oldestUnsettledDebitDate: number | null, nowMs: number = Date.now()): AgingFlag {
  if (oldestUnsettledDebitDate == null) return 'none';
  const days = (nowMs - oldestUnsettledDebitDate) / MS_PER_DAY;
  if (days >= AGING_RED_DAYS) return 'red';
  if (days >= AGING_YELLOW_DAYS) return 'yellow';
  return 'none';
}

/** A negative balance is an overpayment sitting as advance credit for the customer. */
export function advanceCredit(balance: number): number {
  return balance < 0 ? -balance : 0;
}

/** A positive balance is the amount currently owed. */
export function outstandingBalance(balance: number): number {
  return balance > 0 ? balance : 0;
}

export interface CustomerUdharSummary {
  customerId: string;
  balance: number;
  oldestUnsettledDebitDate: number | null;
  lastPaymentDate: number | null;
}

/** Groups a mixed-customer entry list into one summary row per customer. */
export function summarizeByCustomer(
  entries: (LedgerEntry & { customerId: string })[],
): CustomerUdharSummary[] {
  const byCustomer = new Map<string, (LedgerEntry & { customerId: string })[]>();
  for (const e of entries) {
    const list = byCustomer.get(e.customerId) ?? [];
    list.push(e);
    byCustomer.set(e.customerId, list);
  }
  return [...byCustomer.entries()].map(([customerId, es]) => ({
    customerId,
    balance: udharBalance(es),
    oldestUnsettledDebitDate: oldestUnsettledDebitDate(es),
    lastPaymentDate: lastPaymentDate(es),
  }));
}

/** Oldest-first (most critical to chase); ties broken by larger balance first; unaged (null) sorts last. */
export function sortByAgingThenAmount(rows: CustomerUdharSummary[]): CustomerUdharSummary[] {
  return rows.slice().sort((a, b) => {
    if (a.oldestUnsettledDebitDate == null && b.oldestUnsettledDebitDate == null) return b.balance - a.balance;
    if (a.oldestUnsettledDebitDate == null) return 1;
    if (b.oldestUnsettledDebitDate == null) return -1;
    if (a.oldestUnsettledDebitDate !== b.oldestUnsettledDebitDate) {
      return a.oldestUnsettledDebitDate - b.oldestUnsettledDebitDate;
    }
    return b.balance - a.balance;
  });
}

/** Shared guard for every new money-entry point in this module — reject NaN/0/negative before save. */
export function assertPositivePaise(amount: number): void {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Amount must be a positive number.');
  }
}
