import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../navigation/RootNavigator';
import { useObservedQuery } from '../hooks/useObservedQuery';
import { observeCustomerById } from '../services/customer/customerService';
import {
  observeUdharEntriesForCustomer,
  toLedgerEntry,
  recordPayment,
  writeOffUdhar,
  reverseWriteOff,
} from '../services/udhar/udharService';
import {
  oldestUnsettledDebitDate,
  lastPaymentDate,
  agingFlag,
  advanceCredit,
  outstandingBalance,
} from '../services/udhar/udharCalc';
import { udharBalance } from '../services/billing/calc';
import { UdharEntryType, UdharStatus } from '../db/constants';
import { formatPaise, rupeesToPaise, paiseToRupees, sanitizeDecimalInput } from '../services/currency';
import { formatIst } from '../services/time';
import type { Customer, UdharEntry } from '../db/models';

type Props = NativeStackScreenProps<RootStackParamList, 'CustomerLedger'>;

const ENTRY_STYLE: Record<string, { fg: string; label: string; sign: string }> = {
  [UdharEntryType.debit]: { fg: '#c0392b', label: 'Udhar taken', sign: '+' },
  [UdharEntryType.payment]: { fg: '#2e7d32', label: 'Payment', sign: '-' },
  [UdharEntryType.writeoff]: { fg: '#8a6a60', label: 'Written off', sign: '-' },
  [UdharEntryType.voidReversal]: { fg: '#888', label: 'Void reversal', sign: '-' },
  [UdharEntryType.writeoffReversal]: { fg: '#b26a00', label: 'Write-off reversed', sign: '+' },
};

const AGING_STYLE: Record<string, { bg: string; fg: string; label: string }> = {
  none: { bg: '#f2f2f2', fg: '#888', label: 'Current' },
  yellow: { bg: '#fff4e5', fg: '#b26a00', label: '15+ days' },
  red: { bg: '#fdeaea', fg: '#c0392b', label: '60+ days' },
};

/** Parse a rupee text field into paise; blank or unparsable -> NaN (never silently 0). */
function parsePaise(raw: string): number {
  return raw.trim() === '' ? NaN : rupeesToPaise(parseFloat(raw));
}

export default function CustomerLedgerScreen({ route }: Props) {
  const { customerId } = route.params;
  const customers = useObservedQuery<Customer>(() => observeCustomerById(customerId), [customerId]);
  const entries = useObservedQuery<UdharEntry>(() => observeUdharEntriesForCustomer(customerId), [customerId]);
  const customer = customers[0];

  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentNote, setPaymentNote] = useState('');
  const [writeoffOpen, setWriteoffOpen] = useState(false);
  const [writeoffAmount, setWriteoffAmount] = useState('');
  const [writeoffReason, setWriteoffReason] = useState('');
  const [busy, setBusy] = useState(false);

  const ledgerEntries = useMemo(() => entries.map(toLedgerEntry), [entries]);
  const balance = useMemo(() => udharBalance(entries), [entries]);
  const oldest = useMemo(() => oldestUnsettledDebitDate(ledgerEntries), [ledgerEntries]);
  const lastPaid = useMemo(() => lastPaymentDate(ledgerEntries), [ledgerEntries]);
  const flag = agingFlag(oldest);
  const outstanding = outstandingBalance(balance);
  const advance = advanceCredit(balance);

  const paymentPaise = parsePaise(paymentAmount);
  const paymentValid = Number.isFinite(paymentPaise) && paymentPaise > 0;
  const writeoffPaise = parsePaise(writeoffAmount);
  const writeoffValid = Number.isFinite(writeoffPaise) && writeoffPaise > 0 && writeoffPaise <= outstanding;

  if (!customer) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>Customer not found.</Text>
      </View>
    );
  }

  const submitPayment = async () => {
    if (!paymentValid) return;
    setBusy(true);
    try {
      await recordPayment(customerId, paymentPaise, paymentNote || undefined);
      setPaymentAmount('');
      setPaymentNote('');
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const openWriteoff = () => {
    setWriteoffAmount(outstanding > 0 ? String(paiseToRupees(outstanding)) : '');
    setWriteoffReason('');
    setWriteoffOpen(true);
  };

  const submitWriteoff = () => {
    if (!writeoffValid) return;
    Alert.alert(
      'Write off this debt?',
      `${formatPaise(writeoffPaise)} will be marked as a loss. This can be reversed later if the customer pays.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Write off',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              await writeOffUdhar(customerId, writeoffPaise, writeoffReason || undefined);
              setWriteoffOpen(false);
            } catch (e) {
              Alert.alert('Error', e instanceof Error ? e.message : String(e));
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  };

  const doReverse = (entry: UdharEntry) => {
    Alert.alert('Reverse this write-off?', 'The amount will count as owed again.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reverse',
        onPress: async () => {
          setBusy(true);
          try {
            await reverseWriteOff(entry);
          } catch (e) {
            Alert.alert('Error', e instanceof Error ? e.message : String(e));
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.name}>{customer.name}</Text>
      <Text style={styles.meta}>{customer.phone ?? 'no phone'}</Text>

      {outstanding > 0 ? (
        <Text style={styles.balanceOwed}>{formatPaise(outstanding)} owed</Text>
      ) : advance > 0 ? (
        <Text style={styles.balanceCredit}>{formatPaise(advance)} advance credit</Text>
      ) : (
        <Text style={styles.balanceSettled}>Settled</Text>
      )}

      <View style={styles.badgeRow}>
        <View style={[styles.badge, { backgroundColor: AGING_STYLE[flag].bg }]}>
          <Text style={[styles.badgeText, { color: AGING_STYLE[flag].fg }]}>{AGING_STYLE[flag].label}</Text>
        </View>
      </View>
      <Text style={styles.meta}>{lastPaid ? `Last payment: ${formatIst(lastPaid)}` : 'No payments yet'}</Text>

      <Text style={styles.section}>Record payment</Text>
      <View style={styles.formRow}>
        <TextInput
          style={styles.amountInput}
          placeholder="₹ amount"
          keyboardType="decimal-pad"
          value={paymentAmount}
          onChangeText={(v) => setPaymentAmount(sanitizeDecimalInput(v))}
        />
        <TextInput
          style={styles.noteInput}
          placeholder="Note (optional)"
          value={paymentNote}
          onChangeText={setPaymentNote}
        />
      </View>
      <Pressable
        style={[styles.btn, styles.btnPrimary, !paymentValid && styles.btnDisabled]}
        disabled={busy || !paymentValid}
        onPress={submitPayment}
      >
        <Text style={styles.btnPrimaryText}>Save payment</Text>
      </Pressable>

      <Text style={styles.section}>Bad debt</Text>
      {!writeoffOpen ? (
        <Pressable style={[styles.btn, styles.btnDanger]} disabled={busy || outstanding <= 0} onPress={openWriteoff}>
          <Text style={styles.btnDangerText}>Write off outstanding debt</Text>
        </Pressable>
      ) : (
        <>
          <View style={styles.formRow}>
            <TextInput
              style={styles.amountInput}
              placeholder="₹ amount"
              keyboardType="decimal-pad"
              value={writeoffAmount}
              onChangeText={(v) => setWriteoffAmount(sanitizeDecimalInput(v))}
            />
            <TextInput
              style={styles.noteInput}
              placeholder="Reason (optional)"
              value={writeoffReason}
              onChangeText={setWriteoffReason}
            />
          </View>
          <View style={styles.actions}>
            <Pressable
              style={[styles.btn, styles.btnDanger, !writeoffValid && styles.btnDisabled]}
              disabled={busy || !writeoffValid}
              onPress={submitWriteoff}
            >
              <Text style={styles.btnDangerText}>Confirm write-off</Text>
            </Pressable>
            <Pressable style={styles.btn} disabled={busy} onPress={() => setWriteoffOpen(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          </View>
        </>
      )}

      <Text style={styles.section}>History</Text>
      {entries.map((entry) => {
        const style = ENTRY_STYLE[entry.entryType];
        const canReverse = entry.entryType === UdharEntryType.writeoff && entry.status === UdharStatus.writtenOff;
        return (
          <View key={entry.id} style={styles.historyRow}>
            <View style={styles.rowMain}>
              <Text style={[styles.historyLabel, { color: style.fg }]}>{style.label}</Text>
              <Text style={styles.meta}>{formatIst(entry.createdAt.getTime())}</Text>
              {entry.note ? <Text style={styles.note}>{entry.note}</Text> : null}
            </View>
            <View style={styles.rowEnd}>
              <Text style={[styles.historyAmount, { color: style.fg }]}>
                {style.sign}
                {formatPaise(entry.amount)}
              </Text>
              {canReverse ? (
                <Pressable disabled={busy} onPress={() => doReverse(entry)}>
                  <Text style={styles.reverseLink}>Reverse</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 20 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  muted: { color: '#aaa' },
  name: { fontSize: 22, fontWeight: '800', color: '#222' },
  meta: { fontSize: 13, color: '#888', marginTop: 2 },
  balanceOwed: { fontSize: 30, fontWeight: '800', color: '#b8320f', marginTop: 12 },
  balanceCredit: { fontSize: 24, fontWeight: '800', color: '#2e7d32', marginTop: 12 },
  balanceSettled: { fontSize: 20, fontWeight: '700', color: '#888', marginTop: 12 },
  badgeRow: { flexDirection: 'row', marginTop: 8 },
  badge: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 12 },
  badgeText: { fontSize: 12, fontWeight: '700' },
  section: {
    fontSize: 13,
    fontWeight: '700',
    color: '#888',
    marginTop: 24,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  formRow: { gap: 10 },
  amountInput: { borderWidth: 1, borderColor: '#eee', borderRadius: 10, padding: 12, fontSize: 15 },
  noteInput: { borderWidth: 1, borderColor: '#eee', borderRadius: 10, padding: 12, fontSize: 15 },
  btn: { paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  btnPrimary: { backgroundColor: '#b8320f' },
  btnPrimaryText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  btnDanger: { borderWidth: 1, borderColor: '#c0392b' },
  btnDangerText: { color: '#c0392b', fontWeight: '700', fontSize: 15 },
  btnDisabled: { opacity: 0.4 },
  cancelText: { color: '#888', fontWeight: '600', fontSize: 14 },
  actions: { gap: 8 },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f2f2f2',
  },
  rowMain: { flex: 1 },
  rowEnd: { alignItems: 'flex-end' },
  historyLabel: { fontSize: 14, fontWeight: '700' },
  historyAmount: { fontSize: 15, fontWeight: '700' },
  note: { fontSize: 12, color: '#999', marginTop: 2, fontStyle: 'italic' },
  reverseLink: { fontSize: 12, color: '#b26a00', fontWeight: '700', marginTop: 4 },
});
