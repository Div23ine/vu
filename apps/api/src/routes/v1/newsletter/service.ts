import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import type { AuditEventType } from '../../../audit/events';
import { HttpError } from '../../../lib/http-error';
import type { NewsletterRepo } from '../store/repo';

/**
 * Double opt-in newsletter.
 *
 * The list is only worth anything if every address on it belongs to the person who
 * receives the mail, so a signup writes a `pending` row and emails a token; the
 * subscription is `confirmed` only when that token comes back. The same token also
 * unsubscribes, because whoever can prove they own the inbox can also leave it.
 *
 * The subscribe endpoint answers `202` whether or not the address exists, with the
 * same body and the same timing shape: "is this address on the list" is not a
 * question the internet gets to ask.
 *
 * Only the SHA-256 of the token is stored, and the raw token exists only inside the
 * confirmation email. The IP is hashed with a daily salt like every other address
 * the platform records.
 */

/** A resend is allowed at most once per ten minutes. */
export const RESEND_WINDOW_MS = 10 * 60 * 1000;

/** Tokens are 32 random bytes, hex — comfortably above the 20-character minimum. */
export const TOKEN_BYTES = 32;

export const CONFIRM_TEMPLATE = 'newsletter_confirm';

export interface AuditInstruction {
  eventType: AuditEventType;
  message: string;
  subject?: string;
  details?: Record<string, unknown>;
  actor?: { id: string | null; label: string };
}

export interface NewsletterServiceDeps {
  repo: NewsletterRepo;
  /** Sends the confirmation email; wired to `app.email` by the route. */
  sendEmail?: (input: { to: string; subject: string; text: string; html: string }) => Promise<void>;
  /** `${WEB_ORIGIN}/newsletter/confirm?token=<token>`. */
  confirmUrl?: (token: string) => string;
  /** Hash pepper for the IP digest. */
  ipSaltPepper?: string;
  now?: () => Date;
  randomUuid?: () => string;
  randomToken?: () => string;
}

/** SHA-256 of the address and the day's salt: never the address itself. */
export function hashIp(ip: string, now: Date, pepper: string): string | null {
  if (ip === '') return null;
  const salt = `${now.toISOString().slice(0, 10)}:${pepper}`;
  return createHash('sha256').update(`${ip}|${salt}`, 'utf8').digest('hex');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

/** Constant-time comparison of two hex digests. */
export function digestsMatch(left: string, right: string): boolean {
  const a = Buffer.from(left, 'hex');
  const b = Buffer.from(right, 'hex');
  return a.length === b.length && a.length > 0 && timingSafeEqual(a, b);
}

export class NewsletterService {
  private readonly repo: NewsletterRepo;
  private readonly deps: NewsletterServiceDeps;
  private readonly now: () => Date;
  private readonly randomUuid: () => string;
  private readonly randomToken: () => string;

  constructor(deps: NewsletterServiceDeps) {
    this.deps = deps;
    this.repo = deps.repo;
    this.now = deps.now ?? (() => new Date());
    this.randomUuid = deps.randomUuid ?? (() => randomUUID());
    this.randomToken = deps.randomToken ?? (() => randomBytes(TOKEN_BYTES).toString('hex'));
  }

  /**
   * Start (or restart) a subscription.
   *
   * Always resolves; the caller answers `202` either way. A confirmed address gets
   * no email — re-confirming a subscription that is already confirmed would be
   * noise, and the sender reputation pays for it.
   */
  async subscribe(input: {
    email: string;
    source?: string;
    ip: string;
  }): Promise<{ emailed: boolean }> {
    const email = input.email.trim().toLowerCase();
    const existing = await this.repo.findByEmail(email);
    const at = this.now();

    if (existing !== null && existing.status === 'confirmed') {
      return { emailed: false };
    }
    if (
      existing !== null &&
      existing.status === 'pending' &&
      at.getTime() - new Date(existing.updatedAt).getTime() < RESEND_WINDOW_MS
    ) {
      // Throttled resend: the row stays as it is, and the answer is identical.
      return { emailed: false };
    }

    const token = this.randomToken();
    await this.repo.upsertPending({
      id: existing?.id ?? this.randomUuid(),
      email,
      tokenHash: hashToken(token),
      source: input.source ?? null,
      ipHash: hashIp(input.ip, at, this.deps.ipSaltPepper ?? ''),
      at,
    });

    await this.sendConfirmation(email, token);
    return { emailed: true };
  }

  private async sendConfirmation(email: string, token: string): Promise<void> {
    if (this.deps.sendEmail === undefined || this.deps.confirmUrl === undefined) return;
    const url = this.deps.confirmUrl(token);
    await this.deps.sendEmail({
      to: email,
      subject: 'Confirm your VUNVAULT threat advisory subscription',
      text: `Confirm your subscription to the VUNVAULT Threat Advisory Newsletter: ${url}\n\nIf you did not ask for this, ignore this email and nothing will be sent to you.`,
      html: `<p>Confirm your subscription to the VUNVAULT Threat Advisory Newsletter:</p><p><a href="${url}">${url}</a></p><p>If you did not ask for this, ignore this email and nothing will be sent to you.</p>`,
    });
  }

  /** Confirm with the emailed token. An unknown token is a plain 404. */
  async confirm(token: string): Promise<{ email: string; audit: AuditInstruction[] }> {
    const row = await this.repo.findByTokenHash(hashToken(token));
    if (row === null) throw HttpError.notFound();
    await this.repo.confirm(row.id, this.now());
    return {
      email: row.email,
      audit: [
        {
          eventType: 'NEWSLETTER_SUBSCRIBED',
          subject: row.id,
          // The address is not in the entry: the chain is readable by every auditor.
          message: 'Newsletter subscription confirmed',
          details: { subscriberId: row.id, source: row.source },
        },
      ],
    };
  }

  async unsubscribe(token: string): Promise<{ email: string; audit: AuditInstruction[] }> {
    const row = await this.repo.findByTokenHash(hashToken(token));
    if (row === null) throw HttpError.notFound();
    await this.repo.unsubscribe(row.id, this.now());
    return {
      email: row.email,
      audit: [
        {
          eventType: 'NEWSLETTER_UNSUBSCRIBED',
          subject: row.id,
          message: 'Newsletter subscription removed',
          details: { subscriberId: row.id },
        },
      ],
    };
  }
}
