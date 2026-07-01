import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../navigation/RootNavigator';
import { useObservedQuery } from '../hooks/useObservedQuery';
import {
  observeBillById,
  observeLines,
  observeSplits,
  voidBill,
  voidAndRecreate,
} from '../services/billing/billService';
import { BillStatus, UnitType } from '../db/constants';
import { formatPaise } from '../services/currency';
import { formatIst } from '../services/time';
import type { Bill, BillLineItem, PaymentSplit } from '../db/models';

type Props = NativeStackScreenProps<RootStackParamList, 'BillDetail'>;

export default function BillDetailScreen({ route, navigation }: Props) {
  const { billId } = route.params;
  const bills = useObservedQuery<Bill>(() => observeBillById(billId), [billId]);
  const lines = useObservedQuery<BillLineItem>(() => observeLines(billId), [billId]);
  const splits = useObservedQuery<PaymentSplit>(() => observeSplits(billId), [billId]);
  const [busy, setBusy] = useState(false);

  const bill = bills[0];
  if (!bill) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>Bill not found.</Text>
      </View>
    );
  }

  const doVoid = () => {
    Alert.alert('Void this bill?', 'The bill is kept for audit but marked voided.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Void',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await voidBill(bill, 'Voided from bill detail');
          } catch (e) {
            Alert.alert('Error', e instanceof Error ? e.message : String(e));
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  const doVoidRecreate = async () => {
    setBusy(true);
    try {
      const draft = await voidAndRecreate(bill, 'Correction: void + recreate');
      navigation.navigate('Billing', { draftBillId: draft.id });
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.total}>{formatPaise(bill.total)}</Text>
      <Text style={styles.meta}>
        {bill.status.toUpperCase()} · {formatIst(bill.createdAt.getTime())}
      </Text>
      {bill.replacesBillId ? <Text style={styles.replaces}>Replaces a voided bill</Text> : null}
      {bill.voidReason ? <Text style={styles.replaces}>Void reason: {bill.voidReason}</Text> : null}

      <Text style={styles.section}>Items</Text>
      {lines.map((l) => (
        <View key={l.id} style={styles.line}>
          <Text style={styles.lineName}>
            {l.itemName}
            {l.mode === UnitType.qty && l.quantity != null ? `  ×${l.quantity}` : ''}
          </Text>
          <Text style={styles.lineAmt}>{formatPaise(l.lineTotal)}</Text>
        </View>
      ))}

      {splits.length > 0 ? (
        <>
          <Text style={styles.section}>Payment</Text>
          {splits.map((s) => (
            <View key={s.id} style={styles.line}>
              <Text style={styles.lineName}>{s.mode}</Text>
              <Text style={styles.lineAmt}>{formatPaise(s.amount)}</Text>
            </View>
          ))}
        </>
      ) : null}

      {bill.status === BillStatus.draft ? (
        <Pressable
          style={[styles.btn, styles.btnPrimary]}
          disabled={busy}
          onPress={() => navigation.navigate('Billing', { draftBillId: bill.id })}
        >
          <Text style={styles.btnPrimaryText}>Continue editing draft</Text>
        </Pressable>
      ) : null}

      {bill.status === BillStatus.confirmed ? (
        <View style={styles.actions}>
          <Pressable style={[styles.btn, styles.btnPrimary]} disabled={busy} onPress={doVoidRecreate}>
            <Text style={styles.btnPrimaryText}>Void & Recreate</Text>
          </Pressable>
          <Pressable style={[styles.btn, styles.btnDanger]} disabled={busy} onPress={doVoid}>
            <Text style={styles.btnDangerText}>Void only</Text>
          </Pressable>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 20 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  muted: { color: '#aaa' },
  total: { fontSize: 34, fontWeight: '800', color: '#b8320f' },
  meta: { fontSize: 13, color: '#888', marginTop: 4 },
  replaces: { fontSize: 12, color: '#c0392b', marginTop: 4 },
  section: { fontSize: 13, fontWeight: '700', color: '#888', marginTop: 24, marginBottom: 8, textTransform: 'uppercase' },
  line: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f2f2f2' },
  lineName: { fontSize: 15, color: '#333' },
  lineAmt: { fontSize: 15, fontWeight: '600', color: '#333' },
  actions: { gap: 10, marginTop: 28 },
  btn: { paddingVertical: 15, borderRadius: 12, alignItems: 'center' },
  btnPrimary: { backgroundColor: '#b8320f', marginTop: 28 },
  btnPrimaryText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  btnDanger: { borderWidth: 1, borderColor: '#c0392b' },
  btnDangerText: { color: '#c0392b', fontWeight: '700', fontSize: 15 },
});
