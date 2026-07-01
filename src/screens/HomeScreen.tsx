import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import { database } from '../db';
import { TableName } from '../db/constants';
import { formatIst } from '../services/time';

/**
 * Minimal foundation screen — verifies the WatermelonDB wiring is live by counting
 * rows in each table. Real billing/udhar screens replace this from Session B onward.
 */
export default function HomeScreen() {
  const [counts, setCounts] = useState<Record<string, number> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const names = Object.values(TableName);
        const results = await Promise.all(
          names.map((t) => database.get(t).query().fetchCount()),
        );
        if (mounted) {
          setCounts(Object.fromEntries(names.map((n, i) => [n, results[i]])));
        }
      } catch (e) {
        if (mounted) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🐔 Chicken Shop</Text>
      <Text style={styles.subtitle}>Offline-first · WatermelonDB ready</Text>
      <Text style={styles.time}>{formatIst(Date.now())} IST</Text>

      {error ? (
        <Text style={styles.error}>DB error: {error}</Text>
      ) : counts ? (
        <View style={styles.table}>
          {Object.entries(counts).map(([name, n]) => (
            <Text key={name} style={styles.row}>
              {name}: {n}
            </Text>
          ))}
        </View>
      ) : (
        <Text style={styles.subtitle}>Connecting to local database…</Text>
      )}

      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { fontSize: 28, fontWeight: '700', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#666', marginBottom: 8 },
  time: { fontSize: 12, color: '#999', marginBottom: 20 },
  table: { alignSelf: 'stretch', gap: 4 },
  row: { fontSize: 14, color: '#333', fontVariant: ['tabular-nums'] },
  error: { color: '#c0392b', textAlign: 'center' },
});
