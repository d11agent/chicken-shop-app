import { schemaMigrations } from '@nozbe/watermelondb/Schema/migrations';

/**
 * Schema migrations. Empty for v1 (initial schema).
 * When bumping `schema.version`, add a migration step here so existing local
 * databases upgrade in place without data loss (offline-first: never drop user data).
 */
export const migrations = schemaMigrations({
  migrations: [],
});
