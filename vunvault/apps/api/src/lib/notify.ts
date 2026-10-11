import {
  DEFAULT_CHANNEL_TOGGLES,
  type ChannelToggles,
  type NotificationEvent,
  type NotifyJobPayload,
} from '@vunvault/contracts';

/**
 * Notification dispatch.
 *
 * The dispatcher is the only place that decides *whether* a notification goes
 * out and *how*. Routes and workers just say "this happened to this user"; the
 * user's own preferences, their quiet hours and the criticality of the event
 * decide the rest.
 *
 * `critical: true` — credential changes, SEV-1 broadcasts, review-gate
 * escalations and incident-commander pages — ignores both opt-outs and quiet
 * hours. That is deliberate: the events it is used for are exactly the ones a
 * user must not be able to silence.
 */

export type NotifyChannel = 'in_app' | 'email' | 'sms' | 'push';

export interface NotifyRecipient {
  userId: string;
  email: string;
  phone: string | null;
  /** IANA name, e.g. `Africa/Nairobi`; quiet hours are evaluated in it. */
  timezone: string;
}

export interface QuietHours {
  enabled: boolean;
  from: string | null;
  to: string | null;
}

export interface NotificationPreferenceReader {
  recipient(userId: string): Promise<NotifyRecipient>;
  toggles(userId: string, event: NotificationEvent): Promise<ChannelToggles>;
  quietHours(userId: string): Promise<QuietHours>;
}

export interface DispatchInput {
  userId: string;
  event: NotificationEvent;
  title: string;
  body: string;
  critical?: boolean;
}

export interface DispatchResult {
  /** Channels a `notify` job was enqueued for. */
  enqueued: NotifyChannel[];
  /** Channels suppressed by preference or quiet hours. */
  suppressed: NotifyChannel[];
}

export interface NotificationDispatcherDeps {
  prefs: NotificationPreferenceReader;
  enqueue(payload: NotifyJobPayload): Promise<void>;
  /** Test seam: fixed clock. */
  now?: () => Date;
  debug?: (message: string, fields?: Record<string, unknown>) => void;
}

const ALL_CHANNELS: NotifyChannel[] = ['in_app', 'email', 'sms', 'push'];
const CRITICAL_TOGGLES: ChannelToggles = { inApp: true, email: true, sms: true, push: true };

export class NotificationDispatcher {
  private readonly prefs: NotificationPreferenceReader;
  private readonly enqueue: (payload: NotifyJobPayload) => Promise<void>;
  private readonly now: () => Date;
  private readonly debug: (message: string, fields?: Record<string, unknown>) => void;

  constructor(deps: NotificationDispatcherDeps) {
    this.prefs = deps.prefs;
    this.enqueue = deps.enqueue;
    this.now = deps.now ?? (() => new Date());
    this.debug = deps.debug ?? (() => undefined);
  }

  async dispatch(input: DispatchInput): Promise<DispatchResult> {
    const critical = input.critical === true;
    const recipient = await this.prefs.recipient(input.userId);
    const toggles = critical
      ? CRITICAL_TOGGLES
      : await this.prefs.toggles(input.userId, input.event);

    // Quiet hours only ever soften a notification; they never silence a critical
    // one, and they never suppress the in-app inbox or email.
    const quiet = !critical && (await this.isQuietHours(input.userId, recipient.timezone));

    const enqueued: NotifyChannel[] = [];
    const suppressed: NotifyChannel[] = [];
    const decide = (channel: NotifyChannel, allowed: boolean): boolean => {
      if (allowed) {
        enqueued.push(channel);
        return true;
      }
      suppressed.push(channel);
      return false;
    };

    if (decide('in_app', toggles.inApp)) {
      await this.enqueue({
        channel: 'in_app',
        userId: recipient.userId,
        event: input.event,
        title: input.title,
        body: input.body,
      });
    }

    if (decide('email', toggles.email)) {
      await this.enqueue({
        channel: 'email',
        to: recipient.email,
        template: input.event,
        vars: { title: input.title, body: input.body },
      });
    }

    // SMS needs a phone number to exist, and is dropped during quiet hours.
    const smsAllowed = toggles.sms && recipient.phone !== null && !quiet;
    if (decide('sms', smsAllowed) && recipient.phone !== null) {
      await this.enqueue({
        channel: 'sms',
        to: recipient.phone,
        body: `${input.title}: ${input.body}`.slice(0, 480),
      });
    }

    // Push is recorded in the preferences and dropped during quiet hours, but no
    // push provider exists yet: the job is not enqueued, only logged.
    if (decide('push', toggles.push && !quiet)) {
      this.debug('push notification recorded but not delivered (no provider yet)', {
        userId: recipient.userId,
        event: input.event,
      });
    }

    return { enqueued, suppressed };
  }

  /** True when "now" in the recipient's timezone falls inside their quiet window. */
  async isQuietHours(userId: string, timezone: string): Promise<boolean> {
    const quiet = await this.prefs.quietHours(userId);
    if (!quiet.enabled || quiet.from === null || quiet.to === null) return false;
    const from = parseTimeOfDay(quiet.from);
    const to = parseTimeOfDay(quiet.to);
    if (from === null || to === null) return false;
    return isWithinQuietHours(minutesOfDay(this.now(), timezone), from, to);
  }
}

/** `HH:MM` → minutes since midnight, or null when it is not a valid clock time. */
export function parseTimeOfDay(value: string): number | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (match === null) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

/** Minutes since midnight in `timezone`, using the platform's IANA database. */
export function minutesOfDay(at: Date, timezone: string): number {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(at);
    const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? '0');
    const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? '0');
    // `en-GB` renders midnight as "24" in some engines.
    return ((hour % 24) * 60 + minute) % 1440;
  } catch {
    // An unknown timezone must not break delivery: fall back to UTC.
    return at.getUTCHours() * 60 + at.getUTCMinutes();
  }
}

/**
 * Quiet windows may cross midnight (`22:00`–`06:00`), so the comparison depends
 * on the order of the bounds.
 */
export function isWithinQuietHours(now: number, from: number, to: number): boolean {
  if (from === to) return false;
  return from < to ? now >= from && now < to : now >= from || now < to;
}

export { ALL_CHANNELS, DEFAULT_CHANNEL_TOGGLES };
