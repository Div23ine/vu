import { describe, expect, it } from 'vitest';
import {
  ADMIN_MFA_SETUP_WINDOW_SECONDS,
  ADMIN_ROSTER,
  SECOND_SUPER_ADMIN_EMAIL,
  SUPER_ADMIN_EMAIL,
  isAdminEmail,
  isMfaSetupExempt,
  populatedRosterSlots,
  rosterSlotFor,
} from './admin-roster.js';

/**
 * The administrator roster is the provisioning source of truth (Phase 2,
 * work order §2). These tests PIN the config: nine slots, five populated,
 * four null placeholders; the hard constraint that `divine@vunvault.com` is
 * Divine Gospel — SUPER ADMIN, exempt from the setup timer and from
 * `blocked_mfa_setup` — plus the login work order's second super admin
 * (`gospelu214+vu6@gmail.com`, same exemption) and the 5:00 window on every
 * other slot. Names come from the contributor records and are never invented.
 */

describe('admin roster — shape', () => {
  it('carries exactly nine slots: five populated, four null placeholders', () => {
    expect(ADMIN_ROSTER).toHaveLength(9);
    expect(populatedRosterSlots()).toHaveLength(5);
    const placeholders = ADMIN_ROSTER.filter((slot) => slot.email === null);
    expect(placeholders).toHaveLength(4);
    for (const slot of placeholders) {
      expect(slot.fullName).toBeNull();
      expect(slot.role).toBe('admin');
      expect(slot.mfaSetupWindowSeconds).toBe(ADMIN_MFA_SETUP_WINDOW_SECONDS);
    }
  });

  it('pins the hard constraint: divine@vunvault.com is Divine Gospel, SUPER ADMIN, EXEMPT', () => {
    expect(SUPER_ADMIN_EMAIL).toBe('divine@vunvault.com');
    const divine = rosterSlotFor('divine@vunvault.com');
    expect(divine).not.toBeNull();
    expect(divine?.fullName).toBe('Divine Gospel');
    expect(divine?.fullName).not.toBe('Thugu Maina');
    expect(divine?.role).toBe('super_admin');
    // Exempt: no timer, no block, MFA optional.
    expect(divine?.mfaSetupWindowSeconds).toBeNull();
    expect(isMfaSetupExempt('divine@vunvault.com')).toBe(true);
  });

  it('pins the login work order: gospelu214+vu6@gmail.com is a SUPER ADMIN, EXEMPT', () => {
    expect(SECOND_SUPER_ADMIN_EMAIL).toBe('gospelu214+vu6@gmail.com');
    const slot = rosterSlotFor('gospelu214+vu6@gmail.com');
    expect(slot).not.toBeNull();
    expect(slot?.role).toBe('super_admin');
    expect(slot?.mfaSetupWindowSeconds).toBeNull();
    expect(isAdminEmail('gospelu214+vu6@gmail.com')).toBe(true);
    expect(isMfaSetupExempt('gospelu214+vu6@gmail.com')).toBe(true);
  });

  it('gives every populated non-exempt slot the visible 5:00 window', () => {
    expect(ADMIN_MFA_SETUP_WINDOW_SECONDS).toBe(300);
    for (const slot of populatedRosterSlots()) {
      if (slot.email === SUPER_ADMIN_EMAIL || slot.email === SECOND_SUPER_ADMIN_EMAIL) continue;
      expect(slot.role, slot.email).toBe('admin');
      expect(slot.mfaSetupWindowSeconds, slot.email).toBe(300);
      expect(isMfaSetupExempt(slot.email)).toBe(false);
    }
  });

  it('resolves the four names from the contributor records', () => {
    expect(rosterSlotFor('daniel@vunvault.com')).toMatchObject({
      fullName: 'Daniel Okafor',
      jobTitle: 'Security and Project Coordinator',
      role: 'admin',
    });
    expect(rosterSlotFor('tshepiso@vunvault.com')).toMatchObject({
      fullName: 'Raphunga Tshepiso',
      jobTitle: 'Research Analyst',
      role: 'admin',
    });
    // about-data.ts spells it "Bukeonya"; the work-order resolution records
    // "Bukenoya Natasha" as canonical (variant flagged in the playbook).
    expect(rosterSlotFor('bukenya@vunvault.com')).toMatchObject({
      fullName: 'Bukenoya Natasha',
      jobTitle: 'Cybersecurity Analyst',
      role: 'admin',
    });
  });
});

describe('admin roster — lookups', () => {
  it('matches emails case-insensitively and tolerates whitespace', () => {
    expect(rosterSlotFor('  DANIEL@VUNVAULT.COM ')?.fullName).toBe('Daniel Okafor');
    expect(isAdminEmail('Divine@vunvault.com')).toBe(true);
  });

  it('never matches addresses that are not on the roster', () => {
    expect(rosterSlotFor('nobody@vunvault.com')).toBeNull();
    expect(isAdminEmail('nobody@vunvault.com')).toBe(false);
    expect(isAdminEmail('e.reed@vunvault.com')).toBe(false); // staff, but not a roster slot
    expect(isMfaSetupExempt('nobody@vunvault.com')).toBe(false);
  });

  it('exposes exactly the two exempt super-admin identities', () => {
    const exempt = ADMIN_ROSTER.filter((slot) => slot.mfaSetupWindowSeconds === null);
    expect(exempt).toHaveLength(2);
    expect(exempt.map((slot) => slot.email).sort()).toEqual(
      [SUPER_ADMIN_EMAIL, SECOND_SUPER_ADMIN_EMAIL].sort(),
    );
  });
});
