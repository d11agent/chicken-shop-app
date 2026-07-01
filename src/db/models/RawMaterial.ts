import { Model } from '@nozbe/watermelondb';
import { field, text, readonly, date } from '@nozbe/watermelondb/decorators';

/** 4.7 Raw material purchase (bulk). Multiple same-day purchases = separate entries. */
export default class RawMaterial extends Model {
  static table = 'raw_material';

  @text('item_name') itemName!: string;
  @field('unit_type') unitType!: string; // 'kg' | 'piece' | 'bunch' | 'amount' | ...
  @field('quantity') quantity?: number; // float
  @field('amount') amount!: number; // paise — cost of this purchase
  @text('note') note?: string;
  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;
}
