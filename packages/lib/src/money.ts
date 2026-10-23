/**
 * Money helpers.
 *
 * USD is the ONLY settlement currency. Every stored amount is an integer number
 * of USD cents (`number`, exact up to 2^53). Local currencies exist for display
 * only, at a rate locked by an `fx_quotes` row; the provider charge is always
 * created for the USD amount. No floating point is used in the conversion.
 */

/** Currencies the portal may *display*. Only USD is ever charged. */
export type { DisplayCurrency } from '@vunvault/contracts';
import type { DisplayCurrency } from '@vunvault/contracts';

/** Integer USD cents. */
export type UsdCents = number;

/** Integer minor units of a display currency. Display only. */
export type LocalMinor = number;

/** Rates are quoted with eight decimal places; the BigInt scale matches. */
const RATE_SCALE = 100_000_000n;
const RATE_DECIMALS = 8;

/** ISO 4217 minor-unit exponent for every supported display currency. */
const MINOR_UNIT_EXPONENT: Record<DisplayCurrency, number> = {
  USD: 2,
  KES: 2,
  NGN: 2,
  GHS: 2,
  GBP: 2,
  EUR: 2,
  ZAR: 2,
};

const usdMajorFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

function splitCents(cents: number): { sign: string; major: number; minor: number } {
  if (!Number.isSafeInteger(cents)) {
    throw new RangeError(`Amount must be an integer number of cents: ${cents}`);
  }
  const magnitude = Math.abs(cents);
  return {
    sign: cents < 0 ? '-' : '',
    major: Math.floor(magnitude / 100),
    minor: magnitude % 100,
  };
}

/** `249900 → "$2,499.00"` */
export function formatUsd(cents: UsdCents): string {
  const { sign, major, minor } = splitCents(cents);
  return `${sign}$${usdMajorFormatter.format(major)}.${String(minor).padStart(2, '0')}`;
}

/** `249900 → "$2,499"` — no decimals, used for the subscription amount. */
export function formatUsdWhole(cents: UsdCents): string {
  const { sign, major } = splitCents(cents);
  return `${sign}$${usdMajorFormatter.format(major)}`;
}

/**
 * Parse a decimal rate string ("local major units per 1 USD") into a BigInt
 * scaled by 1e8. Trailing digits beyond the eighth decimal place are dropped.
 */
function parseRate(rate: string): bigint {
  const match = /^(\d+)(?:\.(\d+))?$/.exec(rate.trim());
  const whole = match?.[1];
  if (match === null || whole === undefined) {
    throw new RangeError(`FX rate must be a non-negative decimal string, received: "${rate}"`);
  }
  const fraction = (match[2] ?? '').padEnd(RATE_DECIMALS, '0').slice(0, RATE_DECIMALS);
  return BigInt(whole) * RATE_SCALE + BigInt(fraction);
}

/**
 * Convert USD cents to local minor units using a locked decimal rate string.
 *
 * `localMinor = usdCents × rate` (the ×100 for major→minor cancels the ÷100 for
 * cents→major). BigInt arithmetic throughout, rounded half up. Never a float.
 *
 * `usdCentsToLocalMinor(249900, "129.50000000") === 32362050` → KES 323,620.50
 */
export function usdCentsToLocalMinor(usdCents: UsdCents, rate: string): LocalMinor {
  if (!Number.isSafeInteger(usdCents)) {
    throw new RangeError(`Amount must be an integer number of cents: ${usdCents}`);
  }
  const numerator = BigInt(usdCents) * parseRate(rate);
  const negative = numerator < 0n;
  const magnitude = negative ? -numerator : numerator;
  const rounded = (magnitude + RATE_SCALE / 2n) / RATE_SCALE;
  return Number(negative ? -rounded : rounded);
}

/**
 * Display only. Never use to charge. Cards are always charged in USD.
 */
export function formatLocalDisplay(localMinor: LocalMinor, currency: DisplayCurrency): string {
  if (!Number.isSafeInteger(localMinor)) {
    throw new RangeError(`Amount must be an integer number of minor units: ${localMinor}`);
  }
  const divisor = 10 ** MINOR_UNIT_EXPONENT[currency];
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(
    localMinor / divisor,
  );
}
