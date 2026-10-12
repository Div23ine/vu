import { describe, expect, it } from 'vitest';
import {
  can,
  canAny,
  homeFor,
  isStaffRole,
  STAFF_ROLES,
  type PermissionHolder,
} from './permissions';

const scansReader: PermissionHolder = { permissions: ['scans:read', 'profile:read'] };
const releaseAuthority: PermissionHolder = { permissions: ['scans:release'] };

describe('STAFF_ROLES / isStaffRole', () => {
  it('lists the six staff roles and excludes the client role', () => {
    expect(STAFF_ROLES).toEqual([
      'super_admin',
      'admin',
      'security_analyst',
      'soc_operator',
      'compliance_auditor',
      'support_engineer',
    ]);
    expect(isStaffRole('admin')).toBe(true);
    expect(isStaffRole('support_engineer')).toBe(true);
    expect(isStaffRole('client')).toBe(false);
  });
});

describe('homeFor', () => {
  it('sends clients to the portal', () => {
    expect(homeFor('client')).toBe('/portal');
  });

  it('sends support engineers to their profile — they hold no dashboard:read', () => {
    expect(homeFor('support_engineer')).toBe('/admin/profile');
  });

  it('sends every other staff role to the Command Center', () => {
    expect(homeFor('super_admin')).toBe('/admin');
    expect(homeFor('admin')).toBe('/admin');
    expect(homeFor('security_analyst')).toBe('/admin');
    expect(homeFor('soc_operator')).toBe('/admin');
    expect(homeFor('compliance_auditor')).toBe('/admin');
  });
});

describe('can / canAny', () => {
  it('follows the permission list', () => {
    expect(can(scansReader, 'scans:read')).toBe(true);
    expect(can(scansReader, 'scans:release')).toBe(false);
    expect(can(releaseAuthority, 'scans:release')).toBe(true);
  });

  it('denies everything for a missing user', () => {
    expect(can(null, 'scans:read')).toBe(false);
    expect(can(undefined, 'profile:read')).toBe(false);
    expect(canAny(null, ['scans:read', 'profile:read'])).toBe(false);
  });

  it('canAny needs only one match, and an empty list denies', () => {
    expect(canAny(scansReader, ['users:read', 'scans:read'])).toBe(true);
    expect(canAny(scansReader, ['users:read', 'audit:read'])).toBe(false);
    expect(canAny(scansReader, [])).toBe(false);
  });
});
