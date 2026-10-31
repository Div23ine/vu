import { describe, expect, it } from 'vitest';
import {
  browserKind,
  deviceKind,
  deviceLabel,
  geoCity,
  geoCountry,
  geoLabel,
  SEPARATOR,
  UNKNOWN_BROWSER,
  UNKNOWN_DEVICE,
} from './device.js';

const UA = {
  macSafari:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
  windowsChrome:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  iphoneSafari:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  androidChrome:
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
  linuxFirefox: 'Mozilla/5.0 (X11; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0',
  windowsEdge:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0',
};

describe('deviceLabel', () => {
  it('labels the documented device and browser combinations', () => {
    expect(deviceLabel(UA.macSafari)).toBe(`Mac ${SEPARATOR} Safari`);
    expect(deviceLabel(UA.windowsChrome)).toBe(`Windows PC ${SEPARATOR} Chrome`);
    expect(deviceLabel(UA.iphoneSafari)).toBe(`iPhone ${SEPARATOR} Safari`);
    expect(deviceLabel(UA.androidChrome)).toBe(`Android ${SEPARATOR} Chrome`);
    expect(deviceLabel(UA.linuxFirefox)).toBe(`Linux ${SEPARATOR} Firefox`);
  });

  it('does not mistake an iPhone for a Mac or Edge for Chrome', () => {
    expect(deviceKind(UA.iphoneSafari)).toBe('iPhone');
    expect(browserKind(UA.windowsEdge)).toBe('Edge');
    expect(browserKind(UA.windowsChrome)).toBe('Chrome');
  });

  it('falls back to Unknown for a missing or unrecognisable agent', () => {
    expect(deviceLabel(undefined)).toBe(`${UNKNOWN_DEVICE} ${SEPARATOR} ${UNKNOWN_BROWSER}`);
    expect(deviceLabel(null)).toBe(`${UNKNOWN_DEVICE} ${SEPARATOR} ${UNKNOWN_BROWSER}`);
    expect(deviceLabel('')).toBe(`${UNKNOWN_DEVICE} ${SEPARATOR} ${UNKNOWN_BROWSER}`);
    expect(deviceLabel('curl/8.4.0')).toBe(`${UNKNOWN_DEVICE} ${SEPARATOR} ${UNKNOWN_BROWSER}`);
  });

  it('never invents a model name', () => {
    // A user agent cannot say "MacBook Pro"; claiming it would put a fabricated
    // string in front of a security decision.
    expect(deviceLabel(UA.macSafari)).not.toContain('MacBook');
    expect(deviceLabel(UA.iphoneSafari)).not.toContain('15 Pro');
  });
});

describe('geoLabel', () => {
  it('reads Cloudflare edge headers', () => {
    expect(geoLabel({ 'cf-ipcity': 'Nairobi', 'cf-ipcountry': 'KE' })).toBe('Nairobi, KE');
    expect(geoLabel({ 'cf-ipcity': 'Frankfurt', 'cf-ipcountry': 'DE' })).toBe('Frankfurt, DE');
  });

  it('degrades gracefully when only part of the location is known', () => {
    expect(geoLabel({ 'cf-ipcountry': 'KE' })).toBe('KE');
    expect(geoLabel({ 'cf-ipcity': 'Nairobi' })).toBe('Nairobi');
    expect(geoLabel({})).toBeNull();
  });

  it('exposes the city and country separately for the session row', () => {
    expect(geoCity({ 'cf-ipcity': 'Nairobi', 'cf-ipcountry': 'KE' })).toBe('Nairobi');
    expect(geoCountry({ 'cf-ipcity': 'Nairobi', 'cf-ipcountry': 'KE' })).toBe('KE');
    expect(geoCountry({})).toBeNull();
    expect(geoCity({ 'cf-ipcity': ['Nairobi', 'Other'] })).toBe('Nairobi');
  });
});
