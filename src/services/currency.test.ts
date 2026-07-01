import { rupeesToPaise, paiseToRupees, formatPaise } from './currency';

describe('currency', () => {
  it('converts rupees to integer paise, rounding to the nearest paisa', () => {
    expect(rupeesToPaise(125.5)).toBe(12550);
    expect(rupeesToPaise(0.1)).toBe(10);
    expect(rupeesToPaise(0.005)).toBe(1); // rounds up
  });

  it('converts paise back to rupees', () => {
    expect(paiseToRupees(12550)).toBe(125.5);
  });

  it('formats paise as an Indian-rupee string', () => {
    expect(formatPaise(12550)).toBe('₹125.50');
    expect(formatPaise(0)).toBe('₹0.00');
    expect(formatPaise(12550, false)).toBe('125.50');
  });
});
