import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../navigation/RootNavigator';
import { seedMenuIfEmpty } from '../services/menu/seed';
import { formatIst } from '../services/time';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

const TILES: { label: string; screen: keyof RootStackParamList; hint: string }[] = [
  { label: '🧾  New Bill', screen: 'Billing', hint: 'Quick billing — cash / online / udhar' },
  { label: '📋  Bills', screen: 'Bills', hint: 'Recent bills · void + recreate' },
  { label: '🍗  Menu & Prices', screen: 'Menu', hint: 'Edit items and default prices' },
];

export default function HomeScreen({ navigation }: Props) {
  const [seedNote, setSeedNote] = useState<string | null>(null);

  useEffect(() => {
    seedMenuIfEmpty()
      .then((seeded) => seeded && setSeedNote('Default menu loaded — edit prices in Menu.'))
      .catch((e) => setSeedNote(`Menu seed failed: ${e instanceof Error ? e.message : e}`));
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.time}>{formatIst(Date.now())} IST</Text>

      <View style={styles.tiles}>
        {TILES.map((t) => (
          <Pressable
            key={t.screen}
            style={({ pressed }) => [styles.tile, pressed && styles.tilePressed]}
            onPress={() => navigation.navigate(t.screen as 'Billing')}
          >
            <Text style={styles.tileLabel}>{t.label}</Text>
            <Text style={styles.tileHint}>{t.hint}</Text>
          </Pressable>
        ))}
      </View>

      {seedNote ? <Text style={styles.note}>{seedNote}</Text> : null}
      <StatusBar style="light" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 20 },
  time: { fontSize: 12, color: '#999', marginBottom: 16, textAlign: 'right' },
  tiles: { gap: 14 },
  tile: { backgroundColor: '#fff3ef', borderRadius: 14, padding: 20, borderWidth: 1, borderColor: '#f0d2c8' },
  tilePressed: { opacity: 0.6 },
  tileLabel: { fontSize: 20, fontWeight: '700', color: '#b8320f' },
  tileHint: { fontSize: 13, color: '#8a6a60', marginTop: 4 },
  note: { marginTop: 20, fontSize: 12, color: '#2e7d32', textAlign: 'center' },
});
