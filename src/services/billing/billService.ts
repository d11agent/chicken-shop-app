import { Q } from '@nozbe/watermelondb';
import type { Query } from '@nozbe/watermelondb';

import { database } from '../../db';
import { Bill, BillLineItem, PaymentSplit, UdharEntry, Customer } from '../../db/models';
import {
  TableName,
  BillStatus,
  UdharEntryType,
  UdharStatus,
} from '../../db/constants';
import { computeLineTotal, udharPortion, validateBill } from './calc';
import type { DraftLineInput, ConfirmBillInput } from './types';

const bills = () => database.get<Bill>(TableName.bills);
const lineItems = () => database.get<BillLineItem>(TableName.billLineItems);
const splits = () => database.get<PaymentSplit>(TableName.paymentSplits);
const udhar = () => database.get<UdharEntry>(TableName.udharEntries);
const customers = () => database.get<Customer>(TableName.customers);

// ---------- queries ----------

/** Recent bills, newest first. */
export function observeBills(limit = 100): Query<Bill> {
  return bills().query(Q.sortBy('created_at', Q.desc), Q.take(limit));
}

export function getBill(id: string): Promise<Bill> {
  return bills().find(id);
}

export function observeLines(billId: string): Query<BillLineItem> {
  return lineItems().query(Q.where('bill_id', billId), Q.sortBy('sort_order', Q.asc));
}

/** Reactive single-bill query (WatermelonDB has no observe-by-id, so filter by id). */
export function observeBillById(billId: string): Query<Bill> {
  return bills().query(Q.where('id', billId));
}

export function observeSplits(billId: string): Query<PaymentSplit> {
  return splits().query(Q.where('bill_id', billId));
}

// ---------- draft editing ----------

/** Start a new freely-editable draft bill. */
export function createDraftBill(customerId?: string): Promise<Bill> {
  return database.write(async () =>
    bills().create((b) => {
      b.status = BillStatus.draft;
      b.total = 0;
      b.customerId = customerId;
    }),
  );
}

function assertDraft(bill: Bill): void {
  if (bill.status !== BillStatus.draft) {
    throw new Error('Bill is locked — confirmed bills can only be voided + recreated.');
  }
}

/** Recompute and persist a draft's total from its current line items. Call inside a writer. */
async function syncDraftTotal(bill: Bill): Promise<void> {
  const lines = await bill.lineItems.fetch();
  const total = lines.reduce((sum, l) => sum + l.lineTotal, 0);
  await bill.update((b) => {
    b.total = total;
  });
}

/** Add a line to a draft. Freezes item name + unit price snapshot at add time. */
export function addLineToDraft(bill: Bill, input: DraftLineInput): Promise<BillLineItem> {
  assertDraft(bill);
  const lineTotal = computeLineTotal(input); // validates inputs, throws on bad data
  return database.write(async () => {
    const count = await bill.lineItems.fetchCount();
    const line = await lineItems().create((l) => {
      l.billId = bill.id;
      l.menuItemId = input.menuItemId;
      l.itemName = input.itemName;
      l.mode = input.mode;
      l.quantity = input.quantity;
      l.unitPriceSnapshot = input.unitPrice;
      l.lineTotal = lineTotal;
      l.sortOrder = count * 10;
    });
    await syncDraftTotal(bill);
    return line;
  });
}

/** Remove a line from a draft. */
export function removeDraftLine(line: BillLineItem): Promise<void> {
  return database.write(async () => {
    const bill = await line.bill.fetch();
    if (!bill) throw new Error('Line has no parent bill.');
    assertDraft(bill);
    await line.markAsDeleted();
    await syncDraftTotal(bill);
  });
}

/**
 * Replace all of a draft's lines with a new set (used by the billing UI, which
 * builds the cart in local state for copy-pen speed, then persists on confirm).
 */
export function setDraftLines(bill: Bill, inputs: DraftLineInput[]): Promise<void> {
  assertDraft(bill);
  const computed = inputs.map((input) => ({ input, lineTotal: computeLineTotal(input) }));
  return database.write(async () => {
    const existing = await bill.lineItems.fetch();
    await database.batch(
      ...existing.map((l) => l.prepareMarkAsDeleted()),
      ...computed.map(({ input, lineTotal }, i) =>
        lineItems().prepareCreate((l) => {
          l.billId = bill.id;
          l.menuItemId = input.menuItemId;
          l.itemName = input.itemName;
          l.mode = input.mode;
          l.quantity = input.quantity;
          l.unitPriceSnapshot = input.unitPrice;
          l.lineTotal = lineTotal;
          l.sortOrder = i * 10;
        }),
      ),
    );
    const total = computed.reduce((sum, c) => sum + c.lineTotal, 0);
    await bill.update((b) => {
      b.total = total;
    });
  });
}

/** Set / clear the customer on a draft. */
export function setDraftCustomer(bill: Bill, customerId?: string): Promise<Bill> {
  assertDraft(bill);
  return database.write(async () =>
    bill.update((b) => {
      b.customerId = customerId;
    }),
  );
}

/** Delete a draft entirely (only drafts — confirmed bills are immutable). */
export function discardDraft(bill: Bill): Promise<void> {
  assertDraft(bill);
  return database.write(async () => {
    const lines = await bill.lineItems.fetch();
    await Promise.all(lines.map((l) => l.markAsDeleted()));
    await bill.markAsDeleted();
  });
}

// ---------- confirm (lock) ----------

/**
 * Confirm a draft: validates payments, locks the bill, writes payment splits, and
 * appends a udhar debit entry if any amount is on credit. Atomic — a validation
 * failure aborts the whole transaction so no partial state is written.
 */
export function confirmBill(bill: Bill, input: ConfirmBillInput): Promise<Bill> {
  assertDraft(bill);
  return database.write(async () => {
    const lines = await bill.lineItems.fetch();
    if (lines.length === 0) throw new Error('Cannot confirm an empty bill.');
    const total = lines.reduce((sum, l) => sum + l.lineTotal, 0);

    const customer: Customer | null = bill.customerId
      ? await customers().find(bill.customerId)
      : null;
    const customerHasPhone = Boolean(customer?.phone);

    const check = validateBill({ total, splits: input.splits, customerHasPhone });
    if (!check.ok) throw new Error(check.errors.join(' '));

    await bill.update((b) => {
      b.status = BillStatus.confirmed;
      b.total = total;
      b.confirmedAt = new Date();
      if (input.note !== undefined) b.note = input.note;
    });

    const positiveSplits = input.splits.filter((s) => s.amount > 0);
    await database.batch(
      ...positiveSplits.map((s) =>
        splits().prepareCreate((row) => {
          row.billId = bill.id;
          row.mode = s.mode;
          row.amount = s.amount;
        }),
      ),
    );

    const credit = udharPortion(input.splits);
    if (credit > 0) {
      // requiresPhone already enforced above, so customer + phone are present here.
      await udhar().create((e) => {
        e.customerId = bill.customerId as string;
        e.billId = bill.id;
        e.entryType = UdharEntryType.debit;
        e.amount = credit;
        e.status = UdharStatus.active;
      });
    }

    return bill;
  });
}

// ---------- void + recreate ----------

/**
 * Void a confirmed bill. Line items and payment splits are preserved (audit trail);
 * any udhar debit is cancelled by appending a void_reversal entry (append-only, the
 * ledger balance stays correct without mutating history).
 */
export function voidBill(bill: Bill, reason?: string): Promise<Bill> {
  if (bill.status !== BillStatus.confirmed) {
    throw new Error('Only confirmed bills can be voided.');
  }
  return database.write(async () => {
    await bill.update((b) => {
      b.status = BillStatus.voided;
      b.voidedAt = new Date();
      if (reason) b.voidReason = reason;
    });

    const debits = await udhar()
      .query(
        Q.where('bill_id', bill.id),
        Q.where('entry_type', UdharEntryType.debit),
        Q.where('status', UdharStatus.active),
      )
      .fetch();

    await database.batch(
      ...debits.map((d) =>
        udhar().prepareCreate((e) => {
          e.customerId = d.customerId;
          e.billId = bill.id;
          e.entryType = UdharEntryType.voidReversal;
          e.amount = d.amount;
          e.status = UdharStatus.active;
          e.note = 'Auto-reversal: bill voided';
        }),
      ),
    );

    return bill;
  });
}

/** Recreate a fresh editable draft from a voided bill, copying its frozen line snapshots. */
export function recreateBill(voidedBill: Bill): Promise<Bill> {
  if (voidedBill.status !== BillStatus.voided) {
    throw new Error('Only voided bills can be recreated.');
  }
  return database.write(async () => {
    const oldLines = await voidedBill.lineItems.fetch();
    const draft = await bills().create((b) => {
      b.status = BillStatus.draft;
      b.total = 0;
      b.customerId = voidedBill.customerId;
      b.replacesBillId = voidedBill.id;
    });

    await database.batch(
      ...oldLines.map((l) =>
        lineItems().prepareCreate((row) => {
          row.billId = draft.id;
          row.menuItemId = l.menuItemId;
          row.itemName = l.itemName;
          row.mode = l.mode;
          row.quantity = l.quantity;
          row.unitPriceSnapshot = l.unitPriceSnapshot;
          row.lineTotal = l.lineTotal;
          row.sortOrder = l.sortOrder;
        }),
      ),
    );

    const total = oldLines.reduce((sum, l) => sum + l.lineTotal, 0);
    await draft.update((b) => {
      b.total = total;
    });
    return draft;
  });
}

/** Convenience: void a bill and return a fresh draft copy to correct + reconfirm. */
export async function voidAndRecreate(bill: Bill, reason?: string): Promise<Bill> {
  const voided = await voidBill(bill, reason);
  return recreateBill(voided);
}
