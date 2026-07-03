import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../navigation/RootNavigator';
import { useObservedQuery } from '../hooks/useObservedQuery';
import { observeMenuItems } from '../services/menu/menuService';
import {
  createDraftBill,
  getBill,
  setDraftLines,
  setDraftCustomer,
  confirmBill,
} from '../services/billing/billService';
import {
  computeLineTotal,
  validateBill,
  sumSplits,
  udharPortion,
  ROUNDING_TOLERANCE_PAISE,
  type SplitInput,
} from '../services/billing/calc';
import type { DraftLineInput } from '../services/billing/types';
import { findOrCreateCustomer, getCustomer } from '../services/customer/customerService';
import { UnitType, PaymentMode } from '../db/constants';
import { formatPaise, rupeesToPaise, paiseToRupees, sanitizeDecimalInput } from '../services/currency';
import type { MenuItem } from '../db/models';

type Props = NativeStackScreenProps<RootStackParamList, 'Billing'>;

interface CartLine {
  key: string;
  menuItemId?: string;
  itemName: string;
  mode: UnitType;
  quantityStr: string;
  unitPriceStr: string; // ₹ per unit (override allowed)
  amountStr: string; // ₹
}

const MODE_LABELS: Record<PaymentMode, string> = {
  [PaymentMode.cash]: 'Cash',
  [PaymentMode.online]: 'Online',
  [PaymentMode.udhar]: 'Udhar',
};
const PAYMENT_MODES = [PaymentMode.cash, PaymentMode.online, PaymentMode.udhar] as const;

let keySeq = 0;
const nextKey = () => `line-${keySeq++}`;

function toDraftLine(line: CartLine): DraftLineInput {
  if (line.mode === UnitType.qty) {
    return {
      menuItemId: line.menuItemId,
      itemName: line.itemName,
      mode: UnitType.qty,
      quantity: parseFloat(line.quantityStr),
      unitPrice: rupeesToPaise(parseFloat(line.unitPriceStr)),
    };
  }
  return {
    menuItemId: line.menuItemId,
    itemName: line.itemName,
    mode: UnitType.amount,
    amount: rupeesToPaise(parseFloat(line.amountStr)),
  };
}

/** Live line total in paise; returns 0 for incomplete input (never NaN, never throws in render). */
function lineTotalSafe(line: CartLine): number {
  try {
    return computeLineTotal(toDraftLine(line));
  } catch {
    return 0;
  }
}

/** A line only counts as a real, savable item once it has a positive, complete value. */
function isLineComplete(line: CartLine): boolean {
  try {
    return computeLineTotal(toDraftLine(line)) > 0;
  } catch {
    return false;
  }
}

export default function BillingScreen({ route, navigation }: Props) {
  const menuItems = useObservedQuery<MenuItem>(() => observeMenuItems(true), []);

  const [cart, setCart] = useState<CartLine[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [paymentMode, setPaymentMode] = useState<PaymentMode | null>(null);
  const [splitPayment, setSplitPayment] = useState(false);
  const [cash, setCash] = useState('');
  const [online, setOnline] = useState('');
  const [udhar, setUdhar] = useState('');
  const [udharTouched, setUdharTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const draftBillId = route.params?.draftBillId;

  // Recreate/edit flow: hydrate the cart from an existing persisted draft.
  useEffect(() => {
    if (!draftBillId) return;
    (async () => {
      try {
        const bill = await getBill(draftBillId);
        const lines = await bill.lineItems.fetch();
        setCart(
          lines.map((l) => ({
            key: nextKey(),
            menuItemId: l.menuItemId,
            itemName: l.itemName,
            mode: l.mode,
            quantityStr: l.quantity != null ? String(l.quantity) : '',
            unitPriceStr: l.unitPriceSnapshot != null ? String(paiseToRupees(l.unitPriceSnapshot)) : '',
            amountStr: l.mode === UnitType.amount ? String(paiseToRupees(l.lineTotal)) : '',
          })),
        );
        if (bill.customerId) {
          const c = await getCustomer(bill.customerId);
          setCustomerName(c.name);
          setCustomerPhone(c.phone ?? '');
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
  }, [draftBillId]);

  const billTotal = useMemo(() => cart.reduce((sum, l) => sum + lineTotalSafe(l), 0), [cart]);
  const cartHasItems = cart.length > 0;
  const cartLinesValid = cartHasItems && cart.every(isLineComplete);

  const paise = (s: string) => (s.trim() === '' ? 0 : rupeesToPaise(parseFloat(s)) || 0);

  // Udhar auto-fills as the remainder (total - cash - online) while the shopkeeper
  // hasn't typed into it directly — the moment they do, their input wins for the rest
  // of this split session (reset when Split payment is re-opened).
  useEffect(() => {
    if (!splitPayment || udharTouched) return;
    const remaining = billTotal - paise(cash) - paise(online);
    const next = remaining > 0 ? sanitizeDecimalInput(String(paiseToRupees(remaining))) : '0';
    setUdhar((prev) => (prev === next ? prev : next));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [splitPayment, udharTouched, billTotal, cash, online]);

  const splits: SplitInput[] = useMemo(() => {
    if (splitPayment) {
      return [
        { mode: PaymentMode.cash, amount: paise(cash) },
        { mode: PaymentMode.online, amount: paise(online) },
        { mode: PaymentMode.udhar, amount: paise(udhar) },
      ];
    }
    return paymentMode ? [{ mode: paymentMode, amount: billTotal }] : [];
  }, [splitPayment, cash, online, udhar, paymentMode, billTotal]);

  const paidTotal = sumSplits(splits);
  const needsPhone = udharPortion(splits) > 0;
  const paymentMismatch = Math.abs(paidTotal - billTotal) > ROUNDING_TOLERANCE_PAISE;

  const canConfirm =
    cartLinesValid &&
    billTotal > 0 &&
    splits.length > 0 &&
    !paymentMismatch &&
    (!needsPhone || customerPhone.trim().length > 0) &&
    !saving;

  const addFromMenu = (item: MenuItem) => {
    setCart((prev) => {
      const idx = prev.findIndex((l) => l.menuItemId === item.id);
      if (idx >= 0) {
        const existing = prev[idx];
        if (existing.mode === UnitType.qty) {
          // Same item tapped again: merge into one line (increment qty) instead of duplicating.
          const currentQty = parseFloat(existing.quantityStr) || 0;
          const merged = { ...existing, quantityStr: String(currentQty + 1) };
          return prev.map((l, i) => (i === idx ? merged : l));
        }
        // Amount-mode items (Masala/Extra, Packing) have no natural qty to bump —
        // keep the single existing line rather than creating a duplicate.
        return prev;
      }
      return [
        ...prev,
        {
          key: nextKey(),
          menuItemId: item.id,
          itemName: item.name,
          mode: item.unitType,
          quantityStr: item.unitType === UnitType.qty ? '1' : '',
          unitPriceStr: String(paiseToRupees(item.defaultPrice)),
          amountStr: '',
        },
      ];
    });
    setError(null);
  };

  const patchLine = (key: string, patch: Partial<CartLine>) =>
    setCart((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const removeLine = (key: string) => setCart((prev) => prev.filter((l) => l.key !== key));

  const selectMode = (mode: PaymentMode) => setPaymentMode(mode);

  const enableSplit = () => {
    setUdharTouched(false);
    if (paymentMode) {
      const rupees = billTotal > 0 ? String(paiseToRupees(billTotal)) : '';
      setCash(paymentMode === PaymentMode.cash ? rupees : '');
      setOnline(paymentMode === PaymentMode.online ? rupees : '');
      setUdhar(paymentMode === PaymentMode.udhar ? rupees : '');
    }
    setSplitPayment(true);
  };

  const disableSplit = () => {
    setSplitPayment(false);
    setUdharTouched(false);
    setCash('');
    setOnline('');
    setUdhar('');
  };

  const onUdharChange = (v: string) => {
    setUdharTouched(true);
    setUdhar(v);
  };

  const confirm = async () => {
    setError(null);
    if (!cartHasItems) return setError('Add at least one item.');
    if (!cartLinesValid) {
      return setError('Some items are incomplete — enter a valid quantity/price or amount.');
    }
    if (billTotal <= 0) return setError('Bill total must be greater than zero.');
    if (splits.length === 0) return setError('Select a payment mode.');

    let lines: DraftLineInput[];
    try {
      lines = cart.map(toDraftLine);
    } catch {
      return setError('Some lines are incomplete — enter quantity/price or amount.');
    }

    const customerHasPhone = customerPhone.trim().length > 0;
    if (needsPhone && !customerHasPhone) {
      return setError('Phone number is required when any amount is on udhar.');
    }

    const check = validateBill({ total: billTotal, splits, customerHasPhone });
    if (!check.ok) return setError(check.errors.join('\n'));

    setSaving(true);
    try {
      const draft = draftBillId ? await getBill(draftBillId) : await createDraftBill();

      let customerId: string | undefined;
      if (needsPhone) {
        const customer = await findOrCreateCustomer({
          name: customerName.trim() || 'Walk-in',
          phone: customerPhone.trim(),
        });
        customerId = customer.id;
      }

      await setDraftLines(draft, lines);
      await setDraftCustomer(draft, customerId);
      await confirmBill(draft, { splits });

      Alert.alert('Bill confirmed', `Total ${formatPaise(billTotal)} saved.`);
      navigation.navigate('Bills');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.stickyTotal}>
        <Text style={styles.stickyLabel}>Total</Text>
        <Text style={styles.stickyValue}>{formatPaise(billTotal)}</Text>
      </View>

      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Menu picker */}
        <Text style={styles.section}>Add items</Text>
        <View style={styles.chips}>
          {menuItems.map((item) => (
            <Pressable key={item.id} style={styles.chip} onPress={() => addFromMenu(item)}>
              <Text style={styles.chipText}>{item.name}</Text>
            </Pressable>
          ))}
          {menuItems.length === 0 ? <Text style={styles.muted}>No active menu items.</Text> : null}
        </View>

        {/* Cart */}
        <Text style={styles.section}>Bill</Text>
        {cart.length === 0 ? <Text style={styles.muted}>Tap an item above to start.</Text> : null}
        {cart.map((line) => {
          const incomplete = !isLineComplete(line);
          return (
            <View key={line.key} style={styles.cartLine}>
              <View style={styles.cartHeader}>
                <Text style={styles.cartName}>{line.itemName}</Text>
                <Text style={styles.cartTotal}>{formatPaise(lineTotalSafe(line))}</Text>
              </View>
              <View style={styles.cartInputs}>
                {line.mode === UnitType.qty ? (
                  <>
                    <TextInput
                      style={styles.smallInput}
                      placeholder="Qty"
                      keyboardType="decimal-pad"
                      value={line.quantityStr}
                      onChangeText={(v) => patchLine(line.key, { quantityStr: sanitizeDecimalInput(v) })}
                    />
                    <Text style={styles.times}>×</Text>
                    <TextInput
                      style={styles.smallInput}
                      placeholder="₹/unit"
                      keyboardType="decimal-pad"
                      value={line.unitPriceStr}
                      onChangeText={(v) => patchLine(line.key, { unitPriceStr: sanitizeDecimalInput(v) })}
                    />
                  </>
                ) : (
                  <TextInput
                    style={styles.smallInput}
                    placeholder="₹ amount"
                    keyboardType="decimal-pad"
                    value={line.amountStr}
                    onChangeText={(v) => patchLine(line.key, { amountStr: sanitizeDecimalInput(v) })}
                  />
                )}
                <Pressable style={styles.remove} onPress={() => removeLine(line.key)}>
                  <Text style={styles.removeText}>✕</Text>
                </Pressable>
              </View>
              {incomplete ? <Text style={styles.lineWarning}>Enter a valid amount.</Text> : null}
            </View>
          );
        })}

        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>{formatPaise(billTotal)}</Text>
        </View>

        {/* Payment */}
        <Text style={styles.section}>Payment</Text>
        {!splitPayment ? (
          <View style={styles.modeRow}>
            {PAYMENT_MODES.map((mode) => (
              <Pressable
                key={mode}
                style={[styles.modeBtn, paymentMode === mode && styles.modeBtnActive]}
                onPress={() => selectMode(mode)}
              >
                <Text style={[styles.modeBtnText, paymentMode === mode && styles.modeBtnTextActive]}>
                  {MODE_LABELS[mode]}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <View style={styles.payRow}>
            <PayInput label="Cash" value={cash} onChange={setCash} />
            <PayInput label="Online" value={online} onChange={setOnline} />
            <PayInput label="Udhar" value={udhar} onChange={onUdharChange} />
          </View>
        )}

        <Pressable onPress={splitPayment ? disableSplit : enableSplit}>
          <Text style={styles.splitLink}>{splitPayment ? 'Use single payment mode' : 'Split payment'}</Text>
        </Pressable>

        {splitPayment ? (
          <Text style={[styles.balance, paymentMismatch && billTotal > 0 ? styles.balanceBad : styles.balanceOk]}>
            Paid {formatPaise(paidTotal)} / {formatPaise(billTotal)}
            {paymentMismatch && billTotal > 0
              ? `  ·  off by ${formatPaise(Math.abs(paidTotal - billTotal))}`
              : ''}
          </Text>
        ) : null}

        {/* Customer — only relevant once udhar is involved */}
        {needsPhone ? (
          <>
            <Text style={styles.section}>Customer (phone required for udhar)</Text>
            <TextInput style={styles.input} placeholder="Name" value={customerName} onChangeText={setCustomerName} />
            <TextInput
              style={styles.input}
              placeholder="Phone (WhatsApp)"
              keyboardType="phone-pad"
              value={customerPhone}
              onChangeText={setCustomerPhone}
            />
          </>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          style={[styles.confirm, !canConfirm && styles.confirmDisabled]}
          disabled={!canConfirm}
          onPress={confirm}
        >
          <Text style={styles.confirmText}>{saving ? 'Saving…' : 'Confirm & Save'}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function PayInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <View style={styles.payCol}>
      <Text style={styles.payLabel}>{label}</Text>
      <TextInput
        style={styles.payInput}
        placeholder="0"
        keyboardType="decimal-pad"
        value={value}
        onChangeText={(v) => onChange(sanitizeDecimalInput(v))}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },
  stickyTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff3ef',
    borderBottomWidth: 1,
    borderBottomColor: '#f0d2c8',
  },
  stickyLabel: { fontSize: 13, fontWeight: '700', color: '#b8320f', textTransform: 'uppercase' },
  stickyValue: { fontSize: 20, fontWeight: '800', color: '#b8320f' },
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 16, paddingBottom: 48 },
  section: { fontSize: 13, fontWeight: '700', color: '#888', marginTop: 18, marginBottom: 8, textTransform: 'uppercase' },
  muted: { color: '#aaa', fontStyle: 'italic' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { backgroundColor: '#fff3ef', borderColor: '#f0d2c8', borderWidth: 1, borderRadius: 20, paddingVertical: 8, paddingHorizontal: 14 },
  chipText: { color: '#b8320f', fontWeight: '600' },
  cartLine: { borderWidth: 1, borderColor: '#eee', borderRadius: 10, padding: 10, marginBottom: 8, backgroundColor: '#fafafa' },
  cartHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  cartName: { fontSize: 15, fontWeight: '600', color: '#222' },
  cartTotal: { fontSize: 15, fontWeight: '700', color: '#b8320f' },
  cartInputs: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  smallInput: { flex: 1, borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: '#fff' },
  times: { color: '#999' },
  remove: { padding: 8 },
  removeText: { color: '#c0392b', fontSize: 16 },
  lineWarning: { color: '#c0392b', fontSize: 12, marginTop: 6 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#eee' },
  totalLabel: { fontSize: 16, fontWeight: '700', color: '#333' },
  totalValue: { fontSize: 20, fontWeight: '800', color: '#b8320f' },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#fff', marginBottom: 8 },
  modeRow: { flexDirection: 'row', gap: 8 },
  modeBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  modeBtnActive: { backgroundColor: '#b8320f', borderColor: '#b8320f' },
  modeBtnText: { fontSize: 15, fontWeight: '700', color: '#555' },
  modeBtnTextActive: { color: '#fff' },
  splitLink: { color: '#b8320f', fontWeight: '600', marginTop: 10, textAlign: 'center' },
  payRow: { flexDirection: 'row', gap: 8 },
  payCol: { flex: 1 },
  payLabel: { fontSize: 12, color: '#888', marginBottom: 4 },
  payInput: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 10, backgroundColor: '#fff', textAlign: 'center' },
  balance: { marginTop: 10, fontSize: 13, textAlign: 'center' },
  balanceOk: { color: '#2e7d32' },
  balanceBad: { color: '#c0392b' },
  error: { color: '#c0392b', marginTop: 12, fontSize: 13 },
  confirm: { backgroundColor: '#b8320f', borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 20 },
  confirmDisabled: { opacity: 0.5 },
  confirmText: { color: '#fff', fontSize: 17, fontWeight: '800' },
});
