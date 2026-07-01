import { Model } from '@nozbe/watermelondb';
import { field, text, readonly, date } from '@nozbe/watermelondb/decorators';

/** 4.8 Wastage / spoilage. Counted as a loss in net profit. */
export default class Wastage extends Model {
  static table = 'wastage';

  @text('item_name') itemName!: string;
  @field('unit_type') unitType!: string; // 'kg' | 'piece' | 'amount' | ...
  @field('quantity') quantity?: number; // float
  @field('amount') amount?: number; // paise — ₹ value of the loss
  @text('reason') reason?: string;
  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;
}
