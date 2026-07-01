import { Model } from '@nozbe/watermelondb';
import { field, text, readonly, date, children } from '@nozbe/watermelondb/decorators';
import type { Query } from '@nozbe/watermelondb';
import type BillLineItem from './BillLineItem';
import type { UnitType } from '../constants';

/** 4.2 Menu item with a persistent default price (paise) and default entry mode. */
export default class MenuItem extends Model {
  static table = 'menu_items';
  static associations = {
    bill_line_items: { type: 'has_many', foreignKey: 'menu_item_id' },
  } as const;

  @text('name') name!: string;
  @field('default_price') defaultPrice!: number; // paise per unit
  @field('unit_type') unitType!: UnitType;
  @field('active') active!: boolean;
  @field('sort_order') sortOrder!: number;
  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;

  @children('bill_line_items') lineItems!: Query<BillLineItem>;
}
