import { Model } from '@nozbe/watermelondb';
import { field, text, readonly, date, relation, children } from '@nozbe/watermelondb/decorators';
import type { Query, Relation } from '@nozbe/watermelondb';
import type Customer from './Customer';
import type BillLineItem from './BillLineItem';
import type PaymentSplit from './PaymentSplit';
import type UdharEntry from './UdharEntry';
import type { BillStatus } from '../constants';

/** 4.1 Bill header. draft -> confirmed (locked) -> voided. Post-confirm fix = void + recreate. */
export default class Bill extends Model {
  static table = 'bills';
  static associations = {
    customers: { type: 'belongs_to', key: 'customer_id' },
    bill_line_items: { type: 'has_many', foreignKey: 'bill_id' },
    payment_splits: { type: 'has_many', foreignKey: 'bill_id' },
    udhar_entries: { type: 'has_many', foreignKey: 'bill_id' },
  } as const;

  @field('customer_id') customerId?: string;
  @field('status') status!: BillStatus;
  @field('total') total!: number; // paise, frozen at confirm
  @text('note') note?: string;
  @field('replaces_bill_id') replacesBillId?: string; // void+recreate audit link
  @text('void_reason') voidReason?: string;
  @date('confirmed_at') confirmedAt?: Date;
  @date('voided_at') voidedAt?: Date;
  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;

  @relation('customers', 'customer_id') customer!: Relation<Customer>;
  @children('bill_line_items') lineItems!: Query<BillLineItem>;
  @children('payment_splits') paymentSplits!: Query<PaymentSplit>;
  @children('udhar_entries') udharEntries!: Query<UdharEntry>;
}
