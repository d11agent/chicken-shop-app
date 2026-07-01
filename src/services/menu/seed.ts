import { database } from '../../db';
import { MenuItem } from '../../db/models';
import { TableName, UnitType, type UnitType as UnitTypeT } from '../../db/constants';

/**
 * PLACEHOLDER default menu for a chicken shop. Prices (in paise) are reasonable
 * defaults ONLY — the real menu + pricing is still to be captured from the shop
 * (see PROGRESS.md). The shopkeeper edits these in the Menu screen; prices persist.
 */
export const DEFAULT_MENU: {
  name: string;
  defaultPrice: number; // paise
  unitType: UnitTypeT;
}[] = [
  { name: 'Chicken (Curry Cut)', defaultPrice: 24000, unitType: UnitType.qty },
  { name: 'Chicken (Boneless)', defaultPrice: 32000, unitType: UnitType.qty },
  { name: 'Whole Chicken (Live wt.)', defaultPrice: 15000, unitType: UnitType.qty },
  { name: 'Chicken Legs', defaultPrice: 26000, unitType: UnitType.qty },
  { name: 'Chicken Kaleji (Liver)', defaultPrice: 20000, unitType: UnitType.qty },
  { name: 'Eggs (per piece)', defaultPrice: 700, unitType: UnitType.qty },
  { name: 'Masala / Extra', defaultPrice: 0, unitType: UnitType.amount },
  { name: 'Packing', defaultPrice: 0, unitType: UnitType.amount },
];

/** Idempotent: seeds the default menu only when the table is empty. Safe to call on launch. */
export async function seedMenuIfEmpty(): Promise<boolean> {
  const collection = database.get<MenuItem>(TableName.menuItems);
  const existing = await collection.query().fetchCount();
  if (existing > 0) return false;

  await database.write(async () => {
    const rows = DEFAULT_MENU.map((item, i) =>
      collection.prepareCreate((m) => {
        m.name = item.name;
        m.defaultPrice = item.defaultPrice;
        m.unitType = item.unitType;
        m.active = true;
        m.sortOrder = i * 10;
      }),
    );
    await database.batch(...rows);
  });
  return true;
}
