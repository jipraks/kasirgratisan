import { describe, it, expect } from 'vitest';
import { CURRENCY_CODE, CURRENCY_SYMBOL, formatCurrency, formatNumber } from '@/lib/currency';

describe('currency', () => {
  it('uses Colombian peso only', () => {
    expect(CURRENCY_CODE).toBe('COP');
    expect(CURRENCY_SYMBOL).toBe('$');
  });

  it('formats amounts with es-CO grouping', () => {
    expect(formatNumber(1234567)).toBe('1.234.567');
    expect(formatCurrency(15000)).toBe('$ 15.000');
    expect(formatCurrency(0)).toBe('$ 0');
  });
});
