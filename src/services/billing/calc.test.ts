import {
  computeLineTotal,
  computeBillTotal,
  sumSplits,
  udharPortion,
  requiresPhone,
  validateBill,
  udharBalance,
  signedUdharAmount,
  ROUNDING_TOLERANCE_PAISE,
  type LineInput,
  type SplitInput,
} from './calc';
import { PaymentMode, UnitType, UdharEntryType } from '../../db/constants';

describe('computeLineTotal', () => {
  it('multiplies quantity by unit price for qty mode', () => {
    expect(computeLineTotal({ mode: UnitType.qty, quantity: 0.5, unitPrice: 24000 })).toBe(12000);
    expect(computeLineTotal({ mode: UnitType.qty, quantity: 1, unitPrice: 24000 })).toBe(24000);
  });

  it('rounds to the nearest paisa', () => {
    // 0.5 * 999 = 499.5 -> 500
    expect(computeLineTotal({ mode: UnitType.qty, quantity: 0.5, unitPrice: 999 })).toBe(500);
    // 0.333 * 30000 = 9990
    expect(computeLineTotal({ mode: UnitType.qty, quantity: 0.333, unitPrice: 30000 })).toBe(9990);
  });

  it('uses amount directly for amount mode', () => {
    expect(computeLineTotal({ mode: UnitType.amount, amount: 10000 })).toBe(10000);
  });

  it('throws on missing or negative inputs', () => {
    expect(() => computeLineTotal({ mode: UnitType.qty, quantity: 1 })).toThrow();
    expect(() => computeLineTotal({ mode: UnitType.qty, unitPrice: 100 })).toThrow();
    expect(() => computeLineTotal({ mode: UnitType.amount })).toThrow();
    expect(() => computeLineTotal({ mode: UnitType.qty, quantity: -1, unitPrice: 100 })).toThrow();
    expect(() => computeLineTotal({ mode: UnitType.amount, amount: -5 })).toThrow();
  });

  it('throws on NaN inputs (empty text field parsed with parseFloat) instead of returning NaN', () => {
    // Regression: an empty "by amount" field must never silently contribute NaN to the bill total.
    expect(() => computeLineTotal({ mode: UnitType.amount, amount: NaN })).toThrow();
    expect(() => computeLineTotal({ mode: UnitType.qty, quantity: NaN, unitPrice: 100 })).toThrow();
    expect(() => computeLineTotal({ mode: UnitType.qty, quantity: 1, unitPrice: NaN })).toThrow();
  });

  it('supports fractional-rupee prices (weight-based items)', () => {
    // ₹320.50/kg (32050 paise) x 1 = 32050 paise, no forced rounding to whole rupees.
    expect(computeLineTotal({ mode: UnitType.qty, quantity: 1, unitPrice: 32050 })).toBe(32050);
  });
});

describe('computeBillTotal', () => {
  it('sums mixed qty and amount lines', () => {
    const lines: LineInput[] = [
      { mode: UnitType.qty, quantity: 0.5, unitPrice: 24000 }, // 12000
      { mode: UnitType.amount, amount: 5000 }, // 5000
      { mode: UnitType.qty, quantity: 2, unitPrice: 700 }, // 1400
    ];
    expect(computeBillTotal(lines)).toBe(18400);
  });

  it('is zero for no lines', () => {
    expect(computeBillTotal([])).toBe(0);
  });
});

describe('splits', () => {
  const splits: SplitInput[] = [
    { mode: PaymentMode.cash, amount: 5000 },
    { mode: PaymentMode.udhar, amount: 3000 },
  ];

  it('sums splits', () => {
    expect(sumSplits(splits)).toBe(8000);
  });

  it('isolates the udhar portion', () => {
    expect(udharPortion(splits)).toBe(3000);
    expect(udharPortion([{ mode: PaymentMode.cash, amount: 8000 }])).toBe(0);
  });

  it('requires a phone only when udhar > 0', () => {
    expect(requiresPhone(splits)).toBe(true);
    expect(requiresPhone([{ mode: PaymentMode.online, amount: 8000 }])).toBe(false);
  });
});

describe('validateBill', () => {
  it('accepts splits that sum exactly to the total with phone present for udhar', () => {
    const res = validateBill({
      total: 8000,
      splits: [
        { mode: PaymentMode.cash, amount: 5000 },
        { mode: PaymentMode.udhar, amount: 3000 },
      ],
      customerHasPhone: true,
    });
    expect(res.ok).toBe(true);
    expect(res.errors).toHaveLength(0);
  });

  it('rejects when payments do not equal the total', () => {
    const res = validateBill({
      total: 8000,
      splits: [{ mode: PaymentMode.cash, amount: 5000 }],
      customerHasPhone: false,
    });
    expect(res.ok).toBe(false);
  });

  it('displays the mismatch error in rupees, not raw paise', () => {
    const res = validateBill({
      total: 8000, // ₹80.00
      splits: [{ mode: PaymentMode.cash, amount: 5000 }], // ₹50.00
      customerHasPhone: false,
    });
    expect(res.errors.join(' ')).toContain('₹50.00');
    expect(res.errors.join(' ')).toContain('₹80.00');
    expect(res.errors.join(' ')).not.toMatch(/\(5000\)/);
    expect(res.errors.join(' ')).not.toMatch(/\(8000\)/);
  });

  it('accepts a payment within the ₹2 rounding tolerance', () => {
    const res = validateBill({
      total: 32050, // ₹320.50
      splits: [{ mode: PaymentMode.cash, amount: 32050 - ROUNDING_TOLERANCE_PAISE }], // ₹318.50
      customerHasPhone: false,
    });
    expect(res.ok).toBe(true);
  });

  it('rejects a payment just past the ₹2 rounding tolerance', () => {
    const res = validateBill({
      total: 32050,
      splits: [{ mode: PaymentMode.cash, amount: 32050 - ROUNDING_TOLERANCE_PAISE - 1 }],
      customerHasPhone: false,
    });
    expect(res.ok).toBe(false);
  });

  it('rejects udhar without a phone number', () => {
    const res = validateBill({
      total: 3000,
      splits: [{ mode: PaymentMode.udhar, amount: 3000 }],
      customerHasPhone: false,
    });
    expect(res.ok).toBe(false);
    expect(res.errors.some((e) => /phone/i.test(e))).toBe(true);
  });

  it('rejects a non-positive total, empty splits, and negatives', () => {
    expect(validateBill({ total: 0, splits: [], customerHasPhone: false }).ok).toBe(false);
    expect(
      validateBill({
        total: 100,
        splits: [{ mode: PaymentMode.cash, amount: -100 }],
        customerHasPhone: false,
      }).ok,
    ).toBe(false);
  });
});

describe('udhar ledger (append-only)', () => {
  it('signs each entry type correctly', () => {
    expect(signedUdharAmount(UdharEntryType.debit, 1000)).toBe(1000);
    expect(signedUdharAmount(UdharEntryType.payment, 1000)).toBe(-1000);
    expect(signedUdharAmount(UdharEntryType.writeoff, 1000)).toBe(-1000);
    expect(signedUdharAmount(UdharEntryType.voidReversal, 1000)).toBe(-1000);
  });

  it('computes balance as the signed sum of entries', () => {
    const entries = [
      { entryType: UdharEntryType.debit, amount: 10000 },
      { entryType: UdharEntryType.debit, amount: 5000 },
      { entryType: UdharEntryType.payment, amount: 4000 },
      { entryType: UdharEntryType.writeoff, amount: 1000 },
    ];
    expect(udharBalance(entries)).toBe(10000);
  });

  it('a void reversal cancels its debit', () => {
    const entries = [
      { entryType: UdharEntryType.debit, amount: 3000 },
      { entryType: UdharEntryType.voidReversal, amount: 3000 },
    ];
    expect(udharBalance(entries)).toBe(0);
  });
});
