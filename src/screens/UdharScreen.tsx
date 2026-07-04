import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../navigation/RootNavigator';
import { useObservedQuery } from '../hooks/useObservedQuery';
import { observeAllUdharEntries, toLedgerEntry } from '../services/udhar/udharService';
import { observeCustomers, findOrCreateCustomer } from '../services/customer/customerService';
import {
  summarizeByCustomer,
  sortByAgingThenAmount,
  agingFlag,
  type CustomerUdharSummary,
} from '../services/udhar/udharCalc';
import { formatPaise } from '../services/currency';
import { formatIst } from '../services/time';
import type { UdharEntry, Customer } from '../db/models';

type Props = NativeStackScreenProps<RootStackParamList, 'Udhar'>;

const AGING_STYLE: Record<string, { bg: string; fg: string; label: string }> = {
  none: { bg: '#f2f2f2', fg: '#888', label: '' },
  yellow: { bg: '#fff4e5', fg: '#b26a00', label: '15+ days' },
  red: { bg: '#fdeaea', fg: '#c0392b', label: '60+ days' },
};

export default function UdharScreen({ navigation }: Props) {
  const entries = useObservedQuery<UdharEntry>(() => observeAllUdharEntries(), []);
  const customers = useObservedQuery<Customer>(() => observeCustomers(), []);
  const customerById = useMemo(() => new Map(customers.map((c) => [c.id, c])), [customers]);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);

  const summaries = useMemo(
    () => sortByAgingThenAmount(summarizeByCustomer(entries.map(toLedgerEntry))),
    [entries],
  );
  const pending = summaries.filter((s) => s.balance > 0);
  const advance = summaries.filter((s) => s.balance < 0);

  const startLedger = async () => {
    if (!name.trim() || !phone.trim()) {
      Alert.alert('Name and phone are required to open a ledger.');
      return;
    }
    setBusy(true);
    try {
      const customer = await findOrCreateCustomer({ name, phone });
      setName('');
      setPhone('');
      navigation.navigate('CustomerLedger', { customerId: customer.id });
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const renderRow = (s: CustomerUdharSummary) => {
    const customer = customerById.get(s.customerId);
    const flag = agingFlag(s.oldestUnsettledDebitDate);
    const style = AGING_STYLE[flag];
    return (
      <Pressable
        key={s.customerId}
        style={styles.row}
        onPress={() => navigation.navigate('CustomerLedger', { customerId: s.customerId })}
      >
        <View style={styles.rowMain}>
          <Text style={styles.name}>{customer?.name ?? 'Customer'}</Text>
          <Text style={styles.meta}>
            {customer?.phone ?? 'no phone'}
            {s.lastPaymentDate ? ` · last paid ${formatIst(s.lastPaymentDate)}` : ' · no payments yet'}
          </Text>
        </View>
        <View style={styles.rowEnd}>
          <Text style={[styles.amount, s.balance < 0 && styles.amountCredit]}>
            {formatPaise(Math.abs(s.balance))}
          </Text>
          {style.label ? (
            <View style={[styles.badge, { backgroundColor: style.bg }]}>
              <Text style={[styles.badgeText, { color: style.fg }]}>{style.label}</Text>
            </View>
          ) : null}
        </View>
      </Pressable>
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.section}>Find / start a customer's ledger</Text>
      <TextInput style={styles.input} placeholder="Name" value={name} onChangeText={setName} />
      <TextInput
        style={styles.input}
        placeholder="Phone (WhatsApp)"
        keyboardType="phone-pad"
        value={phone}
        onChangeText={setPhone}
      />
      <Pressable style={[styles.btn, styles.btnPrimary]} disabled={busy} onPress={startLedger}>
        <Text style={styles.btnPrimaryText}>Open ledger</Text>
      </Pressable>

      <Text style={styles.section}>Pending udhar · oldest first</Text>
      {pending.length === 0 ? (
        <Text style={styles.muted}>No pending udhar — nice!</Text>
      ) : (
        pending.map(renderRow)
      )}

      {advance.length > 0 ? (
        <>
          <Text style={styles.section}>Advance credit</Text>
          {advance.map(renderRow)}
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 16 },
  section: {
    fontSize: 13,
    fontWeight: '700',
    color: '#888',
    marginTop: 20,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  muted: { color: '#aaa', fontStyle: 'italic', textAlign: 'center', marginTop: 12 },
  input: { borderWidth: 1, borderColor: '#eee', borderRadius: 10, padding: 12, fontSize: 15, marginBottom: 10 },
  btn: { paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  btnPrimary: { backgroundColor: '#b8320f' },
  btnPrimaryText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  rowMain: { flex: 1 },
  rowEnd: { alignItems: 'flex-end' },
  name: { fontSize: 16, fontWeight: '700', color: '#222' },
  meta: { fontSize: 12, color: '#999', marginTop: 2 },
  amount: { fontSize: 16, fontWeight: '700', color: '#b8320f' },
  amountCredit: { color: '#2e7d32' },
  badge: { marginTop: 4, paddingVertical: 3, paddingHorizontal: 8, borderRadius: 10 },
  badgeText: { fontSize: 11, fontWeight: '700' },
});
