import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { useObservedQuery } from '../hooks/useObservedQuery';
import {
  observeMenuItems,
  createMenuItem,
  updateMenuItem,
  setMenuItemActive,
} from '../services/menu/menuService';
import { UnitType } from '../db/constants';
import { formatPaise, rupeesToPaise, paiseToRupees } from '../services/currency';
import type { MenuItem } from '../db/models';

export default function MenuScreen() {
  const items = useObservedQuery<MenuItem>(() => observeMenuItems(false), []);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [mode, setMode] = useState<UnitType>(UnitType.qty);
  const [error, setError] = useState<string | null>(null);

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setPrice('');
    setMode(UnitType.qty);
    setError(null);
  };

  const loadForEdit = (item: MenuItem) => {
    setEditingId(item.id);
    setName(item.name);
    setPrice(String(paiseToRupees(item.defaultPrice)));
    setMode(item.unitType);
    setError(null);
  };

  const save = async () => {
    const trimmed = name.trim();
    const rupees = parseFloat(price);
    if (!trimmed) return setError('Name is required.');
    if (Number.isNaN(rupees) || rupees < 0) return setError('Enter a valid price (₹).');
    const defaultPrice = rupeesToPaise(rupees);
    try {
      if (editingId) {
        const item = items.find((i) => i.id === editingId);
        if (item) await updateMenuItem(item, { name: trimmed, defaultPrice, unitType: mode });
      } else {
        await createMenuItem({ name: trimmed, defaultPrice, unitType: mode });
      }
      resetForm();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.form}>
        <Text style={styles.formTitle}>{editingId ? 'Edit item' : 'Add item'}</Text>
        <TextInput style={styles.input} placeholder="Item name" value={name} onChangeText={setName} />
        <TextInput
          style={styles.input}
          placeholder="Default price (₹)"
          keyboardType="decimal-pad"
          value={price}
          onChangeText={setPrice}
        />
        <View style={styles.modeRow}>
          {[UnitType.qty, UnitType.amount].map((m) => (
            <Pressable
              key={m}
              style={[styles.modeChip, mode === m && styles.modeChipActive]}
              onPress={() => setMode(m)}
            >
              <Text style={[styles.modeChipText, mode === m && styles.modeChipTextActive]}>
                {m === UnitType.qty ? 'By quantity (kg/pcs)' : 'By amount (₹)'}
              </Text>
            </Pressable>
          ))}
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <View style={styles.formActions}>
          <Pressable style={[styles.btn, styles.btnPrimary]} onPress={save}>
            <Text style={styles.btnPrimaryText}>{editingId ? 'Save' : 'Add'}</Text>
          </Pressable>
          {editingId ? (
            <Pressable style={styles.btn} onPress={resetForm}>
              <Text style={styles.btnText}>Cancel</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      <Text style={styles.listTitle}>Menu ({items.length})</Text>
      {items.map((item) => (
        <View key={item.id} style={[styles.row, !item.active && styles.rowInactive]}>
          <Pressable style={styles.rowMain} onPress={() => loadForEdit(item)}>
            <Text style={styles.rowName}>{item.name}</Text>
            <Text style={styles.rowMeta}>
              {formatPaise(item.defaultPrice)} · {item.unitType === UnitType.qty ? 'qty' : '₹'}
            </Text>
          </Pressable>
          <Pressable style={styles.toggle} onPress={() => setMenuItemActive(item, !item.active)}>
            <Text style={styles.toggleText}>{item.active ? 'Active' : 'Hidden'}</Text>
          </Pressable>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 16, paddingBottom: 40 },
  form: { backgroundColor: '#faf7f6', borderRadius: 12, padding: 14, gap: 10, borderWidth: 1, borderColor: '#eee' },
  formTitle: { fontSize: 16, fontWeight: '700', color: '#333' },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#fff' },
  modeRow: { flexDirection: 'row', gap: 8 },
  modeChip: { flex: 1, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: '#ddd', alignItems: 'center' },
  modeChipActive: { backgroundColor: '#b8320f', borderColor: '#b8320f' },
  modeChipText: { fontSize: 12, color: '#666' },
  modeChipTextActive: { color: '#fff', fontWeight: '600' },
  formActions: { flexDirection: 'row', gap: 10 },
  btn: { paddingVertical: 10, paddingHorizontal: 18, borderRadius: 8, borderWidth: 1, borderColor: '#ddd' },
  btnText: { color: '#666' },
  btnPrimary: { backgroundColor: '#b8320f', borderColor: '#b8320f' },
  btnPrimaryText: { color: '#fff', fontWeight: '700' },
  error: { color: '#c0392b', fontSize: 13 },
  listTitle: { fontSize: 14, fontWeight: '700', color: '#888', marginTop: 22, marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  rowInactive: { opacity: 0.5 },
  rowMain: { flex: 1 },
  rowName: { fontSize: 16, color: '#222' },
  rowMeta: { fontSize: 13, color: '#999', marginTop: 2 },
  toggle: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6, backgroundColor: '#eee' },
  toggleText: { fontSize: 12, color: '#555' },
});
