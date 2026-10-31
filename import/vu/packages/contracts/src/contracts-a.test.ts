import { describe, expect, it } from 'vitest';
import { clientProfile } from '../fixtures/profile';
import {
  gateChecklistDefaults,
  gateChecklistPassed,
  scanJobs,
  scanQueueSummary,
} from '../fixtures/scans';
import { invitations, staffMembers, staffSummary } from '../fixtures/users';
import {
  JwtClaims,
  MAGIC_LINK_ACK_MESSAGE,
  MagicLinkRequestBody,
  MagicLinkRequestResponse,
  MagicLinkToken,
  MagicLinkVerifyQuery,
  MfaVerifyBody,
  SessionUser,
  SignupBody,
  SignupStartResponse,
  SignupVerifyBody,
} from './auth';
import { ErrorEnvelope, IsoDateTime, PageQuery, paginated, Uuid, UsdCents } from './common';
import {
  AuditCategorySchema,
  DisplayCurrencySchema,
  ReviewGateStateSchema,
  ScanStatusSchema,
  UserRoleSchema,
} from './enums';
import {
  COUNTRIES,
  GATE_DECISION_LABELS,
  PERMISSIONS,
  REVIEW_CHECK_LABELS,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  ROLE_PERMISSIONS,
  TEAM_LABELS,
} from './permissions';
import { ClientProfile, UpdateProfileBody } from './profile';
import { ROUTES_A } from './routes-a';
import {
  BulkScanActionBody,
  CreatePentestRequestBody,
  CreateScanBody,
  GATE_RELEASE_MESSAGE,
  GateDecisionBody,
  PentestRequest,
  ScanFinding,
  ScanJob,
  ScanListQuery,
  ScanQueueSummary,
} from './scans';
import {
  ChangeRoleBody,
  Invitation,
  ProvisionInviteBody,
  StaffListQuery,
  StaffMember,
  StaffSummary,
  STAFF_ROLES,
  STAFF_TEAMS,
  UserActionBody,
} from './users';

const UUID = 'c0000000-0000-4000-8000-000000000001';

describe('common envelopes', () => {
  it('accepts the error envelope and rejects a missing code', () => {
    expect(
      ErrorEnvelope.parse({
        error: 'validation_failed',
        message: 'Check the highlighted fields',
        details: [{ path: ['email'] }],
      }),
    ).toMatchObject({ error: 'validation_failed' });
    expect(ErrorEnvelope.safeParse({ message: 'no code' }).success).toBe(false);
  });

  it('wraps lists and single resources', () => {
    expect(paginated(StaffMember).parse({ data: staffMembers, total: 24 }).total).toBe(24);
    expect(paginated(StaffMember).safeParse({ data: staffMembers }).success).toBe(false);
  });

  it('coerces and defaults query pagination', () => {
    expect(PageQuery.parse({})).toEqual({ page: 1, pageSize: 10 });
    expect(PageQuery.parse({ page: '3', pageSize: '25', q: '  reed  ' })).toEqual({
      page: 3,
      pageSize: 25,
      q: 'reed',
    });
    expect(PageQuery.safeParse({ pageSize: 500 }).success).toBe(false);
    expect(PageQuery.safeParse({ page: 0 }).success).toBe(false);
  });

  it('validates ids, timestamps and money', () => {
    expect(Uuid.parse(UUID)).toBe(UUID);
    expect(Uuid.safeParse('u-reed').success).toBe(false);
    expect(IsoDateTime.parse('2026-09-24T06:12:00Z')).toBe('2026-09-24T06:12:00Z');
    expect(IsoDateTime.safeParse('24 Sep 06:12').success).toBe(false);
    expect(UsdCents.parse(249900)).toBe(249900);
    expect(UsdCents.safeParse(2499.0).success).toBe(true);
    expect(UsdCents.safeParse(2499.5).success).toBe(false);
    expect(UsdCents.safeParse(-1).success).toBe(false);
  });
});

describe('enums', () => {
  it('accepts database values and rejects anything else', () => {
    expect(UserRoleSchema.parse('security_analyst')).toBe('security_analyst');
    expect(UserRoleSchema.safeParse('root').success).toBe(false);
    expect(ScanStatusSchema.parse('awaiting_review')).toBe('awaiting_review');
    expect(ScanStatusSchema.safeParse('done').success).toBe(false);
    expect(ReviewGateStateSchema.parse('approved_released')).toBe('approved_released');
    expect(ReviewGateStateSchema.safeParse('released').success).toBe(false);
    expect(DisplayCurrencySchema.parse('KES')).toBe('KES');
    expect(DisplayCurrencySchema.safeParse('BTC').success).toBe(false);
    expect(AuditCategorySchema.parse('report_release')).toBe('report_release');
    expect(AuditCategorySchema.safeParse('billing').success).toBe(false);
  });
});

describe('permissions', () => {
  it('gives super_admin everything and admin everything but users:manage', () => {
    expect(ROLE_PERMISSIONS.super_admin).toEqual(PERMISSIONS);
    expect(ROLE_PERMISSIONS.admin).not.toContain('users:manage');
    expect(ROLE_PERMISSIONS.admin).toHaveLength(PERMISSIONS.length - 1);
  });

  it('maps only known permissions, and every role has profile access', () => {
    const known = new Set<string>(PERMISSIONS);
    for (const [role, permissions] of Object.entries(ROLE_PERMISSIONS)) {
      expect(permissions.length, role).toBeGreaterThan(0);
      for (const permission of permissions) expect(known.has(permission), permission).toBe(true);
      expect(permissions, role).toContain('profile:read');
      expect(permissions, role).toContain('profile:write');
    }
  });

  it('never gives a client, operator or auditor release authority', () => {
    for (const role of [
      'client',
      'soc_operator',
      'compliance_auditor',
      'support_engineer',
    ] as const) {
      expect(ROLE_PERMISSIONS[role]).not.toContain('scans:release');
      expect(ROLE_PERMISSIONS[role]).not.toContain('scans:review');
    }
    expect(ROLE_PERMISSIONS.admin).toContain('scans:release');
  });

  it('labels every role, team and country', () => {
    expect(ROLE_LABELS.super_admin).toBe('Super Administrator');
    expect(ROLE_LABELS.soc_operator).toBe('SOC Operator');
    expect(ROLE_DESCRIPTIONS.security_analyst).toBe(
      'Run scans, review findings and author advisories within an assigned scope.',
    );
    expect(TEAM_LABELS.soc_detection_response).toBe('SOC — Detection & Response');
    expect(COUNTRIES.KE).toBe('Kenya');
    expect(Object.keys(COUNTRIES)).toHaveLength(13);
  });

  it('documents all five gate checks and all three decisions', () => {
    expect(Object.keys(REVIEW_CHECK_LABELS)).toHaveLength(5);
    expect(REVIEW_CHECK_LABELS.scope_authorisation_verified.title).toBe(
      'Scope authorisation verified',
    );
    expect(GATE_DECISION_LABELS.approve_release.title).toBe('Approve & Release');
    expect(GATE_DECISION_LABELS.approve_release.description).toBe(
      'Clears the gate and grants the client portal access to the report.',
    );
  });
});

describe('auth schemas', () => {
  it('parses a session user and its JWT claims', () => {
    const session = {
      id: UUID,
      email: 'e.reed@vunvault.com',
      fullName: 'Dr. Evelyn Reed',
      role: 'super_admin',
      orgId: null,
      permissions: [...PERMISSIONS],
      mfaEnrolled: true,
    };
    expect(SessionUser.parse(session)).toEqual(session);
    expect(
      JwtClaims.parse({ sub: UUID, role: 'admin', org_id: null, permissions: ['users:read'] }),
    ).toMatchObject({ role: 'admin' });
    expect(SessionUser.safeParse({ ...session, role: 'root' }).success).toBe(false);
    expect(JwtClaims.safeParse({ sub: 'not-a-uuid', role: 'admin' }).success).toBe(false);
  });

  it('takes only an email address for a magic link — no password exists anywhere', () => {
    expect(MagicLinkRequestBody.parse({ email: 'a.njoroge@vunvault.com' })).toEqual({
      email: 'a.njoroge@vunvault.com',
    });
    expect(MagicLinkRequestBody.safeParse({}).success).toBe(false);
    expect(MagicLinkRequestBody.safeParse({ email: 'not-an-email' }).success).toBe(false);
    // A password field is not part of the login contract at all.
    expect(MagicLinkRequestBody.safeParse({ email: 'a@b.test', password: 'x' }).success).toBe(
      false,
    );
  });

  it('answers every magic-link request with one byte-identical acknowledgement', () => {
    const ack = MagicLinkRequestResponse.parse({ message: MAGIC_LINK_ACK_MESSAGE });
    expect(ack.message).toBe(
      'If an account exists for that address, a sign-in link is on its way.',
    );
    // Any other message shape is a contract violation: the response must not be
    // able to differ between a registered and an unregistered address.
    expect(MagicLinkRequestResponse.safeParse({ message: 'Link sent!' }).success).toBe(false);
  });

  it('validates the magic-link verify query', () => {
    expect(MagicLinkVerifyQuery.parse({ token: 'x'.repeat(64), next: '/portal' })).toMatchObject({
      next: '/portal',
    });
    // The query is loose on purpose — the token's HMAC is the real validator —
    // but it must still reject an absent or absurdly long token.
    expect(MagicLinkVerifyQuery.safeParse({}).success).toBe(false);
    expect(MagicLinkVerifyQuery.safeParse({ token: '' }).success).toBe(false);
    expect(MagicLinkVerifyQuery.safeParse({ token: 'x'.repeat(2001) }).success).toBe(false);
    // The documented token shape itself stays tight.
    expect(MagicLinkToken.safeParse('too-short').success).toBe(false);
  });

  it('discriminates the three MFA methods', () => {
    expect(MfaVerifyBody.parse({ method: 'totp', code: '481920' })).toEqual({
      method: 'totp',
      code: '481920',
    });
    expect(MfaVerifyBody.parse({ method: 'email_otp', code: '007123' }).method).toBe('email_otp');
    expect(MfaVerifyBody.parse({ method: 'webauthn', assertion: { raw: true } }).method).toBe(
      'webauthn',
    );
    expect(MfaVerifyBody.safeParse({ method: 'totp', code: '12345' }).success).toBe(false);
    expect(MfaVerifyBody.safeParse({ method: 'sms', code: '481920' }).success).toBe(false);
  });

  it('requires matching passwords on signup', () => {
    const valid = {
      fullName: 'Jane Wanjiru',
      email: 'jane.wanjiru@acmefintech.co.ke',
      country: 'KE',
      accountType: 'company',
      password: 'Str0ng-Passphrase!',
      confirmPassword: 'Str0ng-Passphrase!',
    };
    expect(SignupBody.parse(valid)).toMatchObject({ accountType: 'company' });

    const mismatch = SignupBody.safeParse({ ...valid, confirmPassword: 'Different-1!' });
    expect(mismatch.success).toBe(false);
    if (!mismatch.success) {
      expect(mismatch.error.issues[0]?.path).toEqual(['confirmPassword']);
      expect(mismatch.error.issues[0]?.message).toBe('Passwords do not match');
    }
    expect(SignupBody.safeParse({ ...valid, password: 'short' }).success).toBe(false);
  });

  it('enforces the Task 26 complexity rules on the signup password', () => {
    const base = {
      fullName: 'Jane Wanjiru',
      email: 'jane.wanjiru@acmefintech.co.ke',
      country: 'KE',
      accountType: 'individual',
    };
    // Long enough but missing upper / digit / symbol is still rejected.
    expect(
      SignupBody.safeParse({
        ...base,
        password: 'a-long-enough-passphrase',
        confirmPassword: 'a-long-enough-passphrase',
      }).success,
    ).toBe(false);
    expect(
      SignupBody.safeParse({
        ...base,
        password: 'Str0ng-Passphrase!',
        confirmPassword: 'Str0ng-Passphrase!',
      }).success,
    ).toBe(true);
  });

  it('keeps the six-digit shape on every code leg', () => {
    expect(
      SignupVerifyBody.parse({ email: 'jane.wanjiru@acmefintech.co.ke', code: '000000' }),
    ).toMatchObject({ code: '000000' });
    expect(
      SignupVerifyBody.safeParse({ email: 'jane.wanjiru@acmefintech.co.ke', code: '12345' })
        .success,
    ).toBe(false);
    expect(
      SignupVerifyBody.safeParse({ email: 'jane.wanjiru@acmefintech.co.ke', code: 'abcdef' })
        .success,
    ).toBe(false);
  });

  it('describes the silent signup start', () => {
    const start = SignupStartResponse.parse({
      data: {
        email: 'jane.wanjiru@acmefintech.co.ke',
        verificationRequired: true,
        resendAfterSeconds: 30,
        expiresInSeconds: 600,
      },
    });
    expect(start.data.email).toBe('jane.wanjiru@acmefintech.co.ke');
    expect(start.data.verificationRequired).toBe(true);
  });
});

describe('users schemas', () => {
  it('parses every roster fixture', () => {
    for (const member of staffMembers) {
      expect(StaffMember.parse(member)).toEqual(member);
    }
    expect(staffMembers).toHaveLength(10);
    expect(StaffMember.safeParse({ ...staffMembers[0], id: 'u-reed' }).success).toBe(false);
    expect(StaffMember.safeParse({ ...staffMembers[0], mfa: { enrolled: true } }).success).toBe(
      false,
    );
  });

  it('parses the roster summary fixture', () => {
    expect(StaffSummary.parse(staffSummary)).toEqual(staffSummary);
    expect(StaffSummary.safeParse({ ...staffSummary, mfaEnrolmentPercent: 120 }).success).toBe(
      false,
    );
  });

  it('parses the roster query with filters', () => {
    expect(StaffListQuery.parse({ role: 'security_analyst', mfa: 'not_enrolled' })).toMatchObject({
      role: 'security_analyst',
      page: 1,
    });
    expect(StaffListQuery.safeParse({ mfa: 'maybe' }).success).toBe(false);
  });

  it('restricts invitations to staff roles, staff teams and the company domain', () => {
    const valid = {
      fullName: 'Aisha Mohamed',
      email: 'a.mohamed@vunvault.com',
      jobTitle: 'Security Analyst',
      baseLocation: 'Nairobi HQ',
      role: 'security_analyst',
      team: 'offensive_security',
      accessTier: 'standard',
      accessReviewDue: '2027-03-01',
      scopeNotes: 'Offensive Security · Pentest queue',
      checklist: {
        mfaEnrolmentMandatory: true,
        ndaOnFile: true,
        backgroundVerified: false,
        trainingAcknowledged: false,
      },
      draft: false,
    };
    expect(ProvisionInviteBody.parse(valid)).toMatchObject({ role: 'security_analyst' });

    // A client role can never be provisioned as staff.
    expect(ProvisionInviteBody.safeParse({ ...valid, role: 'client' }).success).toBe(false);
    expect(STAFF_ROLES).not.toContain('client');
    // Only the six delivery teams.
    expect(ProvisionInviteBody.safeParse({ ...valid, team: 'curriculum_product' }).success).toBe(
      false,
    );
    expect(STAFF_TEAMS).toHaveLength(6);
    // Only the company domain.
    expect(ProvisionInviteBody.safeParse({ ...valid, email: 'a.mohamed@gmail.com' }).success).toBe(
      false,
    );
    // MFA enrolment is mandatory and cannot be turned off.
    expect(
      ProvisionInviteBody.safeParse({
        ...valid,
        checklist: { ...valid.checklist, mfaEnrolmentMandatory: false },
      }).success,
    ).toBe(false);
  });

  it('parses invitation fixtures and rejects an unknown status', () => {
    for (const invitation of invitations) {
      expect(Invitation.parse(invitation)).toEqual(invitation);
    }
    expect(invitations.map((invitation) => invitation.email)).toContain('j.kariuki@vunvault.com');
    expect(Invitation.safeParse({ ...invitations[0], status: 'bounced' }).success).toBe(false);
  });

  it('parses the administrative action bodies', () => {
    expect(UserActionBody.parse({ reason: 'Left the company' })).toMatchObject({
      reason: 'Left the company',
    });
    expect(UserActionBody.parse({})).toEqual({});
    expect(UserActionBody.safeParse({ reason: 'x'.repeat(501) }).success).toBe(false);
    expect(ChangeRoleBody.parse({ role: 'soc_operator' })).toEqual({ role: 'soc_operator' });
    expect(ChangeRoleBody.safeParse({ role: 'owner' }).success).toBe(false);
  });
});

describe('scan schemas', () => {
  it('parses every queue fixture', () => {
    for (const job of scanJobs) {
      expect(ScanJob.parse(job)).toEqual(job);
    }
    expect(scanJobs).toHaveLength(10);
    expect(scanJobs[0]?.jobCode).toBe('JOB-4471');
    expect(scanJobs[0]?.etaSeconds).toBe(252);
    expect(ScanJob.safeParse({ ...scanJobs[0], jobCode: '4471' }).success).toBe(false);
    expect(ScanJob.safeParse({ ...scanJobs[0], progress: 120 }).success).toBe(false);
  });

  it('parses the queue summary fixture', () => {
    expect(ScanQueueSummary.parse(scanQueueSummary)).toEqual(scanQueueSummary);
    expect(ScanQueueSummary.safeParse({ ...scanQueueSummary, jobsInQueue: -1 }).success).toBe(
      false,
    );
  });

  it('parses the queue query with filters', () => {
    expect(ScanListQuery.parse({ status: 'running', gate: 'in_review' })).toMatchObject({
      status: 'running',
      pageSize: 10,
    });
    expect(ScanListQuery.safeParse({ gate: 'released' }).success).toBe(false);
  });

  it('requires a signed authorisation to create a scan and defaults priority', () => {
    const created = CreateScanBody.parse({
      targetHost: 'api.horizonsacco.co.ke',
      scanType: 'api',
      authorisationDocKey: 'authorisations/2026/horizon-sacco.pdf',
    });
    expect(created.priority).toBe('medium');
    expect(
      CreateScanBody.safeParse({ targetHost: 'api.horizonsacco.co.ke', scanType: 'api' }).success,
    ).toBe(false);
    expect(CreateScanBody.safeParse({ targetHost: 'a', scanType: 'api' }).success).toBe(false);
  });

  it('refuses to release the gate unless all five checks pass', () => {
    const base = { decision: 'approve_release', note: 'Validated and redacted for release.' };

    const passed = GateDecisionBody.safeParse({ ...base, checks: gateChecklistPassed });
    expect(passed.success).toBe(true);

    const oneUnchecked = { ...gateChecklistPassed, evidence_sanitised: false };
    const failed = GateDecisionBody.safeParse({ ...base, checks: oneUnchecked });
    expect(failed.success).toBe(false);
    if (!failed.success) {
      expect(failed.error.issues[0]?.path).toEqual(['checks']);
      expect(failed.error.issues[0]?.message).toBe(GATE_RELEASE_MESSAGE);
      expect(GATE_RELEASE_MESSAGE).toBe('All five verification steps must pass before release');
    }

    expect(Object.values(gateChecklistDefaults)).toEqual([false, false, false, false, false]);
    expect(GateDecisionBody.safeParse({ ...base, checks: gateChecklistDefaults }).success).toBe(
      false,
    );
  });

  it('allows a hold or a rejection with the checklist still open', () => {
    for (const decision of ['hold_remediation', 'reject_archive'] as const) {
      const result = GateDecisionBody.safeParse({
        decision,
        checks: gateChecklistDefaults,
        note: 'Client is remediating two high findings.',
      });
      expect(result.success, decision).toBe(true);
    }
    // A note shorter than ten characters is still refused.
    expect(
      GateDecisionBody.safeParse({
        decision: 'hold_remediation',
        checks: gateChecklistDefaults,
        note: 'no',
      }).success,
    ).toBe(false);
  });

  it('bounds bulk actions to 100 ids', () => {
    expect(BulkScanActionBody.parse({ action: 'place_on_hold', ids: [UUID] })).toMatchObject({
      action: 'place_on_hold',
    });
    expect(BulkScanActionBody.safeParse({ action: 'place_on_hold', ids: [] }).success).toBe(false);
    expect(
      BulkScanActionBody.safeParse({
        action: 'place_on_hold',
        ids: Array.from({ length: 101 }, () => UUID),
      }).success,
    ).toBe(false);
  });

  it('parses a finding and rejects an out-of-range CVSS', () => {
    const finding = {
      id: UUID,
      severity: 'critical',
      title: 'OGNL injection in Struts 2 endpoint',
      description: 'Remote code execution through a crafted Content-Type header.',
      cvss: 9.8,
      cwe: 'CWE-917',
      status: 'validated',
      remediationGuidance: 'Upgrade to Struts 6.4.0 and re-test within 14 days.',
    };
    expect(ScanFinding.parse(finding)).toEqual(finding);
    expect(ScanFinding.safeParse({ ...finding, cvss: 11 }).success).toBe(false);
    expect(ScanFinding.safeParse({ ...finding, severity: 'severe' }).success).toBe(false);
  });

  it('parses a pen-test request and its reference code', () => {
    expect(
      CreatePentestRequestBody.parse({
        targetUrl: 'https://portal.techbridge.co.ke',
        targetType: 'web_application',
        preferredSchedule: '2026-10-12T08:00:00Z',
        notes: 'SSO in scope, payment sandbox out of scope.',
      }),
    ).toMatchObject({ targetType: 'web_application' });
    expect(CreatePentestRequestBody.safeParse({ targetUrl: 'ht', targetType: 'api' }).success).toBe(
      false,
    );

    const request = {
      id: UUID,
      refCode: 'VV-PT-000123',
      targetUrl: 'https://portal.techbridge.co.ke',
      targetType: 'web_application',
      status: 'received',
      createdAt: '2026-09-24T08:00:00Z',
    };
    expect(PentestRequest.parse(request)).toEqual(request);
    expect(PentestRequest.safeParse({ ...request, refCode: 'VV-PT-123' }).success).toBe(false);
  });
});

describe('profile schemas', () => {
  it('parses the client profile fixture', () => {
    expect(ClientProfile.parse(clientProfile)).toEqual(clientProfile);
    expect(clientProfile.clientCode).toBe('VV-CL-48210');
    expect(ClientProfile.safeParse({ ...clientProfile, clientCode: 'CL-48210' }).success).toBe(
      false,
    );
    expect(
      ClientProfile.safeParse({ ...clientProfile, plan: { name: 'Enterprise Client' } }).success,
    ).toBe(false);
  });

  it('accepts a null plan and validates an update', () => {
    expect(ClientProfile.parse({ ...clientProfile, plan: null }).plan).toBeNull();
    expect(
      UpdateProfileBody.parse({
        fullName: 'Jane Wanjiru',
        jobTitle: 'Head of Information Security',
        company: { name: 'Acme Fintech Ltd', industry: 'financial_services_fintech' },
      }),
    ).toMatchObject({ fullName: 'Jane Wanjiru' });
    expect(UpdateProfileBody.safeParse({ fullName: 'J', company: { name: 'Acme' } }).success).toBe(
      false,
    );
    expect(UpdateProfileBody.safeParse({ fullName: 'Jane Wanjiru' }).success).toBe(false);
  });
});

describe('ROUTES_A', () => {
  it('documents every endpoint with a schema name and success status', () => {
    expect(ROUTES_A.length).toBeGreaterThan(20);
    const paths = ROUTES_A.map((route) => `${route.method} ${route.path}`);
    for (const expected of [
      'POST /api/v1/auth/signup',
      'POST /api/v1/auth/magic-link',
      'GET /api/v1/auth/magic-link/verify',
      'POST /api/v1/auth/mfa/verify',
      'POST /api/v1/auth/logout',
      'GET /api/v1/auth/session',
      'GET /api/v1/profile',
      'PATCH /api/v1/profile',
      'GET /api/v1/admin/users',
      'GET /api/v1/admin/users/summary',
      'POST /api/v1/admin/users/invitations',
      'POST /api/v1/admin/users/invitations/:id/resend',
      'DELETE /api/v1/admin/users/invitations/:id',
      'POST /api/v1/admin/users/:id/suspend',
      'POST /api/v1/admin/users/:id/reactivate',
      'POST /api/v1/admin/users/:id/enforce-mfa',
      'PATCH /api/v1/admin/users/:id/role',
      'DELETE /api/v1/admin/users/:id',
      'GET /api/v1/scans',
      'POST /api/v1/scans',
      'GET /api/v1/admin/scans',
      'GET /api/v1/admin/scans/summary',
      'POST /api/v1/admin/scans/:id/gate-decision',
      'POST /api/v1/admin/scans/bulk',
      'POST /api/v1/admin/scans/:id/request-payment',
      'POST /api/v1/admin/scans/:id/cancel',
      'WS /api/v1/scans/:id/stream',
      'POST /api/v1/pentest-requests',
    ]) {
      expect(paths, expected).toContain(expected);
    }
    for (const route of ROUTES_A) {
      expect(typeof route.successStatus).toBe('number');
      // 204s and 302s carry no envelope: a redirect's payload is its Location.
      if (
        route.method !== 'DELETE' &&
        route.method !== 'WS' &&
        route.successStatus !== 204 &&
        route.successStatus !== 302
      ) {
        expect(route.response, route.path).toBeDefined();
      }
    }
  });

  it('documents the error codes the client branches on', () => {
    const signup = ROUTES_A.find((route) => route.path === '/api/v1/auth/signup');
    expect(signup?.errors?.map((error) => error.code)).toEqual([
      'validation_failed',
      'email_taken',
      'breached_password',
      'signup_not_allowed',
      'rate_limited',
    ]);
    // Phase 1: the magic-link pair replaced every password-login route.
    const magic = ROUTES_A.find((route) => route.path === '/api/v1/auth/magic-link');
    expect(magic?.request).toBe('MagicLinkRequestBody');
    expect(magic?.response).toBe('MagicLinkRequestResponse');
    const verify = ROUTES_A.find((route) => route.path === '/api/v1/auth/magic-link/verify');
    expect(verify?.method).toBe('GET');
    expect(verify?.successStatus).toBe(302);
    // Phase 5: forgot/reset password died with password login — the docs must
    // not advertise routes that no longer exist.
    const paths = ROUTES_A.map((route) => `${route.method} ${route.path}`);
    for (const removed of [
      'POST /api/v1/auth/forgot-password',
      'POST /api/v1/auth/reset-password',
      'POST /api/v1/auth/login',
    ]) {
      expect(paths, removed).not.toContain(removed);
    }
    const gate = ROUTES_A.find((route) => route.path === '/api/v1/admin/scans/:id/gate-decision');
    expect(gate?.errors?.map((error) => error.code)).toContain('payment_outstanding');
  });
});
