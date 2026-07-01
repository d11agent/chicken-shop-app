import { Model } from '@nozbe/watermelondb';
import { field, readonly, date, relation } from '@nozbe/watermelondb/decorators';
import type { Relation } from '@nozbe/watermelondb';
import type Bill from './Bill';
import type { PaymentMode } from '../constants';

/** 4.1 / 5b Payment split. Sum of a bill's splits equals its total (enforced in services). */
export default class PaymentSplit extends Model {
  static table = 'payment_splits';
  static associations = {
    bills: { type: 'belongs_to', key: 'bill_id' },
  } as const;

  @field('bill_id') billId!: string;
  @field('mode') mode!: PaymentMode;
  @field('amount') amount!: number; // paise
  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;

  @relation('bills', 'bill_id') bill!: Relation<Bill>;
}
