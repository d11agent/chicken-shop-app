import { Model } from '@nozbe/watermelondb';
import { field, text, readonly, date, children } from '@nozbe/watermelondb/decorators';
import type { Query } from '@nozbe/watermelondb';
import type Bill from './Bill';
import type UdharEntry from './UdharEntry';

/** 4.3 Customer. Phone optional for cash bills, mandatory once any udhar > 0 (enforced in services). */
export default class Customer extends Model {
  static table = 'customers';
  static associations = {
    bills: { type: 'has_many', foreignKey: 'customer_id' },
    udhar_entries: { type: 'has_many', foreignKey: 'customer_id' },
  } as const;

  @text('name') name!: string;
  @text('phone') phone?: string;
  @text('tag') tag?: string;
  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;

  @children('bills') bills!: Query<Bill>;
  @children('udhar_entries') udharEntries!: Query<UdharEntry>;
}
