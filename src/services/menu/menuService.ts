import { Q } from '@nozbe/watermelondb';
import type { Query } from '@nozbe/watermelondb';

import { database } from '../../db';
import { MenuItem } from '../../db/models';
import { TableName, UnitType } from '../../db/constants';

const menuCollection = () => database.get<MenuItem>(TableName.menuItems);

export interface MenuItemInput {
  name: string;
  defaultPrice: number; // paise
  unitType: UnitType;
  active?: boolean;
  sortOrder?: number;
}

/** Reactive query of menu items, optionally only active ones, ordered for display. */
export function observeMenuItems(activeOnly = false): Query<MenuItem> {
  const clauses = activeOnly ? [Q.where('active', true)] : [];
  return menuCollection().query(...clauses, Q.sortBy('sort_order', Q.asc));
}

/** One-shot fetch (non-reactive). */
export function listMenuItems(activeOnly = false): Promise<MenuItem[]> {
  return observeMenuItems(activeOnly).fetch();
}

/** Create a menu item. Price is a persistent default; per-bill overrides don't touch it. */
export function createMenuItem(input: MenuItemInput): Promise<MenuItem> {
  return database.write(async () => {
    const nextSort =
      input.sortOrder ?? (await menuCollection().query().fetchCount()) * 10;
    return menuCollection().create((m) => {
      m.name = input.name.trim();
      m.defaultPrice = input.defaultPrice;
      m.unitType = input.unitType;
      m.active = input.active ?? true;
      m.sortOrder = nextSort;
    });
  });
}

export interface MenuItemPatch {
  name?: string;
  defaultPrice?: number;
  unitType?: UnitType;
  active?: boolean;
  sortOrder?: number;
}

/** Update a menu item's persistent fields (e.g. shopkeeper changes the default price). */
export function updateMenuItem(item: MenuItem, patch: MenuItemPatch): Promise<MenuItem> {
  return database.write(async () =>
    item.update((m) => {
      if (patch.name !== undefined) m.name = patch.name.trim();
      if (patch.defaultPrice !== undefined) m.defaultPrice = patch.defaultPrice;
      if (patch.unitType !== undefined) m.unitType = patch.unitType;
      if (patch.active !== undefined) m.active = patch.active;
      if (patch.sortOrder !== undefined) m.sortOrder = patch.sortOrder;
    }),
  );
}

/** Soft enable/disable — items are never deleted so past bills keep their references. */
export function setMenuItemActive(item: MenuItem, active: boolean): Promise<MenuItem> {
  return updateMenuItem(item, { active });
}
