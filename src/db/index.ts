import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';

import { schema } from './schema';
import { migrations } from './migrations';
import {
  MenuItem,
  Customer,
  Bill,
  BillLineItem,
  PaymentSplit,
  UdharEntry,
  CashSummary,
  RawMaterial,
  Wastage,
} from './models';

/**
 * Offline-first source of truth (CLAUDE.md data-path rule).
 * SQLite via WatermelonDB with JSI enabled (native config wired by
 * @morrowdigital/watermelondb-expo-plugin). Requires a dev build — NOT Expo Go.
 */
const adapter = new SQLiteAdapter({
  schema,
  migrations,
  jsi: true,
  dbName: 'chickenshop',
  onSetUpError: (error) => {
    // Surfacing here is intentional — a failed local DB is fatal for an offline-first app.
    // eslint-disable-next-line no-console
    console.error('[WatermelonDB] setup error:', error);
  },
});

export const database = new Database({
  adapter,
  modelClasses: [
    MenuItem,
    Customer,
    Bill,
    BillLineItem,
    PaymentSplit,
    UdharEntry,
    CashSummary,
    RawMaterial,
    Wastage,
  ],
});

export default database;
