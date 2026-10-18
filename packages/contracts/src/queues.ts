import { z } from 'zod';
import { NotificationEventSchema, ScanTypeSchema } from './enums.js';

/**
 * Queue names and job payloads, shared by the API (producer) and the three
 * workers (consumers). A worker never trusts a job body it has not parsed with
 * the schema defined here.
 */

export const QUEUE_NAMES = {
  scan: 'scan',
  broadcast: 'broadcast',
  maintenance: 'maintenance',
  pdf: 'pdf',
  notify: 'notify',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

export const QUEUE_NAME_VALUES = Object.values(QUEUE_NAMES);

export const ScanJobPayload = z.object({
  jobId: z.string().uuid(),
  attempt: z.number().int().min(1),
  targetHost: z.string(),
  scanType: ScanTypeSchema,
  requestedBy: z.string().uuid().nullable(),
});
export type ScanJobPayload = z.infer<typeof ScanJobPayload>;

export const BroadcastJobPayload = z.object({
  broadcastId: z.string().uuid(),
  advisoryId: z.string().uuid(),
  kind: z.enum(['initial', 'rebroadcast', 'retraction']),
});
export type BroadcastJobPayload = z.infer<typeof BroadcastJobPayload>;

export const PdfJobPayload = z.object({
  kind: z.enum(['invoice', 'report']),
  refId: z.string().uuid(),
});
export type PdfJobPayload = z.infer<typeof PdfJobPayload>;

export const NotifyJobPayload = z.discriminatedUnion('channel', [
  z.object({
    channel: z.literal('email'),
    to: z.string().email(),
    template: z.string(),
    vars: z.record(z.string()),
  }),
  z.object({
    channel: z.literal('sms'),
    to: z.string(),
    body: z.string().max(480),
  }),
  z.object({
    channel: z.literal('in_app'),
    userId: z.string().uuid(),
    event: NotificationEventSchema,
    title: z.string(),
    body: z.string(),
  }),
]);
export type NotifyJobPayload = z.infer<typeof NotifyJobPayload>;

export const MAINTENANCE_TASKS = [
  'purge_login_attempts',
  'verify_chain',
  'node_health',
  'metrics_rollup',
  'threat_level',
  'expire_invitations',
  'flag_dormant_accounts',
  'audit_snapshot',
  // Task 91/92 addenda: scheduled content publish, signup decay, the broadcast
  // outbox sweep and the media validation pass. Appended, never reordered —
  // the enum order is part of the wire contract's stability story.
  'scheduled_publish',
  'stale_signups',
  'outbox_reenqueue',
  'media_scan',
] as const;
export type MaintenanceTask = (typeof MAINTENANCE_TASKS)[number];

export const MaintenanceJobPayload = z.object({
  task: z.enum(MAINTENANCE_TASKS),
});
export type MaintenanceJobPayload = z.infer<typeof MaintenanceJobPayload>;

/** Payload schema per queue, so a producer can validate before it enqueues. */
export const QUEUE_PAYLOADS = {
  scan: ScanJobPayload,
  broadcast: BroadcastJobPayload,
  pdf: PdfJobPayload,
  notify: NotifyJobPayload,
  maintenance: MaintenanceJobPayload,
} as const;
