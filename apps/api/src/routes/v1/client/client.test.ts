import { describe, expect, it } from 'vitest';
import type { Industry, PentestTargetType } from '@vunvault/contracts';
import { HttpError } from '../../../lib/http-error.js';
import { verifySecret } from '../../../lib/secret-hash.js';
import type {
  ClientProfileRepo,
  CompleteOnboardingInput,
  InsertPentestRequestInput,
  OnboardingRepo,
  PentestRequestRepo,
} from './repo.js';
import {
  ClientProfileService,
  DEFAULT_TERMS_VERSION,
  OnboardingService,
  PentestRequestService,
  assertAtLeast16,
  isDisallowedTarget,
  normaliseDomain,
  parseTarget,
} from './service.js';

const USER_ID = 'a1000000-0000-4000-8000-000000000001';
const ORG_ID = 'a1000000-0000-4000-8000-0000000000aa';
const NOW = new Date('2026-09-24T12:00:00.000Z');

// --------------------------------------------------------------------- fakes

class FakeClientRepo implements ClientProfileRepo, OnboardingRepo, PentestRequestRepo {
  person = {
    id: USER_ID,
    fullName: 'Wanjiru Kamau',
    jobTitle: 'CTO',
    email: 'w.kamau@acmefintech.co.ke',
    phone: '+254712345678',
    accountType: null,
    updatedAt: '2026-09-01T09:00:00.000Z',
  };
  organization: {
    id: string;
    name: string;
    clientCode: string;
    primaryDomain: string | null;
    industry: Industry | null;
  } | null = {
    id: ORG_ID,
    name: 'Acme Fintech',
    clientCode: 'VV-CL-48210',
    primaryDomain: 'acmefintech.co.ke',
    industry: 'financial_services_fintech',
  };
  plan: { name: string; status: string } | null = { name: 'Enterprise', status: 'active' };
  engagements = 7;
  openFindings = 3;
  nextAssessment: string | null = '2026-10-04T09:00:00.000Z';
  onboarding: { completed: boolean; completedAt: string | null } = {
    completed: false,
    completedAt: null,
  };
  personWrites: Array<Record<string, unknown>> = [];
  orgWrites: Array<Record<string, unknown>> = [];
  onboarded: CompleteOnboardingInput[] = [];
  requests: InsertPentestRequestInput[] = [];
  private sequence = 122;

  async getPerson() {
    return { ...this.person };
  }
  async updatePerson(_userId: string, patch: Record<string, unknown>) {
    this.personWrites.push(patch);
    this.person = { ...this.person, ...patch } as typeof this.person;
  }
  async getOrganization() {
    return this.organization === null ? null : { ...this.organization };
  }
  async updateOrganization(_orgId: string, patch: Record<string, unknown>) {
    this.orgWrites.push(patch);
    if (this.organization !== null) {
      this.organization = { ...this.organization, ...patch } as NonNullable<
        typeof this.organization
      >;
    }
  }
  async getActivePlan() {
    return this.plan;
  }
  async countEngagements() {
    return this.engagements;
  }
  async countOpenFindings() {
    return this.openFindings;
  }
  async nextAssessmentAt() {
    return this.nextAssessment;
  }
  async onboardingStatus() {
    return { ...this.onboarding };
  }
  async completeOnboarding(input: CompleteOnboardingInput) {
    this.onboarded.push(input);
    this.onboarding = { completed: true, completedAt: input.completedAt.toISOString() };
  }
  async insertPentestRequest(input: InsertPentestRequestInput) {
    this.requests.push(input);
    this.sequence += 1;
    // Mimics the generated column: `VV-PT-` plus a zero-padded sequence number.
    return {
      id: `req-${this.sequence}`,
      refCode: `VV-PT-${String(this.sequence).padStart(6, '0')}`,
      targetUrl: input.targetUrl,
      targetType: input.targetType,
      status: 'received',
      createdAt: NOW.toISOString(),
    };
  }
}

// ------------------------------------------------------------------- profile

describe('client profile', () => {
  it('computes the stats from the fixtures', async () => {
    const repo = new FakeClientRepo();
    const service = new ClientProfileService({ repo, now: () => NOW });
    const profile = await service.get(USER_ID, ORG_ID);

    expect(profile).toMatchObject({
      id: USER_ID,
      fullName: 'Wanjiru Kamau',
      jobTitle: 'CTO',
      email: 'w.kamau@acmefintech.co.ke',
      phone: '+254712345678',
      clientCode: 'VV-CL-48210',
      company: {
        name: 'Acme Fintech',
        primaryDomain: 'acmefintech.co.ke',
        industry: 'financial_services_fintech',
      },
      plan: { name: 'Enterprise', status: 'active' },
      updatedAt: '2026-09-01T09:00:00.000Z',
    });
    expect(profile.stats).toEqual({
      engagements: 7,
      openFindings: 3,
      // 2026-10-04T09:00Z is 10 days after 2026-09-24T12:00Z.
      nextAssessmentInDays: 10,
    });
  });

  it('reports no plan and no upcoming assessment when there are none', async () => {
    const repo = new FakeClientRepo();
    repo.plan = null;
    repo.nextAssessment = null;
    const service = new ClientProfileService({ repo, now: () => NOW });
    const profile = await service.get(USER_ID, ORG_ID);
    expect(profile.plan).toBeNull();
    expect(profile.stats.nextAssessmentInDays).toBeNull();
  });

  it('refuses an account with no organisation', async () => {
    const repo = new FakeClientRepo();
    repo.organization = null;
    const service = new ClientProfileService({ repo, now: () => NOW });
    const error = await service.get(USER_ID, ORG_ID).catch((caught: unknown) => caught);
    expect((error as HttpError).status).toBe(403);
    expect((error as HttpError).code).toBe('no_org');
  });
});

describe('normaliseDomain', () => {
  it('reduces an https URL with a path to a bare hostname', () => {
    expect(normaliseDomain('https://acmefintech.co.ke/path', 'company.primaryDomain')).toBe(
      'acmefintech.co.ke',
    );
    expect(normaliseDomain('https://AcmeFintech.CO.KE/', 'company.primaryDomain')).toBe(
      'acmefintech.co.ke',
    );
    expect(normaliseDomain('acmefintech.co.ke', 'company.primaryDomain')).toBe('acmefintech.co.ke');
  });

  it('rejects http, a bare word and an empty value', () => {
    for (const bad of ['http://acmefintech.co.ke', 'acmefintech', '', 'ftp://x.co.ke']) {
      const error = normaliseDomain
        ? (() => {
            try {
              normaliseDomain(bad, 'company.primaryDomain');
              return null;
            } catch (caught) {
              return caught as HttpError;
            }
          })()
        : null;
      expect(error, bad).toBeInstanceOf(HttpError);
      expect(error?.code).toBe('validation_failed');
    }
  });

  it('is applied by PATCH before the org row is written', async () => {
    const repo = new FakeClientRepo();
    const service = new ClientProfileService({ repo, now: () => NOW });
    await service.update(USER_ID, ORG_ID, {
      fullName: 'Wanjiru Kamau',
      company: { name: 'Acme Fintech', primaryDomain: 'https://acmefintech.co.ke/path' },
    });
    expect(repo.orgWrites[0]).toMatchObject({ primaryDomain: 'acmefintech.co.ke' });
    expect(repo.personWrites[0]).toMatchObject({ fullName: 'Wanjiru Kamau' });
  });
});

// ---------------------------------------------------------------- onboarding

const ONBOARDING_BODY = {
  step1: {
    fullName: 'Wanjiru Kamau',
    dateOfBirth: '1990-04-02',
    phone: '+254712345678',
    email: 'w.kamau@acmefintech.co.ke',
    emailConfirm: 'w.kamau@acmefintech.co.ke',
  },
  step2: { career: 'cto' as const, entity: 'company' as const },
  step3: {
    recoveryQuestion: 'city_of_birth' as const,
    recoveryAnswer: 'Nairobi',
    declarations: { infoAccurate: true, authorisedTesting: true, termsAccepted: true } as const,
  },
};

describe('onboarding', () => {
  it('rejects a 15-year-old date of birth', () => {
    const fifteen = new Date(Date.UTC(2026 - 15, 8, 25)).toISOString().slice(0, 10);
    const error = (() => {
      try {
        assertAtLeast16(fifteen, NOW);
        return null;
      } catch (caught) {
        return caught as HttpError;
      }
    })();
    expect(error?.status).toBe(400);
    expect(error?.details).toEqual([
      { path: ['step1', 'dateOfBirth'], message: 'You must be at least 16 years old.' },
    ]);

    // Exactly sixteen is fine.
    const sixteen = new Date(Date.UTC(2026 - 16, 8, 24)).toISOString().slice(0, 10);
    expect(() => assertAtLeast16(sixteen, NOW)).not.toThrow();
  });

  it('refuses an email that is not the session address', async () => {
    const repo = new FakeClientRepo();
    const service = new OnboardingService({ repo, now: () => NOW });
    const error = await service
      .submit(USER_ID, 'someone.else@acmefintech.co.ke', ONBOARDING_BODY)
      .catch((caught: unknown) => caught);
    expect((error as HttpError).status).toBe(422);
    expect((error as HttpError).code).toBe('email_mismatch');
    expect(repo.onboarded).toHaveLength(0);
  });

  it('stores the recovery answer as scrypt and never as plaintext', async () => {
    const repo = new FakeClientRepo();
    const service = new OnboardingService({ repo, now: () => NOW });
    const result = await service.submit(USER_ID, ONBOARDING_BODY.step1.email, ONBOARDING_BODY);

    expect(result).toMatchObject({ completed: true, completedAt: NOW.toISOString() });
    expect(result.termsVersion).toBe(DEFAULT_TERMS_VERSION);

    const stored = repo.onboarded[0];
    expect(stored?.recoveryAnswerHash).toMatch(/^scrypt\$32768\$8\$1\$/);
    expect(stored?.recoveryAnswerHash).not.toContain('Nairobi');
    expect(stored?.recoveryAnswerHash).not.toContain('nairobi');
    expect(JSON.stringify(stored)).not.toContain('Nairobi');

    // The same answer verifies regardless of case or surrounding spaces.
    expect(verifySecret('Nairobi', stored?.recoveryAnswerHash ?? '')).toBe(true);
    expect(verifySecret(' nairobi ', stored?.recoveryAnswerHash ?? '')).toBe(true);
    expect(verifySecret('Mombasa', stored?.recoveryAnswerHash ?? '')).toBe(false);
  }, 20_000);

  it('maps the entity onto the account type and records the declarations', async () => {
    const repo = new FakeClientRepo();
    const service = new OnboardingService({ repo, now: () => NOW, termsVersion: '2026-09' });
    await service.submit(USER_ID, ONBOARDING_BODY.step1.email, ONBOARDING_BODY);
    expect(repo.onboarded[0]).toMatchObject({
      accountType: 'company',
      entity: 'company',
      career: 'cto',
      dateOfBirth: '1990-04-02',
      phone: '+254712345678',
      termsVersion: '2026-09',
      declarations: { infoAccurate: true, authorisedTesting: true, termsAccepted: true },
    });

    const individual = new FakeClientRepo();
    await new OnboardingService({ repo: individual, now: () => NOW }).submit(
      USER_ID,
      ONBOARDING_BODY.step1.email,
      { ...ONBOARDING_BODY, step2: { career: 'cto', entity: 'individual' } },
    );
    expect(individual.onboarded[0]?.accountType).toBe('individual');

    const corporation = new FakeClientRepo();
    await new OnboardingService({ repo: corporation, now: () => NOW }).submit(
      USER_ID,
      ONBOARDING_BODY.step1.email,
      { ...ONBOARDING_BODY, step2: { career: 'cto', entity: 'corporation' } },
    );
    expect(corporation.onboarded[0]?.accountType).toBe('company');
  });

  it('refuses a second submission', async () => {
    const repo = new FakeClientRepo();
    const service = new OnboardingService({ repo, now: () => NOW });
    await service.submit(USER_ID, ONBOARDING_BODY.step1.email, ONBOARDING_BODY);

    const error = await service
      .submit(USER_ID, ONBOARDING_BODY.step1.email, ONBOARDING_BODY)
      .catch((caught: unknown) => caught);
    expect((error as HttpError).status).toBe(409);
    expect((error as HttpError).code).toBe('already_completed');
    expect(repo.onboarded).toHaveLength(1);

    expect(await service.status(USER_ID)).toEqual({
      completed: true,
      completedAt: NOW.toISOString(),
    });
  });
});

// ------------------------------------------------------------- pen-test intake

describe('target validation', () => {
  it('accepts a hostname, URL, IPv4 address and CIDR range', () => {
    expect(parseTarget('https://acmefintech.co.ke/login')).toBe('acmefintech.co.ke');
    expect(parseTarget('acmefintech.co.ke')).toBe('acmefintech.co.ke');
    expect(parseTarget('41.90.12.7')).toBe('41.90.12.7');
    expect(parseTarget('41.90.0.0/24')).toBe('41.90.0.0/24');
  });

  it('rejects malformed targets', () => {
    for (const bad of ['', 'not a target', '999.1.1.1', '41.90.0.0/40', 'ssh://x.co.ke']) {
      expect(() => parseTarget(bad), bad).toThrow(HttpError);
    }
  });

  it('flags private, loopback and link-local ranges', () => {
    for (const blocked of [
      '127.0.0.1',
      '10.24.8.11',
      '172.16.0.1',
      '172.31.255.255',
      '192.168.1.1',
      '169.254.169.254',
      'localhost',
      'printer.local',
    ]) {
      expect(isDisallowedTarget(blocked), blocked).toBe(true);
    }
    for (const allowed of ['41.90.12.7', 'acmefintech.co.ke', '172.32.0.1', '11.0.0.1']) {
      expect(isDisallowedTarget(allowed), allowed).toBe(false);
    }
  });
});

describe('pen-test requests', () => {
  function makeService(repo = new FakeClientRepo()) {
    const jobs: Array<{ channel: string; to?: string; template?: string }> = [];
    const service = new PentestRequestService({
      repo,
      enqueue: async (payload) => {
        jobs.push(payload as { channel: string; to?: string; template?: string });
      },
      engagementInbox: 'engagements@vunvault.com',
      now: () => NOW,
    });
    return { service, repo, jobs };
  }

  it('refuses an internal target', async () => {
    const { service, repo, jobs } = makeService();
    const error = await service
      .create(ORG_ID, USER_ID, 'w.kamau@acmefintech.co.ke', {
        targetUrl: '10.24.8.11',
        targetType: 'network_infrastructure' as PentestTargetType,
      })
      .catch((caught: unknown) => caught);
    expect((error as HttpError).status).toBe(422);
    expect((error as HttpError).code).toBe('target_not_allowed');
    expect(repo.requests).toHaveLength(0);
    expect(jobs).toHaveLength(0);

    const localhost = await service
      .create(ORG_ID, USER_ID, 'w.kamau@acmefintech.co.ke', {
        targetUrl: 'http://localhost:8080',
        targetType: 'web_application' as PentestTargetType,
      })
      .catch((caught: unknown) => caught);
    expect((localhost as HttpError).code).toBe('target_not_allowed');
  });

  it('creates a request with a generated reference and notifies both inboxes', async () => {
    const { service, repo, jobs } = makeService();
    const created = await service.create(ORG_ID, USER_ID, 'w.kamau@acmefintech.co.ke', {
      targetUrl: 'https://acmefintech.co.ke/portal',
      targetType: 'web_application' as PentestTargetType,
      preferredSchedule: '2026-11-02T09:00:00.000Z',
      notes: 'Staging environment, out of hours only.',
    });

    expect(created.refCode).toMatch(/^VV-PT-\d{6}$/);
    expect(created).toMatchObject({
      targetUrl: 'acmefintech.co.ke',
      targetType: 'web_application',
      status: 'received',
      createdAt: NOW.toISOString(),
    });
    expect(repo.requests[0]).toMatchObject({
      orgId: ORG_ID,
      requestedBy: USER_ID,
      notes: 'Staging environment, out of hours only.',
    });
    expect(repo.requests[0]?.preferredSchedule).toEqual(new Date('2026-11-02T09:00:00.000Z'));

    expect(jobs).toHaveLength(2);
    expect(jobs[0]).toMatchObject({
      channel: 'email',
      to: 'engagements@vunvault.com',
      template: 'pentest_requested_internal',
    });
    expect(jobs[1]).toMatchObject({
      channel: 'email',
      to: 'w.kamau@acmefintech.co.ke',
      template: 'pentest_requested_acknowledgement',
    });
  });

  it('refuses a preferred schedule in the past', async () => {
    const { service, repo } = makeService();
    const error = await service
      .create(ORG_ID, USER_ID, 'w.kamau@acmefintech.co.ke', {
        targetUrl: 'acmefintech.co.ke',
        targetType: 'api' as PentestTargetType,
        preferredSchedule: '2026-09-01T09:00:00.000Z',
      })
      .catch((caught: unknown) => caught);
    expect((error as HttpError).status).toBe(400);
    expect((error as HttpError).details).toEqual([
      { path: ['preferredSchedule'], message: 'Choose a date in the future' },
    ]);
    expect(repo.requests).toHaveLength(0);
  });
});
