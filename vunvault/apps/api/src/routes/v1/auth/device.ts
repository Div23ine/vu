/**
 * Device and location labelling for the session list.
 *
 * A user agent cannot reliably say "MacBook Pro", so the labels are deliberately
 * coarse: `<Device> · <Browser>`. Guessing a model would put a fabricated string
 * in front of a user making a security decision about which session to revoke.
 */

export type DeviceKind = 'Mac' | 'Windows PC' | 'iPhone' | 'iPad' | 'Android' | 'Linux';
export type BrowserKind = 'Safari' | 'Chrome' | 'Firefox' | 'Edge' | 'Opera';

export const UNKNOWN_DEVICE = 'Unknown device';
export const UNKNOWN_BROWSER = 'Unknown browser';
export const SEPARATOR = '·';

/** Order matters: an iPhone UA contains "Mac OS X", a Chrome UA contains "Safari". */
const DEVICE_PATTERNS: ReadonlyArray<readonly [RegExp, DeviceKind]> = [
  [/iPhone/i, 'iPhone'],
  [/iPad/i, 'iPad'],
  [/Android/i, 'Android'],
  [/Windows NT/i, 'Windows PC'],
  [/Mac OS X|Macintosh/i, 'Mac'],
  [/(Linux|X11)/i, 'Linux'],
];

const BROWSER_PATTERNS: ReadonlyArray<readonly [RegExp, BrowserKind]> = [
  [/Edg(A|iOS)?\//i, 'Edge'],
  [/OPR\/|Opera/i, 'Opera'],
  [/Firefox\/|FxiOS\//i, 'Firefox'],
  [/(Chrome|CriOS)\//i, 'Chrome'],
  [/Safari\//i, 'Safari'],
];

export function deviceKind(userAgent: string | null | undefined): DeviceKind | null {
  if (userAgent === null || userAgent === undefined || userAgent === '') return null;
  for (const [pattern, kind] of DEVICE_PATTERNS) {
    if (pattern.test(userAgent)) return kind;
  }
  return null;
}

export function browserKind(userAgent: string | null | undefined): BrowserKind | null {
  if (userAgent === null || userAgent === undefined || userAgent === '') return null;
  for (const [pattern, kind] of BROWSER_PATTERNS) {
    if (pattern.test(userAgent)) return kind;
  }
  return null;
}

/** `"Mac · Safari"`, `"Windows PC · Chrome"`, `"Unknown device · Unknown browser"`. */
export function deviceLabel(userAgent: string | null | undefined): string {
  return `${deviceKind(userAgent) ?? UNKNOWN_DEVICE} ${SEPARATOR} ${browserKind(userAgent) ?? UNKNOWN_BROWSER}`;
}

export interface GeoHeaders {
  'cf-ipcity'?: string | string[];
  'cf-ipcountry'?: string | string[];
}

function first(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value === '' ? undefined : value;
}

/** `"Nairobi, KE"` from Cloudflare's edge headers, or `null` when they are absent. */
export function geoLabel(headers: GeoHeaders): string | null {
  const city = first(headers['cf-ipcity']);
  const country = first(headers['cf-ipcountry']);
  if (city !== undefined && country !== undefined) return `${city}, ${country}`;
  if (city !== undefined) return city;
  if (country !== undefined) return country;
  return null;
}

/** The two-letter country Cloudflare resolved, for `user_sessions.geo_country`. */
export function geoCountry(headers: GeoHeaders): string | null {
  return first(headers['cf-ipcountry']) ?? null;
}

export function geoCity(headers: GeoHeaders): string | null {
  return first(headers['cf-ipcity']) ?? null;
}
