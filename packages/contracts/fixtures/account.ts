import { NOTIFICATION_EVENTS } from '@vunvault/db/enum-values';
import type {
  MfaStatus,
  NotificationPrefs,
  ProfileSettings,
  SecurityPosture,
  SessionView,
} from '../src/account';
import { DEFAULT_CHANNEL_TOGGLES } from '../src/account';
import { postureScore } from '../src/account';

/**
 * Password Manager / Profile Settings fixtures for Dr. Evelyn Reed
 * (`c0000000-0000-4000-8000-000000000001` in `fixtures/users.ts`).
 * Reference "now" is 2026-09-24T12:00:00Z.
 */

const REED_ID = 'c0000000-0000-4000-8000-000000000001';

export const sessions: SessionView[] = [
  {
    id: '20000000-0000-4000-8000-000000000001',
    deviceLabel: 'MacBook Pro · Safari',
    ip: '196.201.214.77',
    location: 'Nairobi, KE',
    mfaMethod: 'webauthn',
    startedAt: '2026-09-24T09:41:00Z',
    current: true,
  },
  {
    id: '20000000-0000-4000-8000-000000000002',
    deviceLabel: 'iPhone 15 Pro · Safari',
    ip: '196.201.214.82',
    location: 'Nairobi, KE',
    mfaMethod: 'totp',
    startedAt: '2026-09-24T07:12:00Z',
    current: false,
  },
  {
    id: '20000000-0000-4000-8000-000000000003',
    deviceLabel: 'ThinkPad X1 · Chrome',
    ip: '185.220.101.9',
    location: 'Frankfurt, DE',
    mfaMethod: null,
    startedAt: '2026-09-23T21:04:00Z',
    current: false,
  },
];

export const mfaStatus: MfaStatus = {
  totp: { enabled: true, factorId: 'factor-01HZX9K3Q7V2T8AB' },
  webauthn: {
    keys: [
      {
        id: '30000000-0000-4000-8000-000000000001',
        deviceName: 'YubiKey 5C NFC',
        createdAt: '2026-08-12T00:00:00Z',
        lastUsedAt: '2026-09-24T09:41:00Z',
      },
    ],
  },
  recovery: {
    generated: true,
    remaining: 3,
    total: 10,
    generatedAt: '2026-08-12T00:00:00Z',
  },
  require2fa: true,
  lastFactorChangeAt: '2026-08-12T00:00:00Z',
};

const POSTURE_COMPLETED = 3;
const POSTURE_TOTAL = 4;

/**
 * The score is the formula `round(100 × completed ÷ total)` = 75, not the
 * prototype's hand-written 80: Part 2 decision 3 states the formula wins.
 */
export const securityPosture: SecurityPosture = {
  score: postureScore(POSTURE_COMPLETED, POSTURE_TOTAL),
  label: 'Strong posture',
  completed: POSTURE_COMPLETED,
  total: POSTURE_TOTAL,
  items: [
    { id: 'hardware_key', label: 'Hardware-key MFA registered', done: true },
    { id: 'recovery_codes', label: 'Recovery codes generated', done: true },
    { id: 'password_age', label: 'Password updated within 90 days', done: true },
    { id: 'backup_key', label: 'Register a backup hardware key', done: false },
  ],
};

export const profileSettings: ProfileSettings = {
  id: REED_ID,
  firstName: 'Evelyn',
  lastName: 'Reed',
  displayName: 'e.reed',
  jobTitle: null,
  email: 'e.reed@vunvault.com',
  phone: null,
  timezone: 'Africa/Nairobi',
  language: 'en-GB',
  bio: "Cybersecurity leader driving VUNVAULT's offensive and defensive programmes across Africa. Incident commander for SEV-1 events and final approver at the Mandatory Admin Review Gate.",
  avatarUrl: null,
  role: 'super_admin',
  team: null,
  memberSince: '2024-03-04T09:00:00Z',
  username: 'e.reed',
  mfaSummary: 'Hardware key',
  lastSignInAt: '2026-09-24T09:41:00Z',
  activeSessions: 3,
  require2fa: true,
};

/** Every event at the planner's defaults; quiet hours off. */
export const notificationPrefs: NotificationPrefs = {
  events: NOTIFICATION_EVENTS.reduce(
    (accumulator, event) => ({ ...accumulator, [event]: { ...DEFAULT_CHANNEL_TOGGLES } }),
    {} as NotificationPrefs['events'],
  ),
  quietHours: { enabled: false, from: null, to: null },
};
