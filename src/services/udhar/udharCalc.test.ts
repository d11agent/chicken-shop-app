import {
  oldestUnsettledDebitDate,
  lastPaymentDate,
  agingFlag,
  advanceCredit,
  outstandingBalance,
  summarizeByCustomer,
  sortByAgingThenAmount,
  assertPositivePaise,
  AGING_YELLOW_DAYS,
  AGING_RED_DAYS,
  type LedgerEntry,
} from './udharCalc';
import { udharBalance } from '../billing/calc';
import { UdharEntryType } from '../../db/constants';

const DAY = 86_400_000;
const NOW = Date.parse('2026-07-04T00:00:00Z');
const daysAgo = (n: number) => NOW - n * DAY;

describe('oldestUnsettledDebitDate', () => {
  it('returns the debit date when nothing has been paid', () => {
    const entries: LedgerEntry[] = [{ entryType: UdharEntryType.debit, amount: 10000, createdAt: daysAgo(30) }];
    expect(oldestUnsettledDebitDate(entries)).toBe(daysAgo(30));
  });

  it('returns null once the debit is fully paid off', () => {
    const entries: LedgerEntry[] = [
      { entryType: UdharEntryType.debit, amount: 10000, createdAt: daysAgo(30) },
      { entryType: UdharEntryType.payment, amount: 10000, createdAt: daysAgo(2) },
    ];
    expect(oldestUnsettledDebitDate(entries)).toBeNull();
  });

  it('a partial payment does NOT advance the original debit date', () => {
    const entries: LedgerEntry[] = [
      { entryType: UdharEntryType.debit, amount: 10000, createdAt: daysAgo(90) },
      { entryType: UdharEntryType.payment, amount: 2000, createdAt: daysAgo(5) },
    ];
    expect(oldestUnsettledDebitDate(entries)).toBe(daysAgo(90));
  });

  it('consumes debits oldest-first: older paid off, newer remains', () => {
    const entries: LedgerEntry[] = [
      { entryType: UdharEntryType.debit, amount: 5000, createdAt: daysAgo(90) },
      { entryType: UdharEntryType.debit, amount: 5000, createdAt: daysAgo(10) },
      { entryType: UdharEntryType.payment, amount: 5000, createdAt: daysAgo(5) },
    ];
    expect(oldestUnsettledDebitDate(entries)).toBe(daysAgo(10));
  });

  it('older debit only partially paid still reports the older date', () => {
    const entries: LedgerEntry[] = [
      { entryType: UdharEntryType.debit, amount: 5000, createdAt: daysAgo(90) },
      { entryType: UdharEntryType.debit, amount: 5000, createdAt: daysAgo(10) },
      { entryType: UdharEntryType.payment, amount: 2000, createdAt: daysAgo(5) },
    ];
    expect(oldestUnsettledDebitDate(entries)).toBe(daysAgo(90));
  });

  it('nets a void_reversal against its own bill_id rather than FIFO-consuming the oldest debit', () => {
    const entries: LedgerEntry[] = [
      { entryType: UdharEntryType.debit, amount: 10000, createdAt: daysAgo(90), billId: 'bill-old' },
      { entryType: UdharEntryType.debit, amount: 10000, createdAt: daysAgo(1), billId: 'bill-new' },
      { entryType: UdharEntryType.voidReversal, amount: 10000, createdAt: daysAgo(1), billId: 'bill-new' },
    ];
    // bill-new was voided same-day; the real 90-day-old debt must still show as day 90, not day 1.
    expect(oldestUnsettledDebitDate(entries)).toBe(daysAgo(90));
  });

  it('a writeoff_reversal restores the original aging clock, not the reversal date', () => {
    const entries: LedgerEntry[] = [
      { entryType: UdharEntryType.debit, amount: 10000, createdAt: daysAgo(30) },
      { entryType: UdharEntryType.writeoff, amount: 10000, createdAt: daysAgo(10) },
      { entryType: UdharEntryType.writeoffReversal, amount: 10000, createdAt: daysAgo(5) },
    ];
    expect(oldestUnsettledDebitDate(entries)).toBe(daysAgo(30));
  });

  it('returns null when all debits are fully settled', () => {
    const entries: LedgerEntry[] = [
      { entryType: UdharEntryType.debit, amount: 5000, createdAt: daysAgo(30) },
      { entryType: UdharEntryType.debit, amount: 5000, createdAt: daysAgo(10) },
      { entryType: UdharEntryType.payment, amount: 10000, createdAt: daysAgo(1) },
    ];
    expect(oldestUnsettledDebitDate(entries)).toBeNull();
  });

  it('is non-null iff the ledger balance is positive (invariant, several scenarios)', () => {
    const scenarios: LedgerEntry[][] = [
      [{ entryType: UdharEntryType.debit, amount: 5000, createdAt: daysAgo(20) }],
      [
        { entryType: UdharEntryType.debit, amount: 5000, createdAt: daysAgo(20) },
        { entryType: UdharEntryType.payment, amount: 5000, createdAt: daysAgo(1) },
      ],
      [
        { entryType: UdharEntryType.debit, amount: 5000, createdAt: daysAgo(20) },
        { entryType: UdharEntryType.payment, amount: 8000, createdAt: daysAgo(1) }, // overpaid
      ],
      [
        { entryType: UdharEntryType.debit, amount: 5000, createdAt: daysAgo(20), billId: 'b1' },
        { entryType: UdharEntryType.voidReversal, amount: 5000, createdAt: daysAgo(19), billId: 'b1' },
      ],
      [
        { entryType: UdharEntryType.debit, amount: 5000, createdAt: daysAgo(20) },
        { entryType: UdharEntryType.writeoff, amount: 5000, createdAt: daysAgo(10) },
        { entryType: UdharEntryType.writeoffReversal, amount: 5000, createdAt: daysAgo(5) },
      ],
    ];
    for (const entries of scenarios) {
      const balance = udharBalance(entries);
      const oldest = oldestUnsettledDebitDate(entries);
      expect(oldest !== null).toBe(balance > 0);
    }
  });
});

describe('lastPaymentDate', () => {
  it('is null when there are no payments', () => {
    const entries: LedgerEntry[] = [{ entryType: UdharEntryType.debit, amount: 5000, createdAt: daysAgo(10) }];
    expect(lastPaymentDate(entries)).toBeNull();
  });

  it('returns the most recent payment, ignoring other entry types and aging', () => {
    const entries: LedgerEntry[] = [
      { entryType: UdharEntryType.debit, amount: 10000, createdAt: daysAgo(90) },
      { entryType: UdharEntryType.payment, amount: 1000, createdAt: daysAgo(40) },
      { entryType: UdharEntryType.payment, amount: 1000, createdAt: daysAgo(5) },
      { entryType: UdharEntryType.writeoff, amount: 500, createdAt: daysAgo(1) },
    ];
    expect(lastPaymentDate(entries)).toBe(daysAgo(5));
    // the customer is still "old" despite a recent payment
    expect(oldestUnsettledDebitDate(entries)).toBe(daysAgo(90));
  });
});

describe('agingFlag', () => {
  it('is none when there is no unsettled debit', () => {
    expect(agingFlag(null, NOW)).toBe('none');
  });

  it('is none just under the yellow threshold', () => {
    expect(agingFlag(NOW - (AGING_YELLOW_DAYS * DAY - 1), NOW)).toBe('none');
  });

  it('is yellow exactly at the yellow threshold and just under red', () => {
    expect(agingFlag(daysAgo(AGING_YELLOW_DAYS), NOW)).toBe('yellow');
    expect(agingFlag(daysAgo(AGING_RED_DAYS - 1), NOW)).toBe('yellow');
  });

  it('is red at and beyond the red threshold', () => {
    expect(agingFlag(daysAgo(AGING_RED_DAYS), NOW)).toBe('red');
    expect(agingFlag(daysAgo(AGING_RED_DAYS + 30), NOW)).toBe('red');
  });
});

describe('advanceCredit / outstandingBalance', () => {
  it('clamp positive balance to outstanding, zero advance credit', () => {
    expect(outstandingBalance(5000)).toBe(5000);
    expect(advanceCredit(5000)).toBe(0);
  });

  it('clamp negative balance to advance credit, zero outstanding', () => {
    expect(outstandingBalance(-5000)).toBe(0);
    expect(advanceCredit(-5000)).toBe(5000);
  });

  it('zero balance is settled either way', () => {
    expect(outstandingBalance(0)).toBe(0);
    expect(advanceCredit(0)).toBe(0);
  });
});

describe('overpayment -> advance credit -> automatic netting (requirement 5)', () => {
  it('an overpayment produces an advance credit', () => {
    const entries = [
      { entryType: UdharEntryType.debit, amount: 10000 },
      { entryType: UdharEntryType.payment, amount: 15000 },
    ];
    const balance = udharBalance(entries);
    expect(balance).toBe(-5000);
    expect(advanceCredit(balance)).toBe(5000);
  });

  it('a new debit automatically nets against existing advance credit (pure arithmetic, no special case)', () => {
    const entries = [
      { entryType: UdharEntryType.debit, amount: 10000 },
      { entryType: UdharEntryType.payment, amount: 15000 }, // -5000 advance credit
      { entryType: UdharEntryType.debit, amount: 3000 }, // new bill on udhar
    ];
    const balance = udharBalance(entries);
    expect(balance).toBe(-2000);
    expect(advanceCredit(balance)).toBe(2000);
    expect(outstandingBalance(balance)).toBe(0);
  });
});

describe('summarizeByCustomer', () => {
  it('keeps each customer independent, no cross-contamination', () => {
    const entries = [
      { customerId: 'a', entryType: UdharEntryType.debit, amount: 10000, createdAt: daysAgo(30) },
      { customerId: 'b', entryType: UdharEntryType.debit, amount: 4000, createdAt: daysAgo(5) },
      { customerId: 'a', entryType: UdharEntryType.payment, amount: 3000, createdAt: daysAgo(2) },
    ];
    const summaries = summarizeByCustomer(entries);
    const a = summaries.find((s) => s.customerId === 'a')!;
    const b = summaries.find((s) => s.customerId === 'b')!;
    expect(a.balance).toBe(7000);
    expect(a.oldestUnsettledDebitDate).toBe(daysAgo(30));
    expect(b.balance).toBe(4000);
    expect(b.oldestUnsettledDebitDate).toBe(daysAgo(5));
  });
});

describe('sortByAgingThenAmount', () => {
  it('sorts oldest-first, ties broken by larger balance first', () => {
    const rows = [
      { customerId: 'a', balance: 1000, oldestUnsettledDebitDate: daysAgo(20), lastPaymentDate: null },
      { customerId: 'b', balance: 3000, oldestUnsettledDebitDate: daysAgo(20), lastPaymentDate: null },
      { customerId: 'c', balance: 500, oldestUnsettledDebitDate: daysAgo(40), lastPaymentDate: null },
    ];
    expect(sortByAgingThenAmount(rows).map((r) => r.customerId)).toEqual(['c', 'b', 'a']);
  });

  it('sorts unaged (null) rows last', () => {
    const rows = [
      { customerId: 'a', balance: -1000, oldestUnsettledDebitDate: null, lastPaymentDate: null },
      { customerId: 'b', balance: 1000, oldestUnsettledDebitDate: daysAgo(5), lastPaymentDate: null },
    ];
    expect(sortByAgingThenAmount(rows).map((r) => r.customerId)).toEqual(['b', 'a']);
  });
});

describe('assertPositivePaise', () => {
  it('throws on zero, negative, NaN and infinite amounts', () => {
    expect(() => assertPositivePaise(0)).toThrow();
    expect(() => assertPositivePaise(-100)).toThrow();
    expect(() => assertPositivePaise(NaN)).toThrow();
    expect(() => assertPositivePaise(Infinity)).toThrow();
  });

  it('does not throw on a positive amount', () => {
    expect(() => assertPositivePaise(100)).not.toThrow();
  });
});

describe('write-off does not delete or mutate ledger data (pure-level proof)', () => {
  it('does not mutate its input entries array', () => {
    const entries: LedgerEntry[] = Object.freeze([
      { entryType: UdharEntryType.debit, amount: 5000, createdAt: daysAgo(30) },
      { entryType: UdharEntryType.writeoff, amount: 5000, createdAt: daysAgo(10) },
    ]) as unknown as LedgerEntry[];
    expect(() => udharBalance(entries)).not.toThrow();
    expect(() => oldestUnsettledDebitDate(entries)).not.toThrow();
    expect(() =>
      summarizeByCustomer(entries.map((e) => ({ ...e, customerId: 'a' }))),
    ).not.toThrow();
  });

  it('a writeoff followed by a writeoff_reversal restores the pre-writeoff balance without removing history', () => {
    const entries = [
      { entryType: UdharEntryType.debit, amount: 5000 },
      { entryType: UdharEntryType.writeoff, amount: 5000 },
    ];
    expect(udharBalance(entries)).toBe(0);
    const withReversal = [...entries, { entryType: UdharEntryType.writeoffReversal, amount: 5000 }];
    expect(udharBalance(withReversal)).toBe(5000); // owed again
    expect(withReversal).toHaveLength(3); // nothing spliced out — original writeoff entry still present
  });
});
