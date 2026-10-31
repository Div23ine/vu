import type {
  ClientProfile,
  Industry,
  PentestRequest,
  PentestTargetType,
} from '@vunvault/contracts';
import type { NotifyJobPayload } from '@vunvault/contracts';
import { HttpError } from '../../../lib/http-error.js';
import { hashSecret } from '../../../lib/secret-hash.js';
import type { ClientProfileRepo, OnboardingRepo, PentestRequestRepo } from './repo.js';

/**
 * Client intake: the profile read model, the three-step onboarding submission and
 * pen-test request intake.
 */

/** Read from `process.env`; the schema for these lives with the intake form. */
export const DEFAULT_TERMS_VERSION = '2026-09';

const DAY_MS = 24 * 60 * 60 * 1000;
const HOSTNAME_PATTERN =
  /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i;
const IPV4_PATTERN = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
const CIDR_PATTERN = /^(\d{1,3}(?:\.\d{1,3}){3})\/(\d{1,2})$/;

// --------------------------------------------------------------- profile

export interface ClientProfileServiceDeps {
  repo: ClientProfileRepo;
  now?: () => Date;
}

export class ClientProfileService {
  private readonly repo: ClientProfileRepo;
  private readonly now: () => Date;

  constructor(deps: ClientProfileServiceDeps) {
    this.repo = deps.repo;
    this.now = deps.now ?? (() => new Date());
  }

  async get(userId: string, orgId: string): Promise<ClientProfile> {
    const [person, organization, plan, engagements, openFindings, nextAssessmentAt] =
      await Promise.all([
        this.repo.getPerson(userId),
        this.repo.getOrganization(orgId),
        this.repo.getActivePlan(orgId),
        this.repo.countEngagements(orgId),
        this.repo.countOpenFindings(orgId),
        this.repo.nextAssessmentAt(orgId, this.now()),
      ]);
    if (organization === null)
      throw new HttpError(403, 'no_org', 'No organisation on this account');

    return {
      id: person.id,
      fullName: person.fullName,
      jobTitle: person.jobTitle,
      email: person.email,
      phone: person.phone,
      clientCode: organization.clientCode,
      company: {
        name: organization.name,
        primaryDomain: organization.primaryDomain,
        industry: organization.industry,
      },
      plan:
        plan === null
          ? null
          : {
              name: plan.name,
              status: plan.status as NonNullable<ClientProfile['plan']>['status'],
            },
      stats: {
        engagements,
        openFindings,
        nextAssessmentInDays:
          nextAssessmentAt === null
            ? null
            : Math.max(
                0,
                Math.ceil((new Date(nextAssessmentAt).getTime() - this.now().getTime()) / DAY_MS),
              ),
      },
      updatedAt: person.updatedAt,
    };
  }

  async update(
    userId: string,
    orgId: string,
    body: {
      fullName: string;
      jobTitle?: string;
      phone?: string;
      company: { name: string; primaryDomain?: string; industry?: Industry };
    },
  ): Promise<ClientProfile> {
    const domain =
      body.company.primaryDomain === undefined
        ? undefined
        : normaliseDomain(body.company.primaryDomain, 'company.primaryDomain');

    await this.repo.updatePerson(userId, {
      fullName: body.fullName,
      jobTitle: body.jobTitle,
      phone: body.phone,
    });
    await this.repo.updateOrganization(orgId, {
      name: body.company.name,
      primaryDomain: domain,
      industry: body.company.industry,
    });
    return this.get(userId, orgId);
  }
}

/**
 * A primary domain is stored as a bare hostname: `https://acmefintech.co.ke/path`
 * and `acmefintech.co.ke` are the same company domain, and the stored form is what
 * a scan target is compared against.
 */
export function normaliseDomain(input: string, path: string): string {
  const trimmed = input.trim();
  if (trimmed === '') {
    throw HttpError.badRequest('validation_failed', [{ path: [path], message: 'Enter a domain' }]);
  }

  // A bare hostname.
  if (!trimmed.includes('://')) {
    const hostname = trimmed.replace(/\/.*$/, '');
    if (!HOSTNAME_PATTERN.test(hostname)) {
      throw HttpError.badRequest('validation_failed', [
        { path: [path], message: 'Enter a valid domain, e.g. acmefintech.co.ke' },
      ]);
    }
    return hostname.toLowerCase();
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw HttpError.badRequest('validation_failed', [
      { path: [path], message: 'Enter a valid domain or https URL' },
    ]);
  }
  if (url.protocol !== 'https:') {
    throw HttpError.badRequest('validation_failed', [
      { path: [path], message: 'Use an https URL or a bare domain' },
    ]);
  }
  if (!HOSTNAME_PATTERN.test(url.hostname)) {
    throw HttpError.badRequest('validation_failed', [
      { path: [path], message: 'Enter a valid domain, e.g. acmefintech.co.ke' },
    ]);
  }
  return url.hostname.toLowerCase();
}

// ------------------------------------------------------------- onboarding

export interface OnboardingSubmitInput {
  step1: {
    fullName: string;
    dateOfBirth: string;
    phone?: string;
    email: string;
    emailConfirm: string;
  };
  step2: { career: string; entity: 'individual' | 'company' | 'corporation' };
  step3: {
    recoveryQuestion: string;
    recoveryAnswer: string;
    declarations: { infoAccurate: true; authorisedTesting: true; termsAccepted: true };
  };
}

export interface OnboardingServiceDeps {
  repo: OnboardingRepo;
  /** Test seam: a fixed salt keeps the stored hash reproducible. */
  hash?: (answer: string) => string;
  termsVersion?: string;
  now?: () => Date;
}

export class OnboardingService {
  private readonly repo: OnboardingRepo;
  private readonly hash: (answer: string) => string;
  private readonly termsVersion: string;
  private readonly now: () => Date;

  constructor(deps: OnboardingServiceDeps) {
    this.repo = deps.repo;
    this.hash = deps.hash ?? ((answer: string) => hashSecret(answer));
    this.termsVersion = deps.termsVersion ?? process.env.TERMS_VERSION ?? DEFAULT_TERMS_VERSION;
    this.now = deps.now ?? (() => new Date());
  }

  async status(userId: string) {
    return this.repo.onboardingStatus(userId);
  }

  /**
   * Submits all three steps at once. The email must be the session's own address:
   * onboarding writes to `profiles`, and an address typed here must not be able to
   * diverge from the one Supabase authenticates.
   */
  async submit(
    userId: string,
    sessionEmail: string,
    body: OnboardingSubmitInput,
  ): Promise<{ completed: true; completedAt: string; termsVersion: string }> {
    if (body.step1.email.toLowerCase() !== sessionEmail.toLowerCase()) {
      throw new HttpError(422, 'email_mismatch', 'That is not the email you signed in with');
    }
    assertAtLeast16(body.step1.dateOfBirth, this.now());

    const existing = await this.repo.onboardingStatus(userId);
    if (existing.completed) {
      throw new HttpError(409, 'already_completed', 'Onboarding has already been completed');
    }

    const completedAt = this.now();
    // The answer is stored as a memory-hard hash of the normalised value; the
    // plaintext never reaches the database, a log or an audit entry.
    await this.repo.completeOnboarding({
      userId,
      dateOfBirth: body.step1.dateOfBirth,
      phone: body.step1.phone ?? null,
      career: body.step2.career,
      entity: body.step2.entity,
      accountType: body.step2.entity === 'individual' ? 'individual' : 'company',
      recoveryQuestion: body.step3.recoveryQuestion,
      recoveryAnswerHash: this.hash(body.step3.recoveryAnswer),
      declarations: { ...body.step3.declarations },
      termsVersion: this.termsVersion,
      completedAt,
    });

    return {
      completed: true,
      completedAt: completedAt.toISOString(),
      termsVersion: this.termsVersion,
    };
  }
}

/** Sixteen years, counted in calendar years rather than a fixed number of days. */
export function assertAtLeast16(dateOfBirth: string, now: Date): void {
  const birth = new Date(`${dateOfBirth}T00:00:00.000Z`);
  if (Number.isNaN(birth.getTime())) {
    throw HttpError.badRequest('validation_failed', [
      { path: ['step1', 'dateOfBirth'], message: 'Enter a valid date' },
    ]);
  }
  const cutoff = new Date(Date.UTC(now.getUTCFullYear() - 16, now.getUTCMonth(), now.getUTCDate()));
  if (birth.getTime() > cutoff.getTime()) {
    throw HttpError.badRequest('validation_failed', [
      { path: ['step1', 'dateOfBirth'], message: 'You must be at least 16 years old.' },
    ]);
  }
}

// --------------------------------------------------------- pen-test intake

/**
 * Internal ranges are refused: an assessment against a private address is scoped by
 * an engagement lead with written authorisation, not by this self-service form.
 */
export function isDisallowedTarget(host: string): boolean {
  const value = host.toLowerCase();
  if (value === 'localhost' || value.endsWith('.localhost')) return true;

  const ipv4 = IPV4_PATTERN.exec(value);
  const octets =
    ipv4 === null
      ? null
      : ([ipv4[1], ipv4[2], ipv4[3], ipv4[4]].map(Number) as [number, number, number, number]);
  if (octets !== null) {
    const [a, b] = octets;
    if (octets.some((octet) => octet > 255)) return true;
    if (a === 127) return true; // loopback
    if (a === 10) return true; // private
    if (a === 172 && b >= 16 && b <= 31) return true; // private
    if (a === 192 && b === 168) return true; // private
    if (a === 169 && b === 254) return true; // link-local
    if (a === 0) return true; // this network
    return false;
  }

  // A hostname that merely resolves to a private address is caught when the scan
  // worker resolves it; the form refuses the obvious spellings.
  if (value.endsWith('.local') || value.endsWith('.internal')) return true;
  if (value.startsWith('127.') || value.startsWith('10.')) return true;
  if (value.startsWith('192.168.') || value.startsWith('169.254.')) return true;
  return false;
}

/** Accepts a hostname, an http(s) URL, an IPv4 address or an IPv4 CIDR range. */
export function parseTarget(input: string): string {
  const trimmed = input.trim();
  if (trimmed === '') {
    throw HttpError.badRequest('validation_failed', [
      { path: ['targetUrl'], message: 'Enter a target' },
    ]);
  }

  if (trimmed.includes('://')) {
    let url: URL;
    try {
      url = new URL(trimmed);
    } catch {
      throw HttpError.badRequest('validation_failed', [
        { path: ['targetUrl'], message: 'Enter a valid URL, hostname, IP or CIDR range' },
      ]);
    }
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      throw HttpError.badRequest('validation_failed', [
        { path: ['targetUrl'], message: 'Use an http or https URL' },
      ]);
    }
    return url.hostname.toLowerCase();
  }

  const withoutCidr = trimmed.split('/')[0] as string;
  const cidr = CIDR_PATTERN.exec(trimmed);
  if (cidr !== null) {
    const prefix = Number(cidr[2]);
    if (!IPV4_PATTERN.test(withoutCidr) || prefix < 0 || prefix > 32) {
      throw HttpError.badRequest('validation_failed', [
        { path: ['targetUrl'], message: 'Enter a valid CIDR range, e.g. 41.90.0.0/24' },
      ]);
    }
    return trimmed.toLowerCase();
  }

  if (IPV4_PATTERN.test(withoutCidr)) {
    const octets = (IPV4_PATTERN.exec(withoutCidr) as RegExpExecArray).slice(1).map(Number);
    if (octets.some((octet) => octet > 255)) {
      throw HttpError.badRequest('validation_failed', [
        { path: ['targetUrl'], message: 'Enter a valid IP address' },
      ]);
    }
    return withoutCidr;
  }

  if (!HOSTNAME_PATTERN.test(withoutCidr)) {
    throw HttpError.badRequest('validation_failed', [
      { path: ['targetUrl'], message: 'Enter a valid URL, hostname, IP or CIDR range' },
    ]);
  }
  return withoutCidr.toLowerCase();
}

export interface PentestRequestServiceDeps {
  repo: PentestRequestRepo;
  /** Enqueues a `notify` job; the worker delivers it. */
  enqueue: (payload: NotifyJobPayload) => Promise<void>;
  engagementInbox?: string;
  now?: () => Date;
}

export class PentestRequestService {
  private readonly repo: PentestRequestRepo;
  private readonly enqueue: (payload: NotifyJobPayload) => Promise<void>;
  private readonly engagementInbox: string;
  private readonly now: () => Date;

  constructor(deps: PentestRequestServiceDeps) {
    this.repo = deps.repo;
    this.enqueue = deps.enqueue;
    this.engagementInbox = deps.engagementInbox ?? process.env.ENGAGEMENT_INBOX ?? '';
    this.now = deps.now ?? (() => new Date());
  }

  async create(
    orgId: string,
    requestedBy: string,
    requesterEmail: string,
    body: {
      targetUrl: string;
      targetType: PentestTargetType;
      preferredSchedule?: string;
      notes?: string;
    },
  ): Promise<PentestRequest> {
    const host = parseTarget(body.targetUrl);
    if (isDisallowedTarget(host)) {
      throw new HttpError(
        422,
        'target_not_allowed',
        'Internal addresses are assessed by an engagement lead, not through this form',
      );
    }

    let preferredSchedule: Date | null = null;
    if (body.preferredSchedule !== undefined) {
      const when = new Date(body.preferredSchedule);
      if (Number.isNaN(when.getTime())) {
        throw HttpError.badRequest('validation_failed', [
          { path: ['preferredSchedule'], message: 'Enter a valid date and time' },
        ]);
      }
      if (when.getTime() <= this.now().getTime()) {
        throw HttpError.badRequest('validation_failed', [
          { path: ['preferredSchedule'], message: 'Choose a date in the future' },
        ]);
      }
      preferredSchedule = when;
    }

    const created = await this.repo.insertPentestRequest({
      orgId,
      requestedBy,
      targetUrl: host,
      targetType: body.targetType,
      preferredSchedule,
      notes: body.notes ?? null,
    });

    // Two plain-text notifications: the engagement inbox is told a request exists,
    // and the requester is told a named lead will reply within one business day.
    if (this.engagementInbox !== '') {
      await this.enqueue({
        channel: 'email',
        to: this.engagementInbox,
        template: 'pentest_requested_internal',
        vars: { refCode: created.refCode, targetUrl: created.targetUrl, requesterEmail },
      });
    }
    await this.enqueue({
      channel: 'email',
      to: requesterEmail,
      template: 'pentest_requested_acknowledgement',
      vars: {
        refCode: created.refCode,
        targetUrl: created.targetUrl,
        promise: 'A named engagement lead will reply within one business day',
      },
    });

    return {
      id: created.id,
      refCode: created.refCode,
      targetUrl: created.targetUrl,
      targetType: created.targetType,
      status: 'received',
      createdAt: created.createdAt,
    };
  }
}
