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
import { computeLineTotal, validateBill, type SplitInput } from '../services/billing/calc';
import type { DraftLineInput } from '../services/billing/types';
import { createCustomer, getCustomer } from '../services/customer/customerService';
import { UnitType, PaymentMode } from '../db/constants';
import { formatPaise, rupeesToPaise, paiseToRupees } from '../services/currency';
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

let keySeq = 0;
const nextKey = () => `line-${keySeq++}`;

/** Live line total in paise; returns 0 for incomplete input (never throws in render). */
function lineTotalSafe(line: CartLine): number {
  try {
    return computeLineTotal(toDraftLine(line));
  } catch {
    return 0;
  }
}

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

export default function BillingScreen({ route, navigation }: Props) {
  const menuItems = useObservedQuery<MenuItem>(() => observeMenuItems(true), []);

  const [cart, setCart] = useState<CartLine[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [cash, setCash] = useState('');
  const [online, setOnline] = useState('');
  const [udhar, setUdhar] = useState('');
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

  const paise = (s: string) => (s.trim() === '' ? 0 : rupeesToPaise(parseFloat(s)) || 0);
  const splits: SplitInput[] = useMemo(
    () => [
      { mode: PaymentMode.cash, amount: paise(cash) },
      { mode: PaymentMode.online, amount: paise(online) },
      { mode: PaymentMode.udhar, amount: paise(udhar) },
    ],
    [cash, online, udhar],
  );
  const paidTotal = splits.reduce((s, x) => s + x.amount, 0);
  const udharAmount = paise(udhar);

  const addFromMenu = (item: MenuItem) => {
    setCart((prev) => [
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
    ]);
    setError(null);
  };

  const patchLine = (key: string, patch: Partial<CartLine>) =>
    setCart((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const removeLine = (key: string) => setCart((prev) => prev.filter((l) => l.key !== key));

  const autoFillCash = () => {
    // Convenience: put the whole outstanding into cash (fastest common case).
    setCash(String(paiseToRupees(billTotal)));
    setOnline('');
    setUdhar('');
  };

  const confirm = async () => {
    setError(null);
    if (cart.length === 0) return setError('Add at least one item.');

    let lines: DraftLineInput[];
    try {
      lines = cart.map(toDraftLine);
    } catch {
      return setError('Some lines are incomplete — enter quantity/price or amount.');
    }

    const customerHasPhone = customerPhone.trim().length > 0;
    const check = validateBill({ total: billTotal, splits, customerHasPhone });
    if (!check.ok) return setError(check.errors.join('\n'));

    setSaving(true);
    try {
      const draft = draftBillId ? await getBill(draftBillId) : await createDraftBill();

      let customerId: string | undefined;
      if (customerName.trim() || udharAmount > 0) {
        const customer = await createCustomer({
          name: customerName.trim() || 'Walk-in',
          phone: customerPhone.trim() || undefined,
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

  const balanceOff = paidTotal !== billTotal;

  return (
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
      {cart.map((line) => (
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
                  onChangeText={(v) => patchLine(line.key, { quantityStr: v })}
                />
                <Text style={styles.times}>×</Text>
                <TextInput
                  style={styles.smallInput}
                  placeholder="₹/unit"
                  keyboardType="decimal-pad"
                  value={line.unitPriceStr}
                  onChangeText={(v) => patchLine(line.key, { unitPriceStr: v })}
                />
              </>
            ) : (
              <TextInput
                style={styles.smallInput}
                placeholder="₹ amount"
                keyboardType="decimal-pad"
                value={line.amountStr}
                onChangeText={(v) => patchLine(line.key, { amountStr: v })}
              />
            )}
            <Pressable style={styles.remove} onPress={() => removeLine(line.key)}>
              <Text style={styles.removeText}>✕</Text>
            </Pressable>
          </View>
        </View>
      ))}

      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Total</Text>
        <Text style={styles.totalValue}>{formatPaise(billTotal)}</Text>
      </View>

      {/* Customer */}
      <Text style={styles.section}>Customer {udharAmount > 0 ? '(phone required for udhar)' : '(optional)'}</Text>
      <TextInput style={styles.input} placeholder="Name" value={customerName} onChangeText={setCustomerName} />
      <TextInput
        style={styles.input}
        placeholder="Phone (WhatsApp)"
        keyboardType="phone-pad"
        value={customerPhone}
        onChangeText={setCustomerPhone}
      />

      {/* Payment */}
      <View style={styles.payHeader}>
        <Text style={styles.section}>Payment</Text>
        <Pressable onPress={autoFillCash}>
          <Text style={styles.autofill}>All cash</Text>
        </Pressable>
      </View>
      <View style={styles.payRow}>
        <PayInput label="Cash" value={cash} onChange={setCash} />
        <PayInput label="Online" value={online} onChange={setOnline} />
        <PayInput label="Udhar" value={udhar} onChange={setUdhar} />
      </View>
      <Text style={[styles.balance, balanceOff && billTotal > 0 ? styles.balanceBad : styles.balanceOk]}>
        Paid {formatPaise(paidTotal)} / {formatPaise(billTotal)}
        {balanceOff && billTotal > 0 ? '  ·  does not match' : ''}
      </Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable
        style={[styles.confirm, saving && styles.confirmDisabled]}
        disabled={saving}
        onPress={confirm}
      >
        <Text style={styles.confirmText}>{saving ? 'Saving…' : 'Confirm & Save'}</Text>
      </Pressable>
    </ScrollView>
  );
}

function PayInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <View style={styles.payCol}>
      <Text style={styles.payLabel}>{label}</Text>
      <TextInput style={styles.payInput} placeholder="0" keyboardType="decimal-pad" value={value} onChangeText={onChange} />
    </View>
  );
}

const styles = StyleSheet.create({
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
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#eee' },
  totalLabel: { fontSize: 16, fontWeight: '700', color: '#333' },
  totalValue: { fontSize: 20, fontWeight: '800', color: '#b8320f' },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#fff', marginBottom: 8 },
  payHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  autofill: { color: '#b8320f', fontWeight: '600', marginBottom: 8 },
  payRow: { flexDirection: 'row', gap: 8 },
  payCol: { flex: 1 },
  payLabel: { fontSize: 12, color: '#888', marginBottom: 4 },
  payInput: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 10, backgroundColor: '#fff', textAlign: 'center' },
  balance: { marginTop: 8, fontSize: 13, textAlign: 'center' },
  balanceOk: { color: '#2e7d32' },
  balanceBad: { color: '#c0392b' },
  error: { color: '#c0392b', marginTop: 12, fontSize: 13 },
  confirm: { backgroundColor: '#b8320f', borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 20 },
  confirmDisabled: { opacity: 0.5 },
  confirmText: { color: '#fff', fontSize: 17, fontWeight: '800' },
});
