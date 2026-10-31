/**
 * The administrator roster (Phase 2, magic-link work order).
 *
 * Provisioning is DATA-DRIVEN from this single config list: nine slots, four
 * populated and five `null` placeholders. Filling a slot means editing this
 * file and re-running `pnpm --filter @vunvault/api provision:admins` — no
 * migration, no code change anywhere else.
 *
 * Names are resolved by matching the roster email against the contributor
 * records (`apps/web/src/app/(marketing)/about/_data/about-data.ts`); a name
 * is NEVER invented. Where the contributor data disagrees with itself the
 * chosen spelling is documented per slot.
 *
 * MFA setup window: an administrator signing in for the first time gets a
 * visible 5:00 countdown to enrol an authenticator; expiry or abandonment
 * moves the account to `blocked_mfa_setup` until a super admin unblocks it.
 * The SUPER ADMIN below (`divine@vunvault.com`, Divine Gospel) is EXEMPT —
 * no timer, no block, MFA optional — per the work order's hard constraint.
 */

/** Seconds an administrator has to complete first-sign-in MFA setup (5:00). */
export const ADMIN_MFA_SETUP_WINDOW_SECONDS = 300;

/**
 * The exempt super admin. Hard constraint from the work order:
 * `divine@vunvault.com` is **Divine Gospel** (NOT Thugu Maina), SUPER ADMIN,
 * exempt from the setup timeout and from `blocked_mfa_setup` entirely.
 */
export const SUPER_ADMIN_EMAIL = 'divine@vunvault.com';

export interface AdminRosterSlot {
  /** `null` = an unfilled placeholder slot (provisioning skips it). */
  email: string | null;
  /**
   * Display name resolved from the contributor records — never invented.
   * `null` while the slot is a placeholder.
   */
  fullName: string | null;
  /** Job title from the contributor records; `null` when the person is not a contributor. */
  jobTitle: string | null;
  role: 'admin' | 'super_admin';
  /**
   * First-sign-in MFA setup window in seconds; `null` = EXEMPT (no timer, no
   * block, MFA optional). Only the super-admin slot is exempt.
   */
  mfaSetupWindowSeconds: number | null;
}

/**
 * The nine slots. Placeholders 5–9 stay `null` until the pending admin emails
 * are supplied (playbook → Known Gaps); each filled slot must carry a name
 * resolved from the contributor records.
 */
export const ADMIN_ROSTER: readonly AdminRosterSlot[] = [
  {
    email: 'daniel@vunvault.com',
    fullName: 'Daniel Okafor',
    jobTitle: 'Security and Project Coordinator',
    role: 'admin',
    mfaSetupWindowSeconds: ADMIN_MFA_SETUP_WINDOW_SECONDS,
  },
  {
    email: SUPER_ADMIN_EMAIL,
    fullName: 'Divine Gospel',
    jobTitle: null, // not in the contributor records; the name is the work order's hard constraint
    role: 'super_admin',
    mfaSetupWindowSeconds: null, // EXEMPT: no timer, no block, MFA optional
  },
  {
    email: 'tshepiso@vunvault.com',
    fullName: 'Raphunga Tshepiso',
    jobTitle: 'Research Analyst',
    role: 'admin',
    mfaSetupWindowSeconds: ADMIN_MFA_SETUP_WINDOW_SECONDS,
  },
  {
    // about-data.ts spells the name "Bukeonya Natasha"; the work-order
    // resolution records "Bukenoya Natasha" as canonical (variant flagged in
    // the playbook).
    email: 'bukenya@vunvault.com',
    fullName: 'Bukenoya Natasha',
    jobTitle: 'Cybersecurity Analyst',
    role: 'admin',
    mfaSetupWindowSeconds: ADMIN_MFA_SETUP_WINDOW_SECONDS,
  },
  {
    email: null,
    fullName: null,
    jobTitle: null,
    role: 'admin',
    mfaSetupWindowSeconds: ADMIN_MFA_SETUP_WINDOW_SECONDS,
  },
  {
    email: null,
    fullName: null,
    jobTitle: null,
    role: 'admin',
    mfaSetupWindowSeconds: ADMIN_MFA_SETUP_WINDOW_SECONDS,
  },
  {
    email: null,
    fullName: null,
    jobTitle: null,
    role: 'admin',
    mfaSetupWindowSeconds: ADMIN_MFA_SETUP_WINDOW_SECONDS,
  },
  {
    email: null,
    fullName: null,
    jobTitle: null,
    role: 'admin',
    mfaSetupWindowSeconds: ADMIN_MFA_SETUP_WINDOW_SECONDS,
  },
  {
    email: null,
    fullName: null,
    jobTitle: null,
    role: 'admin',
    mfaSetupWindowSeconds: ADMIN_MFA_SETUP_WINDOW_SECONDS,
  },
];

/** A slot with its email and resolved name filled in — provisionable. */
export interface PopulatedAdminRosterSlot extends AdminRosterSlot {
  email: string;
  fullName: string;
}

/** The slots that can actually be provisioned (placeholders excluded). */
export function populatedRosterSlots(): readonly PopulatedAdminRosterSlot[] {
  return ADMIN_ROSTER.filter(
    (slot): slot is PopulatedAdminRosterSlot => slot.email !== null && slot.fullName !== null,
  );
}

/** The slot for an email address, or null when the address is not on the roster. */
export function rosterSlotFor(email: string): AdminRosterSlot | null {
  const needle = email.trim().toLowerCase();
  return ADMIN_ROSTER.find((slot) => slot.email !== null && slot.email === needle) ?? null;
}

/** True when a FILLED roster slot owns this address (placeholders match nothing). */
export function isAdminEmail(email: string): boolean {
  return rosterSlotFor(email) !== null;
}

/**
 * True when the address is exempt from the first-sign-in setup window (no
 * timer, no `blocked_mfa_setup`, MFA optional). Only the super-admin slot.
 */
export function isMfaSetupExempt(email: string): boolean {
  const slot = rosterSlotFor(email);
  return slot !== null && slot.mfaSetupWindowSeconds === null;
}
