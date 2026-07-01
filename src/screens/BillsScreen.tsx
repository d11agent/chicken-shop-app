import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../navigation/RootNavigator';
import { useObservedQuery } from '../hooks/useObservedQuery';
import { observeBills } from '../services/billing/billService';
import { BillStatus } from '../db/constants';
import { formatPaise } from '../services/currency';
import { formatIst } from '../services/time';
import type { Bill } from '../db/models';

const STATUS_STYLE: Record<string, { bg: string; fg: string; label: string }> = {
  [BillStatus.draft]: { bg: '#fff4e5', fg: '#b26a00', label: 'Draft' },
  [BillStatus.confirmed]: { bg: '#e7f5e9', fg: '#2e7d32', label: 'Confirmed' },
  [BillStatus.voided]: { bg: '#fdeaea', fg: '#c0392b', label: 'Voided' },
};

type Props = NativeStackScreenProps<RootStackParamList, 'Bills'>;

export default function BillsScreen({ navigation }: Props) {
  const bills = useObservedQuery<Bill>(() => observeBills(100), []);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {bills.length === 0 ? <Text style={styles.muted}>No bills yet.</Text> : null}
      {bills.map((bill) => {
        const s = STATUS_STYLE[bill.status] ?? STATUS_STYLE[BillStatus.draft];
        return (
          <Pressable
            key={bill.id}
            style={styles.row}
            onPress={() => navigation.navigate('BillDetail', { billId: bill.id })}
          >
            <View style={styles.rowMain}>
              <Text style={styles.total}>{formatPaise(bill.total)}</Text>
              <Text style={styles.time}>{formatIst(bill.createdAt.getTime())}</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: s.bg }]}>
              <Text style={[styles.badgeText, { color: s.fg }]}>{s.label}</Text>
            </View>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 16 },
  muted: { color: '#aaa', fontStyle: 'italic', textAlign: 'center', marginTop: 40 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  rowMain: { flex: 1 },
  total: { fontSize: 17, fontWeight: '700', color: '#222' },
  time: { fontSize: 12, color: '#999', marginTop: 2 },
  badge: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 12 },
  badgeText: { fontSize: 12, fontWeight: '700' },
});
