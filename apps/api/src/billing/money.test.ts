import { describe, expect, it } from 'vitest';
import {
  DISPLAY_CURRENCIES,
  isDisplayCurrency,
  isLocalCurrency,
  parseRate,
  toRateString,
  usdCentsToLocalMinor,
  USD_RATE,
} from './money.js';

/**
 * The catalogue pins two values; both are asserted first, verbatim.
 *
 * `usdCentsToLocalMinor(249900, "129.50000000") === 32362050`
 * `usdCentsToLocalMinor(89900, "1.00000000") === 89900`
 */
describe('usdCentsToLocalMinor', () => {
  it('converts the two documented amounts exactly', () => {
    expect(usdCentsToLocalMinor(249900, '129.50000000')).toBe(32362050);
    expect(usdCentsToLocalMinor(89900, '1.00000000')).toBe(89900);
  });

  it('is the identity at the USD rate, which is always eight decimal places', () => {
    expect(USD_RATE).toBe('1.00000000');
    for (const cents of [1, 99, 89900, 249900, 1_000_000]) {
      expect(usdCentsToLocalMinor(cents, USD_RATE)).toBe(cents);
    }
  });

  it('converts the other display currencies', () => {
    // $2,499.00 in naira at 1599.5 → NGN 3,997,150.50
    expect(usdCentsToLocalMinor(249900, '1599.50000000')).toBe(399715050);
    // $2,499.00 in rand at 15.42 → ZAR 38,534.58
    expect(usdCentsToLocalMinor(249900, '15.42000000')).toBe(3853458);
    // $89,900.00 in naira at 1599.5
    expect(usdCentsToLocalMinor(8_990_000, '1599.50000000')).toBe(14_379_505_000);
  });

  it('never touches a float, so a rate with five decimals stays exact', () => {
    // As a double, 249900 * 129.49621 is 32361102.878999997 — the BigInt path
    // rounds the exact product instead.
    expect(249900 * 129.49621).not.toBe(32361103);
    expect(usdCentsToLocalMinor(249900, '129.49621000')).toBe(32361103);
  });

  it('rounds half up, and only half up', () => {
    expect(usdCentsToLocalMinor(1, '0.50000000')).toBe(1);
    expect(usdCentsToLocalMinor(1, '0.49999999')).toBe(0);
    expect(usdCentsToLocalMinor(3, '0.10000000')).toBe(0);
    expect(usdCentsToLocalMinor(15, '0.10000000')).toBe(2);
  });

  it('carries the sign, so a refund converts the same way as a charge', () => {
    expect(usdCentsToLocalMinor(-249900, '129.50000000')).toBe(-32362050);
    expect(usdCentsToLocalMinor(0, '129.50000000')).toBe(0);
  });

  it('refuses a fractional or unsafe amount', () => {
    expect(() => usdCentsToLocalMinor(2499.5, '129.50000000')).toThrow(RangeError);
    expect(() => usdCentsToLocalMinor(Number.NaN, '129.50000000')).toThrow(RangeError);
    expect(() => usdCentsToLocalMinor(Number.MAX_SAFE_INTEGER, '129.50000000')).toThrow(RangeError);
  });

  it('refuses a rate that is not a plain non-negative decimal', () => {
    for (const rate of ['', 'abc', '1.2.3', '-5', '1e3', 'NaN', '  ', '1,5']) {
      expect(() => usdCentsToLocalMinor(249900, rate), rate).toThrow(RangeError);
    }
  });
});

describe('toRateString', () => {
  it('pads a JSON number onto the eight-decimal wire format', () => {
    expect(toRateString(129.5)).toBe('129.50000000');
    expect(toRateString(1)).toBe('1.00000000');
    expect(toRateString('0.1')).toBe('0.10000000');
    expect(toRateString('1599.5')).toBe('1599.50000000');
  });

  it('truncates digits past the eighth decimal instead of rounding them', () => {
    expect(toRateString('129.496213579')).toBe('129.49621357');
    expect(parseRate('1.123456789')).toBe(112_345_678n);
  });

  it('rejects exponent notation rather than expanding it', () => {
    expect(() => toRateString('1e3')).toThrow(RangeError);
    expect(() => toRateString(1e21)).toThrow(RangeError);
  });

  it('round-trips through parseRate', () => {
    expect(parseRate(toRateString('129.5'))).toBe(12_950_000_000n);
    expect(parseRate(USD_RATE)).toBe(100_000_000n);
  });
});

describe('currency guards', () => {
  it('lists exactly the currencies the portal may display', () => {
    expect(DISPLAY_CURRENCIES).toEqual(['USD', 'KES', 'NGN', 'GHS', 'ZAR']);
  });

  it('separates the local currencies from the settlement currency', () => {
    expect(isLocalCurrency('KES')).toBe(true);
    expect(isLocalCurrency('NGN')).toBe(true);
    expect(isLocalCurrency('USD')).toBe(false);
    expect(isLocalCurrency('BTC')).toBe(false);
    expect(isDisplayCurrency('USD')).toBe(true);
    expect(isDisplayCurrency('ZAR')).toBe(true);
    expect(isDisplayCurrency('EUR')).toBe(false);
    expect(isDisplayCurrency('kes')).toBe(false);
  });
});
