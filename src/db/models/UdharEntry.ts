import { Model } from '@nozbe/watermelondb';
import { field, text, readonly, date, relation } from '@nozbe/watermelondb/decorators';
import type { Relation } from '@nozbe/watermelondb';
import type Customer from './Customer';
import type Bill from './Bill';
import type { UdharEntryType, UdharStatus } from '../constants';

/**
 * 4.4 Udhar (credit) ledger entry. APPEND-ONLY — never mutate to represent settlement.
 * Balance = SUM(debit) - SUM(payment) - SUM(writeoff). A payment's createdAt is its "paid date".
 */
export default class UdharEntry extends Model {
  static table = 'udhar_entries';
  static associations = {
    customers: { type: 'belongs_to', key: 'customer_id' },
    bills: { type: 'belongs_to', key: 'bill_id' },
  } as const;

  @field('customer_id') customerId!: string;
  @field('bill_id') billId?: string;
  @field('entry_type') entryType!: UdharEntryType;
  @field('amount') amount!: number; // paise, always positive
  @field('status') status!: UdharStatus; // display hint only
  @text('note') note?: string;
  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;

  @relation('customers', 'customer_id') customer!: Relation<Customer>;
  @relation('bills', 'bill_id') bill!: Relation<Bill>;
}
