import { describe, expect, it } from 'vitest';
import {
  formatLocalDisplay,
  formatUsd,
  formatUsdWhole,
  usdCentsToLocalMinor,
  type DisplayCurrency,
} from './money.js';

describe('formatUsd', () => {
  it('renders grouped USD with two decimals', () => {
    expect(formatUsd(249900)).toBe('$2,499.00');
    expect(formatUsd(89900)).toBe('$899.00');
    expect(formatUsd(144000)).toBe('$1,440.00');
    expect(formatUsd(0)).toBe('$0.00');
    expect(formatUsd(5)).toBe('$0.05');
    expect(formatUsd(123456789)).toBe('$1,234,567.89');
  });

  it('rejects non-integer cents', () => {
    expect(() => formatUsd(12.5)).toThrow(RangeError);
  });
});

describe('formatUsdWhole', () => {
  it('drops the decimals for subscription amounts', () => {
    expect(formatUsdWhole(249900)).toBe('$2,499');
    expect(formatUsdWhole(144000)).toBe('$1,440');
  });
});

describe('usdCentsToLocalMinor', () => {
  it('converts with BigInt precision and rounds half up', () => {
    expect(usdCentsToLocalMinor(249900, '129.50000000')).toBe(32362050);
    expect(usdCentsToLocalMinor(89900, '129.50000000')).toBe(11642050);
    expect(usdCentsToLocalMinor(100, '1')).toBe(100);
    expect(usdCentsToLocalMinor(1, '1.000000005')).toBe(1);
    expect(usdCentsToLocalMinor(3, '0.33333333')).toBe(1);
    expect(usdCentsToLocalMinor(0, '129.50000000')).toBe(0);
  });

  it('never uses floating point multiplication', () => {
    // 3333 × 33.33 = 111088.89 exactly; half-up rounding gives 111089 minor units.
    expect(usdCentsToLocalMinor(3333, '33.33000000')).toBe(111089);
    expect(usdCentsToLocalMinor(249900, '129.5')).toBe(32362050);
  });

  it('rejects a malformed rate', () => {
    expect(() => usdCentsToLocalMinor(100, 'abc')).toThrow(RangeError);
    expect(() => usdCentsToLocalMinor(100, '-1')).toThrow(RangeError);
  });
});

describe('formatLocalDisplay', () => {
  it('renders every supported display currency from minor units', () => {
    const currencies: DisplayCurrency[] = ['USD', 'KES', 'NGN', 'GHS', 'ZAR'];
    for (const currency of currencies) {
      const rendered = formatLocalDisplay(32362050, currency);
      expect(rendered).toContain('323,620.50');
    }
    expect(formatLocalDisplay(249900, 'USD')).toBe('$2,499.00');
  });

  it('is display-only and never mutates the settlement amount', () => {
    const usdCents = 249900;
    const kesMinor = usdCentsToLocalMinor(usdCents, '129.50000000');
    expect(formatLocalDisplay(kesMinor, 'KES')).toContain('KES');
    expect(formatUsd(usdCents)).toBe('$2,499.00');
  });
});
