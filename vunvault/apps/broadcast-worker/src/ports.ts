import type {
  AdvisoryScopeEntry,
  BroadcastKind,
  BroadcastProgressEvent,
  BroadcastStatus,
  FindingSeverity,
  NotificationEvent,
} from '@vunvault/contracts';
import type { ClientAsset } from '@vunvault/lib/advisory-matching';

/**
 * Ports (Task 89) — the seams the broadcast worker depends on.
 *
 * Everything behind an interface here is external (Postgres, Redis, Resend,
 * the SMS router, the `notify` queue), so `delivery.ts` is testable with fakes
 * and never touches I/O directly. Delivery is at-least-once: the row status
 * (`sent`/`failed`) is the idempotency guard, and in-app enqueues carry stable
 * job ids so a redelivered job cannot double-post to an inbox.
 */

/** The `advisory_broadcasts` row, as the delivery service sees it. */
export interface BroadcastRow {
  id: string;
  advisoryId: string;
  kind: BroadcastKind;
  status: BroadcastStatus;
  triggeredBy: string;
  audienceDashboards: number;
  emailContacts: number;
  smsContacts: number;
  sentDashboards: number;
  sentEmail: number;
  sentSms: number;
  failed: number;
  queueJobId: string | null;
}

/** The advisory fields a notification is built from. Nothing secret, all public-safe. */
export interface AdvisoryDeliveryView {
  id: string;
  cveId: string;
  title: string;
  summary: string | null;
  remediation: string | null;
  references: string[];
  severity: FindingSeverity | null;
  cvss: string | null;
  status: string;
  scope: AdvisoryScopeEntry[];
  disclosureDate: string | null;
}

/** One contactable user of a matched organisation. */
export interface OrgContact {
  userId: string;
  orgId: string;
  email: string;
  fullName: string;
  phone: string | null;
}

/** Counter increments for a single flush. All optional; absent means unchanged. */
export interface CounterDelta {
  sentDashboards?: number;
  sentEmail?: number;
  sentSms?: number;
  failed?: number;
}

export interface BroadcastRepo {
  getBroadcast(broadcastId: string): Promise<BroadcastRow | null>;
  getAdvisory(advisoryId: string): Promise<AdvisoryDeliveryView | null>;
  /** The whole client estate; matching is done in memory (Task 38's rules). */
  listClientAssets(): Promise<ClientAsset[]>;
  /** Active, non-deleted client profiles belonging to the matched orgs. */
  listOrgContacts(orgIds: readonly string[]): Promise<OrgContact[]>;
  markSending(broadcastId: string, at: Date): Promise<void>;
  incrementCounters(broadcastId: string, delta: CounterDelta): Promise<void>;
  finish(broadcastId: string, status: 'sent' | 'failed', at: Date): Promise<void>;
  /** Published → retracted; a draft or already-retracted advisory is untouched. */
  retractAdvisory(advisoryId: string, at: Date): Promise<void>;
}

/** In-app delivery is enqueued for the notify worker (Task 90), not written here. */
export interface NotifyEnqueuer {
  enqueueInApp(
    payload: {
      userId: string;
      event: NotificationEvent;
      title: string;
      body: string;
    },
    jobId: string,
  ): Promise<void>;
}

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
}

export interface EmailSender {
  send(message: EmailMessage): Promise<{ id: string }>;
}

export interface SmsMessage {
  to: string;
  body: string;
}

export interface SmsSender {
  send(message: SmsMessage): Promise<{ id: string }>;
}

/** Progress telemetry for the Task 94 SSE relay. Failures must never abort delivery. */
export interface ProgressBus {
  publish(event: BroadcastProgressEvent): Promise<void>;
}

export interface Clock {
  now(): Date;
}

export interface Logger {
  info(message: string, fields?: Record<string, unknown>): void;
  warn(message: string, fields?: Record<string, unknown>): void;
  error(message: string, fields?: Record<string, unknown>): void;
  debug(message: string, fields?: Record<string, unknown>): void;
}
