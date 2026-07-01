import { useEffect, useState } from 'react';
import type { Model, Query } from '@nozbe/watermelondb';

/**
 * Subscribe a component to a WatermelonDB query so the UI updates reactively as
 * the local database changes. Pass a factory + deps (like useEffect).
 */
export function useObservedQuery<T extends Model>(
  makeQuery: () => Query<T>,
  deps: unknown[] = [],
): T[] {
  const [records, setRecords] = useState<T[]>([]);
  useEffect(() => {
    const sub = makeQuery().observe().subscribe(setRecords);
    return () => sub.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return records;
}
