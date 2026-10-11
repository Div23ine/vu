import type { DisplayCurrency } from '@vunvault/contracts';

/**
 * Display-currency money maths (Task 33).
 *
 * USD cents are the only amount that is ever charged. A local-currency figure
 * exists so a client in Nairobi can see what `$2,499.00` looks like in shillings,
 * and nothing else: it is derived from a locked `fx_quotes` rate, it is displayed,
 * and it is thrown away.
 *
 * Every conversion here is BigInt at a 1e8 scale with half-up rounding. No
 * floating point is used anywhere in this module — `249900 * 129.49621` is
 * `32361102.878999997` as a double, and a rounding decision made on that value is
 * a rounding decision made on representation error.
 */

/** Rates are quoted with eight decimal places; the BigInt scale matches. */
export const RATE_DECIMALS = 8;

const RATE_SCALE = 10n ** BigInt(RATE_DECIMALS);
const HALF = RATE_SCALE / 2n;

/** 1 USD is 1 USD. The rate source is never asked about the settlement currency. */
export const USD_RATE = '1.00000000';

/** Currencies the portal may display. Only USD is ever charged. */
export const LOCAL_DISPLAY_CURRENCIES = ['KES', 'NGN', 'GHS', 'ZAR'] as const;
export const DISPLAY_CURRENCIES = ['USD', ...LOCAL_DISPLAY_CURRENCIES] as const;

export type LocalDisplayCurrency = (typeof LOCAL_DISPLAY_CURRENCIES)[number];

const DECIMAL_PATTERN = /^(\d+)(?:\.(\d+))?$/;

/** True for the four non-USD display currencies. */
export function isLocalCurrency(currency: string): currency is LocalDisplayCurrency {
  return (LOCAL_DISPLAY_CURRENCIES as readonly string[]).includes(currency);
}

/** True for any currency the portal may display, USD included. */
export function isDisplayCurrency(currency: string): currency is DisplayCurrency {
  return (DISPLAY_CURRENCIES as readonly string[]).includes(currency);
}

/**
 * Split a decimal literal into its whole part and an exactly eight-digit fraction.
 * Digits beyond the eighth are dropped, never rounded up into the rate: a rate is
 * quoted to eight places, so anything past that is noise from the source.
 */
function splitDecimal(text: string): { whole: string; fraction: string } {
  const match = DECIMAL_PATTERN.exec(text.trim());
  const whole = match?.[1];
  if (match === null || whole === undefined) {
    throw new RangeError(`FX rate must be a non-negative decimal string, received: "${text}"`);
  }
  const fraction = (match[2] ?? '').padEnd(RATE_DECIMALS, '0').slice(0, RATE_DECIMALS);
  return { whole, fraction };
}

/**
 * Normalise a rate onto the fixed eight-decimal wire format, e.g. `129.5` from a
 * JSON payload becomes `"129.50000000"`.
 *
 * The number is stringified, never arithmetically rescaled: `String(129.5)` is the
 * shortest decimal that round-trips, so no precision is invented or lost. Exponent
 * notation is rejected rather than silently expanded.
 */
export function toRateString(value: string | number): string {
  const text = typeof value === 'number' ? String(value) : value;
  const { whole, fraction } = splitDecimal(text);
  return `${whole}.${fraction}`;
}

/** Parse a decimal rate string ("local major units per 1 USD") into BigInt × 1e8. */
export function parseRate(rate: string): bigint {
  const { whole, fraction } = splitDecimal(rate);
  return BigInt(whole) * RATE_SCALE + BigInt(fraction);
}

/**
 * Convert USD cents to local minor units using a locked decimal rate string.
 *
 * `localMinor = usdCents × rate` — the ×100 for major→minor cancels the ÷100 for
 * cents→major, so the two exponent steps disappear and the BigInt product is
 * divided by the rate scale once, half up.
 *
 * `usdCentsToLocalMinor(249900, "129.50000000") === 32362050` → KES 323,620.50
 * `usdCentsToLocalMinor(89900, "1.00000000") === 89900`
 */
export function usdCentsToLocalMinor(usdCents: number, rate: string): number {
  if (!Number.isSafeInteger(usdCents)) {
    throw new RangeError(`Amount must be an integer number of USD cents: ${usdCents}`);
  }
  const product = BigInt(usdCents) * parseRate(rate);
  const negative = product < 0n;
  const magnitude = negative ? -product : product;
  const rounded = (magnitude + HALF) / RATE_SCALE;
  const localMinor = Number(negative ? -rounded : rounded);
  if (!Number.isSafeInteger(localMinor)) {
    throw new RangeError(`Converted amount exceeds a safe integer: ${localMinor}`);
  }
  return localMinor;
}
