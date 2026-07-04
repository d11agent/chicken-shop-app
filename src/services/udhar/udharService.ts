import { Q } from '@nozbe/watermelondb';
import type { Query } from '@nozbe/watermelondb';

import { database } from '../../db';
import { UdharEntry } from '../../db/models';
import { TableName, UdharEntryType, UdharStatus } from '../../db/constants';
import { udharBalance } from '../billing/calc';
import { assertPositivePaise, type LedgerEntry } from './udharCalc';

const udhar = () => database.get<UdharEntry>(TableName.udharEntries);

/** Full ledger history for one customer, newest first (for the statement screen). */
export function observeUdharEntriesForCustomer(customerId: string): Query<UdharEntry> {
  return udhar().query(Q.where('customer_id', customerId), Q.sortBy('created_at', Q.desc));
}

/** All ledger entries, oldest first — for the overview screen's client-side per-customer grouping. */
export function observeAllUdharEntries(): Query<UdharEntry> {
  return udhar().query(Q.sortBy('created_at', Q.asc));
}

/** UdharEntry.createdAt is a Date; the pure calc layer wants epoch ms. */
export function toLedgerEntry(e: UdharEntry): LedgerEntry & { customerId: string } {
  return {
    customerId: e.customerId,
    billId: e.billId,
    entryType: e.entryType,
    amount: e.amount,
    createdAt: e.createdAt.getTime(),
  };
}

/** Record a partial (or full, or over-) payment against a customer's udhar balance. */
export function recordPayment(customerId: string, amountPaise: number, note?: string): Promise<UdharEntry> {
  assertPositivePaise(amountPaise);
  return database.write(() =>
    udhar().create((e) => {
      e.customerId = customerId;
      e.entryType = UdharEntryType.payment;
      e.amount = Math.round(amountPaise);
      e.status = UdharStatus.active;
      e.note = note?.trim() || undefined;
    }),
  );
}

/** Write off bad debt, up to the current outstanding balance. Never deletes anything. */
export function writeOffUdhar(customerId: string, amountPaise: number, reason?: string): Promise<UdharEntry> {
  assertPositivePaise(amountPaise);
  return database.write(async () => {
    const entries = await udhar().query(Q.where('customer_id', customerId)).fetch();
    const balance = udharBalance(entries);
    if (amountPaise > balance) {
      throw new Error('Cannot write off more than the outstanding balance.');
    }
    return udhar().create((e) => {
      e.customerId = customerId;
      e.entryType = UdharEntryType.writeoff;
      e.amount = Math.round(amountPaise);
      e.status = UdharStatus.writtenOff;
      e.note = reason?.trim() || undefined;
    });
  });
}

/**
 * Reverse a write-off (the customer unexpectedly paid after all). Appends a
 * writeoff_reversal entry and flips the original entry's display-only status back to
 * active — never deletes or mutates its amount/entryType. Re-fetches the row inside
 * the writer to close a double-tap race on the "already reversed" guard.
 */
export function reverseWriteOff(writeoffEntry: UdharEntry): Promise<UdharEntry> {
  if (writeoffEntry.entryType !== UdharEntryType.writeoff || writeoffEntry.status !== UdharStatus.writtenOff) {
    throw new Error('This entry is not an active write-off — it may already be reversed.');
  }
  return database.write(async () => {
    const fresh = await udhar().find(writeoffEntry.id);
    if (fresh.entryType !== UdharEntryType.writeoff || fresh.status !== UdharStatus.writtenOff) {
      throw new Error('This entry is not an active write-off — it may already be reversed.');
    }
    await fresh.update((e) => {
      e.status = UdharStatus.active;
    });
    return udhar().create((e) => {
      e.customerId = fresh.customerId;
      e.entryType = UdharEntryType.writeoffReversal;
      e.amount = fresh.amount;
      e.status = UdharStatus.active;
      e.note = 'Reversal of write-off';
    });
  });
}
