import { createHash, randomUUID } from 'node:crypto';
import type { ContactBody, ContactCategories as ConsentCategories } from '@vunvault/contracts';
import type { AuditEventType } from '../../../audit/events.js';
import { HttpError } from '../../../lib/http-error.js';
import {
  dailySalt,
  type NewConsentRecord,
  type NewContactMessage,
  type PublicRepo,
} from './repo.js';
import type { TurnstileVerifier } from './turnstile.js';

/**
 * Public intake: the contact form and the consent banner.
 *
 * Three rules. The visitor's IP is hashed with a daily salt and the raw address is
 * never written anywhere. The audit entry for a contact message carries the
 * CATEGORY and nothing else — the message body is correspondence, and the chain is
 * not a mailbox. And a submission with the honeypot field filled in is accepted
 * with a `201` and then dropped: a bot that is told it failed learns what to fix.
 */

/** A journalist or blogger asking to be verified: it goes to the badge workflow. */
export const VERIFICATION_CATEGORY = 'journalist_blogger_profile_request';
/** The subject prefix that marks a message for the badge workflow. */
export const VERIFICATION_SUBJECT_PREFIX = '[Verification]';

/** Where a message goes when the category does not say otherwise. */
export const DEFAULT_INBOX_ENV = 'ENGAGEMENT_INBOX';

export interface AuditInstruction {
  eventType: AuditEventType;
  message: string;
  subject?: string;
  details?: Record<string, unknown>;
}

export interface ContactOutcome {
  /** False when the honeypot was filled: nothing was stored, nothing was sent. */
  stored: boolean;
  id: string;
  audit: AuditInstruction[];
  emails: Array<{ to: string; template: string; vars: Record<string, string> }>;
}

export interface ContactServiceDeps {
  repo: PublicRepo;
  turnstile?: TurnstileVerifier;
  /** `ENGAGEMENT_INBOX`: where sales and partnership messages land. */
  engagementInbox?: string;
  /** Where a general support message lands instead. */
  supportInbox?: string;
  /** Hash pepper for the IP digest; a secret in production. */
  ipSaltPepper?: string;
  now?: () => Date;
  randomUuid?: () => string;
}

export class ContactService {
  private readonly repo: PublicRepo;
  private readonly turnstile: TurnstileVerifier | undefined;
  private readonly engagementInbox: string;
  private readonly supportInbox: string;
  private readonly pepper: string;
  private readonly now: () => Date;
  private readonly randomUuid: () => string;

  constructor(deps: ContactServiceDeps) {
    this.repo = deps.repo;
    this.turnstile = deps.turnstile;
    this.engagementInbox = deps.engagementInbox ?? '';
    this.supportInbox = deps.supportInbox ?? '';
    this.pepper = deps.ipSaltPepper ?? '';
    this.now = deps.now ?? (() => new Date());
    this.randomUuid = deps.randomUuid ?? (() => randomUUID());
  }

  async submit(
    body: ContactBody & { website?: string; turnstileToken?: string },
    meta: { ip: string; userAgent?: string | null },
  ): Promise<ContactOutcome> {
    // The honeypot: a real browser never renders this field, so anything in it is a
    // bot. Answer 201 and do nothing at all.
    if (body.website !== undefined && body.website.trim() !== '') {
      return { stored: false, id: this.randomUuid(), audit: [], emails: [] };
    }

    if (this.turnstile !== undefined) await this.turnstile.assertHuman(body.turnstileToken);

    const at = this.now();
    const id = this.randomUuid();
    const verification = body.category === VERIFICATION_CATEGORY;

    await this.repo.insertContactMessage({
      id,
      name: body.name,
      email: body.email,
      organization: body.organization ?? null,
      category: body.category,
      subject: verification ? `${VERIFICATION_SUBJECT_PREFIX} ${body.subject}` : body.subject,
      message: body.message,
      ipHash: hashIp(meta.ip, at, this.pepper),
    });

    const inbox = body.category === 'general_support' ? this.supportInbox : this.engagementInbox;
    const emails: ContactOutcome['emails'] = [];
    if (inbox !== '') {
      emails.push({
        to: inbox,
        template: 'contact_received',
        vars: {
          category: body.category,
          subject: body.subject,
          from: body.email,
          messageId: id,
        },
      });
    }
    // An acknowledgement: the sender should know the platform received them.
    emails.push({
      to: body.email,
      template: 'contact_acknowledged',
      vars: { name: body.name, category: body.category, reference: id },
    });

    return {
      stored: true,
      id,
      audit: [
        {
          eventType: 'CONTACT_RECEIVED',
          subject: id,
          message: `Contact form submission received (${body.category})`,
          // The category only. The message text is correspondence and has no
          // business in an append-only security log.
          details: { category: body.category },
        },
      ],
      emails,
    };
  }
}

export interface ConsentServiceDeps {
  repo: PublicRepo;
  ipSaltPepper?: string;
  now?: () => Date;
  randomUuid?: () => string;
}

export class ConsentService {
  private readonly repo: PublicRepo;
  private readonly pepper: string;
  private readonly now: () => Date;
  private readonly randomUuid: () => string;

  constructor(deps: ConsentServiceDeps) {
    this.repo = deps.repo;
    this.pepper = deps.ipSaltPepper ?? '';
    this.now = deps.now ?? (() => new Date());
    this.randomUuid = deps.randomUuid ?? (() => randomUUID());
  }

  /**
   * Record a consent choice.
   *
   * `strictlyNecessary` cannot be declined — the contract enforces it — so an
   * "Essential Only" click arrives as `{ strictlyNecessary: true, analytics: false,
   * marketing: false, functional: false }` and is stored exactly like that.
   */
  async record(input: {
    userId: string | null;
    anonymousId: string | null;
    categories: ConsentCategories;
    policyVersion: string;
    ip: string;
    userAgent?: string | null;
  }): Promise<{ id: string; audit: AuditInstruction[] }> {
    if (input.userId === null && input.anonymousId === null) {
      // The database refuses a row with neither actor; say so rather than let it.
      throw new HttpError(400, 'anonymous_id_required', 'A consent choice needs an identifier');
    }
    const id = this.randomUuid();
    const record: NewConsentRecord = {
      id,
      userId: input.userId,
      anonymousId: input.anonymousId,
      categories: input.categories,
      policyVersion: input.policyVersion,
      ipHash: hashIp(input.ip, this.now(), this.pepper),
      userAgent: input.userAgent ?? null,
    };
    await this.repo.insertConsentRecord(record);

    return {
      id,
      audit: [
        {
          eventType: 'CONSENT_RECORDED',
          subject: id,
          message: `Consent recorded for policy ${input.policyVersion}`,
          details: {
            policyVersion: input.policyVersion,
            analytics: input.categories.analytics,
            marketing: input.categories.marketing,
            functional: input.categories.functional,
          },
        },
      ],
    };
  }
}

export interface BadgeServiceDeps {
  repo: PublicRepo;
  now?: () => Date;
}

/**
 * The verified-blogger badge.
 *
 * Granted by an administrator, usually after a `journalist_blogger_profile_request`
 * arrives through the contact form. It is the ONLY thing that opens the Content
 * Studio to a non-staff author (Task 36's `requireBlogger`), which is why the grant
 * is audited as a permission change and not as a profile edit.
 */
export class BadgeService {
  private readonly repo: PublicRepo;
  private readonly now: () => Date;

  constructor(deps: BadgeServiceDeps) {
    this.repo = deps.repo;
    this.now = deps.now ?? (() => new Date());
  }

  async grant(
    userId: string,
    grantedBy: string,
  ): Promise<{
    id: string;
    verifiedBloggerAt: string;
    email: string;
    audit: AuditInstruction[];
  }> {
    const target = await this.mustFind(userId);
    await this.repo.grantBadge(userId, grantedBy, this.now());
    const verifiedBloggerAt = this.now().toISOString();
    return {
      id: target.id,
      verifiedBloggerAt,
      email: target.email,
      audit: [
        {
          eventType: 'PERMISSION_CHANGED',
          subject: target.id,
          message: `Verified Blogger badge granted to ${target.email}`,
          details: { badge: 'verified_blogger', granted: true },
        },
      ],
    };
  }

  async revoke(userId: string): Promise<{
    id: string;
    verifiedBloggerAt: null;
    email: string;
    audit: AuditInstruction[];
  }> {
    const target = await this.mustFind(userId);
    await this.repo.revokeBadge(userId);
    return {
      id: target.id,
      verifiedBloggerAt: null,
      email: target.email,
      audit: [
        {
          eventType: 'PERMISSION_CHANGED',
          subject: target.id,
          message: `Verified Blogger badge revoked from ${target.email}`,
          details: { badge: 'verified_blogger', granted: false },
        },
      ],
    };
  }

  private async mustFind(userId: string) {
    const target = await this.repo.findBadgeTarget(userId);
    if (target === null) throw HttpError.notFound();
    return target;
  }
}

/**
 * SHA-256 of the address and a daily salt.
 *
 * An empty IP (a health check, a test) hashes to `null` rather than to a digest of
 * the empty string, which would otherwise become a bucket every internal caller
 * shares.
 */
export function hashIp(ip: string, now: Date, pepper: string): string | null {
  if (ip === '') return null;
  return createHash('sha256')
    .update(`${ip}|${dailySalt(now, pepper)}`, 'utf8')
    .digest('hex');
}

export type { NewContactMessage };
