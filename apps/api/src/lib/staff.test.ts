import { describe, expect, it } from 'vitest';
import { STAFF_DOMAIN, isStaffDomainEmail, normalizeEmailDomain } from './staff.js';

/**
 * Work order Task 1 — the staff-domain normalisation behind the signup guard.
 * The guard must be impossible to bypass with case, whitespace, fullwidth
 * (NFKC) look-alikes or trailing dots, and must NEVER treat a look-alike that
 * punycodes to a different domain as the staff domain.
 */
describe('staff-domain normalisation', () => {
  it('pins the corrected single-n spelling', () => {
    expect(STAFF_DOMAIN).toBe('vunvault.com');
  });

  it('folds case, surrounding whitespace, NFKC and trailing dots onto the staff domain', () => {
    expect(isStaffDomainEmail('daniel@vunvault.com')).toBe(true);
    expect(isStaffDomainEmail('  Divine@VunVault.COM  ')).toBe(true);
    expect(isStaffDomainEmail('user@vunvault.com.')).toBe(true);
    // Fullwidth look-alikes: NFKC folds them onto the real ASCII domain.
    expect(isStaffDomainEmail('user@ｖｕｎｖａｕｌｔ.ｃｏｍ')).toBe(true);
    expect(isStaffDomainEmail('user@VUNVAULT.COM')).toBe(true);
  });

  it('treats look-alike domains as ordinary external addresses (never staff)', () => {
    expect(isStaffDomainEmail('user@vunnvault.com')).toBe(false); // double-n
    expect(isStaffDomainEmail('user@vunvau1t.com')).toBe(false); // digit one
    expect(isStaffDomainEmail('user@vunvault.co')).toBe(false); // wrong TLD
    expect(isStaffDomainEmail('user@notvunvault.com')).toBe(false); // suffix trap
    // Cyrillic "а" (U+0430) punycodes to xn--vunvult-5fg.com — a different
    // domain, so it is an external address, not a staff-domain bypass.
    expect(isStaffDomainEmail('user@vunvаult.com')).toBe(false);
    expect(normalizeEmailDomain('user@vunvаult.com')).toBe('xn--vunvult-5fg.com');
    expect(isStaffDomainEmail('someone@gmail.com')).toBe(false);
  });

  it('fails closed: unparsable addresses normalise to null', () => {
    expect(normalizeEmailDomain('not-an-email')).toBeNull();
    expect(normalizeEmailDomain('@vunvault.com')).toBeNull();
    expect(normalizeEmailDomain('user@')).toBeNull();
    expect(normalizeEmailDomain('')).toBeNull();
    // A whitespace-split domain fails the IDN conversion → null → refused.
    expect(normalizeEmailDomain('user@vunvault .com')).toBeNull();
    expect(isStaffDomainEmail('user@vunvault .com')).toBe(false);
  });

  it('normalises ordinary domains to punycode-safe lowercase ASCII', () => {
    expect(normalizeEmailDomain('Jane@Example.COM')).toBe('example.com');
    expect(normalizeEmailDomain('jane@example.com.')).toBe('example.com');
  });
});
