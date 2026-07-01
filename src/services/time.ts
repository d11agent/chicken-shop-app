/**
 * Time helpers. Store UTC epoch ms everywhere; display in IST (Asia/Kolkata, UTC+5:30).
 * Offline entries use device time and are corrected on sync (Session G).
 */

const IST_OFFSET_MINUTES = 5 * 60 + 30; // +05:30

/** Current UTC epoch milliseconds — the canonical stored timestamp. */
export function nowUtcMs(): number {
  return Date.now();
}

/** IST day key 'YYYY-MM-DD' for a given UTC ms (used for cash_summary.date_key). */
export function istDateKey(utcMs: number = Date.now()): string {
  const ist = new Date(utcMs + IST_OFFSET_MINUTES * 60_000);
  const y = ist.getUTCFullYear();
  const m = String(ist.getUTCMonth() + 1).padStart(2, '0');
  const d = String(ist.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Human display of a UTC ms timestamp in IST, e.g. "01 Jul 2026, 09:13 PM". */
export function formatIst(utcMs: number): string {
  return new Date(utcMs).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}
