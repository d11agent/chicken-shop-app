import { rupeesToPaise, paiseToRupees, formatPaise, sanitizeDecimalInput } from './currency';

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

describe('sanitizeDecimalInput', () => {
  it('passes plain digits and a single decimal through unchanged', () => {
    expect(sanitizeDecimalInput('300')).toBe('300');
    expect(sanitizeDecimalInput('300.5')).toBe('300.5');
    expect(sanitizeDecimalInput('')).toBe('');
  });

  it('strips stray commas from locale-formatted keyboard input', () => {
    expect(sanitizeDecimalInput('1,000')).toBe('1000');
    expect(sanitizeDecimalInput('10,52')).toBe('1052');
  });

  it('collapses repeated/duplicated decimal points to the first one', () => {
    expect(sanitizeDecimalInput('300...50')).toBe('300.50');
    expect(sanitizeDecimalInput('10.....,52')).toBe('10.52');
    expect(sanitizeDecimalInput('10..5')).toBe('10.5');
  });

  it('drops any non-numeric characters (letters, currency symbols, spaces)', () => {
    expect(sanitizeDecimalInput('₹300.50')).toBe('300.50');
    expect(sanitizeDecimalInput('abc123')).toBe('123');
    expect(sanitizeDecimalInput('30 0')).toBe('300');
  });
});
