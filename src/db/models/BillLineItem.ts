import { Model } from '@nozbe/watermelondb';
import { field, text, readonly, date, relation } from '@nozbe/watermelondb/decorators';
import type { Relation } from '@nozbe/watermelondb';
import type Bill from './Bill';
import type MenuItem from './MenuItem';
import type { UnitType } from '../constants';

/** 4.1 Bill line item with frozen name + price snapshot. line_total is authoritative (paise). */
export default class BillLineItem extends Model {
  static table = 'bill_line_items';
  static associations = {
    bills: { type: 'belongs_to', key: 'bill_id' },
    menu_items: { type: 'belongs_to', key: 'menu_item_id' },
  } as const;

  @field('bill_id') billId!: string;
  @field('menu_item_id') menuItemId?: string;
  @text('item_name') itemName!: string; // frozen snapshot
  @field('mode') mode!: UnitType;
  @field('quantity') quantity?: number; // float kg/pcs (qty mode)
  @field('unit_price_snapshot') unitPriceSnapshot?: number; // paise/unit (qty mode)
  @field('line_total') lineTotal!: number; // paise
  @field('sort_order') sortOrder!: number;
  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;

  @relation('bills', 'bill_id') bill!: Relation<Bill>;
  @relation('menu_items', 'menu_item_id') menuItem!: Relation<MenuItem>;
}
