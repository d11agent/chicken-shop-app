import { appSchema, tableSchema } from '@nozbe/watermelondb';

/**
 * WatermelonDB schema — Chicken Shop App (Layer 1 core).
 *
 * Conventions (see CLAUDE.md non-negotiable domain rules):
 * - MONEY is stored as INTEGER PAISE (₹1 = 100). Never floats for currency.
 * - QUANTITY (kg / pcs) is stored as a float `number`.
 * - TIMESTAMPS are stored as UTC epoch milliseconds (number). Display converts to IST.
 *   `created_at` / `updated_at` are WatermelonDB-managed (@readonly @date).
 * - Udhar is an APPEND-ONLY ledger; balance = SUM of entries, never a mutable field.
 * - Bills store FROZEN snapshots (item name + unit price + total) so past bills never change.
 */
export const schema = appSchema({
  version: 1,
  tables: [
    // 4.2 Menu / Price management
    tableSchema({
      name: 'menu_items',
      columns: [
        { name: 'name', type: 'string' },
        { name: 'default_price', type: 'number' }, // paise per unit
        { name: 'unit_type', type: 'string' }, // 'qty' | 'amount'
        { name: 'active', type: 'boolean' },
        { name: 'sort_order', type: 'number' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),

    // 4.3 Customer entry
    tableSchema({
      name: 'customers',
      columns: [
        { name: 'name', type: 'string' },
        { name: 'phone', type: 'string', isOptional: true }, // mandatory once udhar > 0 (enforced in service layer)
        { name: 'tag', type: 'string', isOptional: true }, // manual disambiguation (e.g. landmark)
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),

    // 4.1 Quick billing — bill header (draft -> confirmed -> voided)
    tableSchema({
      name: 'bills',
      columns: [
        { name: 'customer_id', type: 'string', isOptional: true, isIndexed: true }, // null = walk-in cash
        { name: 'status', type: 'string' }, // 'draft' | 'confirmed' | 'voided'
        { name: 'total', type: 'number' }, // paise, frozen snapshot at confirm
        { name: 'note', type: 'string', isOptional: true },
        { name: 'replaces_bill_id', type: 'string', isOptional: true, isIndexed: true }, // void+recreate audit link
        { name: 'void_reason', type: 'string', isOptional: true },
        { name: 'confirmed_at', type: 'number', isOptional: true }, // UTC ms
        { name: 'voided_at', type: 'number', isOptional: true }, // UTC ms
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),

    // 4.1 Bill line items — each with independent qty/amount mode + frozen price snapshot
    tableSchema({
      name: 'bill_line_items',
      columns: [
        { name: 'bill_id', type: 'string', isIndexed: true },
        { name: 'menu_item_id', type: 'string', isOptional: true, isIndexed: true }, // null = ad-hoc item
        { name: 'item_name', type: 'string' }, // frozen snapshot of the name at bill time
        { name: 'mode', type: 'string' }, // 'qty' | 'amount'
        { name: 'quantity', type: 'number', isOptional: true }, // float kg/pcs (qty mode)
        { name: 'unit_price_snapshot', type: 'number', isOptional: true }, // paise/unit (qty mode)
        { name: 'line_total', type: 'number' }, // paise — authoritative amount for the line
        { name: 'sort_order', type: 'number' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),

    // 4.1 / 5b Payment splits — one bill can mix cash + online + udhar
    tableSchema({
      name: 'payment_splits',
      columns: [
        { name: 'bill_id', type: 'string', isIndexed: true },
        { name: 'mode', type: 'string' }, // 'cash' | 'online' | 'udhar'
        { name: 'amount', type: 'number' }, // paise
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),

    // 4.4 Udhar (credit) — APPEND-ONLY ledger. balance = SUM(debit) - SUM(payment) - SUM(writeoff).
    tableSchema({
      name: 'udhar_entries',
      columns: [
        { name: 'customer_id', type: 'string', isIndexed: true },
        { name: 'bill_id', type: 'string', isOptional: true, isIndexed: true }, // set for bill-driven debit; null for standalone payment
        { name: 'entry_type', type: 'string' }, // 'debit' | 'payment' | 'writeoff'
        { name: 'amount', type: 'number' }, // paise, always positive; sign implied by entry_type
        { name: 'status', type: 'string' }, // 'active' | 'written_off' — display hint only, NOT the balance source
        { name: 'note', type: 'string', isOptional: true },
        { name: 'created_at', type: 'number' }, // entry timestamp = "paid date" for a payment entry
        { name: 'updated_at', type: 'number' },
      ],
    }),

    // 4.6 Daily summary — recomputable aggregate cache (source of truth remains the ledgers)
    tableSchema({
      name: 'cash_summary',
      columns: [
        { name: 'date_key', type: 'string', isIndexed: true }, // 'YYYY-MM-DD' in IST
        { name: 'cash_total', type: 'number' }, // paise
        { name: 'online_total', type: 'number' },
        { name: 'udhar_given', type: 'number' },
        { name: 'udhar_collected', type: 'number' },
        { name: 'raw_material_total', type: 'number' },
        { name: 'wastage_total', type: 'number' },
        { name: 'bad_debt_total', type: 'number' },
        { name: 'net_profit', type: 'number' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),

    // 4.7 Raw material purchases (bulk, not recipe-level). Multiple same-day = separate entries.
    tableSchema({
      name: 'raw_material',
      columns: [
        { name: 'item_name', type: 'string' },
        { name: 'unit_type', type: 'string' }, // 'kg' | 'piece' | 'bunch' | 'amount' | ...
        { name: 'quantity', type: 'number', isOptional: true }, // float
        { name: 'amount', type: 'number' }, // paise — cost of this purchase
        { name: 'note', type: 'string', isOptional: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),

    // 4.8 Wastage / spoilage — separate from purchases, counted as a loss in net profit.
    tableSchema({
      name: 'wastage',
      columns: [
        { name: 'item_name', type: 'string' },
        { name: 'unit_type', type: 'string' }, // 'kg' | 'piece' | 'amount' | ...
        { name: 'quantity', type: 'number', isOptional: true }, // float
        { name: 'amount', type: 'number', isOptional: true }, // paise — ₹ value of the loss
        { name: 'reason', type: 'string', isOptional: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
  ],
});
