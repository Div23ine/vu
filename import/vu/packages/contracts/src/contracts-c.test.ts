import { describe, expect, it } from 'vitest';
import {
  mfaStatus,
  notificationPrefs,
  profileSettings,
  securityPosture,
  sessions,
} from '../fixtures/account';
import {
  dashboardKpis,
  endpointStats,
  nodes,
  pipelineSummary,
  recentTransactions,
  revenueSummary,
  runningScans,
  threatLevel,
  trafficSummary,
  transactions,
} from '../fixtures/dashboard';
import { advisories, advisorySummary, broadcastEstimate, drafts } from '../fixtures/intel';
import {
  AvatarConfirmBody,
  AvatarUploadRequest,
  AvatarUploadResponse,
  ChangePasswordBody,
  CONFIRM_PASSWORD_MESSAGE,
  DeactivationRequestBody,
  LANGUAGES,
  MfaStatus,
  NOTIFICATION_CHANNEL_LABELS,
  NOTIFICATION_EVENT_META,
  NOTIFICATION_GROUPS,
  PASSWORD_RULES,
  ProfileSettings,
  RecoveryCodeBody,
  RecoveryCodesResponse,
  RecoveryCodesStatus,
  RECOVERY_QUESTION_LABELS,
  scorePassword,
  SecurityPosture,
  SessionView,
  SessionsResponse,
  TIMEZONES,
  TotpEnrollStart,
  TotpVerifyBody,
  UpdateNotificationPrefsBody,
  UpdateProfileSettingsBody,
  WebauthnKey,
  WebauthnRegisterVerifyBody,
  postureScore,
  SECURITY_POSTURE_ITEMS,
} from './account';
import {
  DashboardKpis,
  EndpointStat,
  NodeHeartbeatBody,
  NodesResponse,
  NODE_STATUS_LABELS,
  PipelineSummary,
  RecentTransaction,
  RevenueSummary,
  RunningScansResponse,
  THREAT_ESCALATION_LEVEL,
  THREAT_LEVEL_LABELS,
  ThreatLevel,
  TrafficSummary,
  TransactionsResponse,
  WEEKDAYS,
} from './dashboard';
import {
  ADVISORY_STATUS_LABELS,
  ADVISORY_TITLE_MESSAGE,
  Advisory,
  AdvisoryDraftBody,
  AdvisoryListQuery,
  AdvisoryPublishable,
  AdvisorySummary,
  BROADCAST_ACK_LABELS,
  BROADCAST_ACK_MESSAGE,
  BROADCAST_CONFIRM_PHRASE,
  BroadcastEstimate,
  BroadcastRecord,
  ClientAdvisory,
  CVE_ID_MESSAGE,
  DraftListItem,
  EmergencyBroadcastBody,
  NvdImportQuery,
  NvdImportResult,
  PatchStatusBody,
  PATCH_STATUS_LABELS,
  RetractBody,
  SCOPE_CATEGORY_LABELS,
  SEVERITY_CVSS_HINTS,
  severityMatchesCvss,
} from './intel';
import {
  CAREER_DESCRIPTIONS,
  CAREER_LABELS,
  EMAIL_MATCH_MESSAGE,
  ENTITY_DESCRIPTIONS,
  ENTITY_LABELS,
  isAtLeast16,
  MIN_AGE_MESSAGE,
  OnboardingStep1,
  OnboardingStep2,
  OnboardingStep3,
  OnboardingStatus,
  OnboardingSubmitBody,
} from './onboarding';
import { PERMISSIONS, ROLE_PERMISSIONS } from './permissions';
import { ROUTES_C, type RouteDocC } from './routes-c';
import {
  BLOG_CATEGORY_LABELS,
  countWords,
  isReadyToSubmit,
  readMinutes,
  StudioDraftBody,
  StudioImageUploadRequest,
  StudioImageUploadResponse,
  StudioItem,
  STUDIO_LIMITS,
  STUDIO_READINESS_LABELS,
  STUDIO_REQUIRED_READINESS,
  StudioStatus,
  StudioSubmitReadiness,
  STUDIO_TAG_SUGGESTIONS,
} from './studio';

const UUID = 'c0000000-0000-4000-8000-000000000001';
const ALL_ACKS = {
  severityCorrect: true,
  scopeComplete: true,
  contentSafe: true,
  remediationActionable: true,
  authorised: true,
};

/** A fully populated draft, built from the published Struts fixture. */
function publishableDraft() {
  const struts = advisories[0];
  if (struts === undefined) throw new Error('missing advisory fixture');
  return {
    cveId: struts.cveId,
    vendor: struts.vendor ?? undefined,
    cvss: struts.cvss ?? undefined,
    disclosureDate: struts.disclosureDate ?? undefined,
    severity: struts.severity ?? undefined,
    weaponized: struts.weaponized,
    publicPoc: struts.publicPoc,
    preAuth: struts.preAuth,
    patchAvailable: struts.patchAvailable,
    title: struts.title ?? undefined,
    summary: struts.summary ?? undefined,
    remediation: struts.remediation ?? undefined,
    references: struts.references,
    scope: struts.scope,
  };
}

describe('intel:broadcast permission', () => {
  it('exists and is granted to administrators only', () => {
    expect(PERMISSIONS).toContain('intel:broadcast');
    expect(ROLE_PERMISSIONS.super_admin).toContain('intel:broadcast');
    expect(ROLE_PERMISSIONS.admin).toContain('intel:broadcast');
    expect(ROLE_PERMISSIONS.security_analyst).not.toContain('intel:broadcast');
    expect(ROLE_PERMISSIONS.soc_operator).not.toContain('intel:broadcast');
    expect(ROLE_PERMISSIONS.compliance_auditor).not.toContain('intel:broadcast');
    expect(ROLE_PERMISSIONS.support_engineer).not.toContain('intel:broadcast');
    expect(ROLE_PERMISSIONS.client).not.toContain('intel:broadcast');
  });

  it('keeps intel:write for analysts so they can still author drafts', () => {
    expect(ROLE_PERMISSIONS.security_analyst).toContain('intel:write');
    expect(ROLE_PERMISSIONS.security_analyst).toContain('intel:read');
  });
});

describe('intel schemas', () => {
  it('parses every advisory fixture', () => {
    for (const advisory of advisories) {
      expect(Advisory.parse(advisory)).toEqual(advisory);
    }
    expect(advisories).toHaveLength(6);
    expect(advisories[0]?.cveId).toBe('CVE-2026-21447');
    expect(advisories[0]?.reach).toBe(312);
    expect(Advisory.safeParse({ ...advisories[0], cvss: 'high' }).success).toBe(false);
    expect(Advisory.safeParse({ ...advisories[0], status: 'archived' }).success).toBe(false);
  });

  it('accepts an incomplete draft but demands a valid CVE id', () => {
    const minimal = {
      cveId: 'CVE-2026-40118',
      weaponized: false,
      publicPoc: false,
      preAuth: false,
      patchAvailable: false,
      scope: [],
    };
    const parsed = AdvisoryDraftBody.parse(minimal);
    expect(parsed.references).toEqual([]);
    expect(AdvisoryDraftBody.safeParse({ ...minimal, cveId: 'CVE-2026-401' }).success).toBe(false);

    const bad = AdvisoryDraftBody.safeParse({ ...minimal, cveId: 'GHSA-1234' });
    expect(bad.success).toBe(false);
    if (!bad.success) expect(bad.error.issues[0]?.message).toBe(CVE_ID_MESSAGE);
  });

  it('rejects an unpublishable advisory and accepts a complete one', () => {
    const complete = publishableDraft();
    expect(AdvisoryPublishable.parse(complete)).toMatchObject({ cveId: 'CVE-2026-21447' });

    const noTitle = AdvisoryPublishable.safeParse({ ...complete, title: undefined });
    expect(noTitle.success).toBe(false);
    if (!noTitle.success) {
      expect(noTitle.error.issues[0]?.path).toEqual(['title']);
      expect(noTitle.error.issues[0]?.message).toBe(ADVISORY_TITLE_MESSAGE);
    }
    expect(AdvisoryPublishable.safeParse({ ...complete, scope: [] }).success).toBe(false);
    expect(AdvisoryPublishable.safeParse({ ...complete, summary: undefined }).success).toBe(false);
    expect(AdvisoryPublishable.safeParse({ ...complete, remediation: '' }).success).toBe(false);
    expect(AdvisoryPublishable.safeParse({ ...complete, severity: undefined }).success).toBe(false);
  });

  it('refuses a severity that disagrees with the CVSS band', () => {
    const complete = publishableDraft();
    const mismatch = AdvisoryPublishable.safeParse({ ...complete, severity: 'low', cvss: 9.5 });
    expect(mismatch.success).toBe(false);
    if (!mismatch.success) {
      expect(mismatch.error.issues.some((issue) => issue.path[0] === 'severity')).toBe(true);
    }
    expect(severityMatchesCvss('low', 9.5)).toBe(false);
    expect(severityMatchesCvss('critical', 9.5)).toBe(true);
    expect(severityMatchesCvss('high', 8.9)).toBe(true);
    expect(severityMatchesCvss('high', 9.0)).toBe(false);
    expect(severityMatchesCvss('medium', 4.0)).toBe(true);
    expect(severityMatchesCvss('low', 0.1)).toBe(true);
    // One decimal place only.
    expect(AdvisoryDraftBody.safeParse({ ...complete, cvss: 7.25 }).success).toBe(false);
    expect(AdvisoryDraftBody.safeParse({ ...complete, cvss: 10.1 }).success).toBe(false);
  });

  it('parses the summary, drafts, list query and NVD import', () => {
    expect(AdvisorySummary.parse(advisorySummary)).toEqual(advisorySummary);
    expect(advisorySummary.activeZeroDays).toBe(1284);
    expect(AdvisorySummary.safeParse({ ...advisorySummary, openDrafts: -1 }).success).toBe(false);

    for (const draft of drafts) {
      expect(DraftListItem.parse(draft)).toEqual(draft);
    }
    expect(drafts.map((draft) => draft.note)).toEqual([
      'Unsaved changes',
      'Awaiting reviewer',
      'Needs scope entries',
    ]);
    expect(DraftListItem.safeParse({ ...drafts[0], note: 'Stale' }).success).toBe(false);

    expect(AdvisoryListQuery.parse({ status: 'published', severity: 'critical' })).toMatchObject({
      status: 'published',
      page: 1,
    });
    expect(AdvisoryListQuery.safeParse({ status: 'live' }).success).toBe(false);

    expect(NvdImportQuery.parse({ cveId: 'CVE-2026-21447' })).toEqual({
      cveId: 'CVE-2026-21447',
    });
    expect(NvdImportQuery.safeParse({ cveId: '2026-21447' }).success).toBe(false);
    const nvd = {
      cveId: 'CVE-2026-21447',
      vendor: 'Apache',
      cvss: 9.8,
      severity: 'critical',
      disclosureDate: '2026-09-22',
      title: 'Apache Struts 2 — OGNL injection RCE',
      summary: null,
      references: ['https://nvd.nist.gov/vuln/detail/CVE-2026-21447'],
    };
    expect(NvdImportResult.parse(nvd)).toEqual(nvd);
    expect(NvdImportResult.safeParse({ ...nvd, references: 'none' }).success).toBe(false);
  });

  it('parses the broadcast estimate', () => {
    expect(BroadcastEstimate.parse(broadcastEstimate)).toEqual(broadcastEstimate);
    expect(broadcastEstimate.dashboards).toBe(312);
    expect(BroadcastEstimate.safeParse({ ...broadcastEstimate, smsContacts: -1 }).success).toBe(
      false,
    );
  });

  it('locks the emergency broadcast behind five acks and the phrase', () => {
    const valid = EmergencyBroadcastBody.safeParse({ ack: ALL_ACKS, confirmPhrase: 'BROADCAST' });
    expect(valid.success).toBe(true);

    // Case-insensitive, surrounding whitespace tolerated.
    expect(
      EmergencyBroadcastBody.safeParse({ ack: ALL_ACKS, confirmPhrase: 'broadcast' }).success,
    ).toBe(true);
    expect(
      EmergencyBroadcastBody.safeParse({ ack: ALL_ACKS, confirmPhrase: '  Broadcast  ' }).success,
    ).toBe(true);
    expect(BROADCAST_CONFIRM_PHRASE).toBe('BROADCAST');

    const wrongPhrase = EmergencyBroadcastBody.safeParse({
      ack: ALL_ACKS,
      confirmPhrase: 'broadcast now',
    });
    expect(wrongPhrase.success).toBe(false);
    if (!wrongPhrase.success) {
      expect(wrongPhrase.error.issues[0]?.path).toEqual(['confirmPhrase']);
    }

    // Any single false acknowledgement blocks the broadcast.
    for (const key of Object.keys(BROADCAST_ACK_LABELS) as Array<keyof typeof ALL_ACKS>) {
      const result = EmergencyBroadcastBody.safeParse({
        ack: { ...ALL_ACKS, [key]: false },
        confirmPhrase: 'BROADCAST',
      });
      expect(result.success, key).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.path).toEqual(['ack']);
        expect(result.error.issues[0]?.message).toBe(BROADCAST_ACK_MESSAGE);
      }
    }
    expect(Object.keys(BROADCAST_ACK_LABELS)).toHaveLength(5);
    expect(BROADCAST_ACK_LABELS.authorised.title).toBe(
      'I am authorised to issue emergency broadcasts',
    );
  });

  it('parses retraction, patch status, broadcast records and the client view', () => {
    expect(
      RetractBody.parse({ note: 'Vendor disputed the affected version range.' }),
    ).toMatchObject({
      note: 'Vendor disputed the affected version range.',
    });
    expect(RetractBody.safeParse({ note: 'wrong' }).success).toBe(false);
    expect(PatchStatusBody.parse({ patchStatus: 'patched' })).toEqual({ patchStatus: 'patched' });
    expect(PatchStatusBody.safeParse({ patchStatus: 'fixed' }).success).toBe(false);

    const record = {
      id: UUID,
      advisoryId: advisories[0]?.id,
      kind: 'initial',
      status: 'sent',
      triggeredByLabel: 'f.hassan',
      audienceDashboards: 312,
      emailContacts: 486,
      smsContacts: 74,
      sentDashboards: 312,
      sentEmail: 486,
      sentSms: 74,
      failed: 0,
      createdAt: '2026-09-24T14:36:00Z',
      finishedAt: '2026-09-24T14:37:12Z',
    };
    expect(BroadcastRecord.parse(record)).toEqual(record);
    expect(BroadcastRecord.safeParse({ ...record, kind: 'final' }).success).toBe(false);

    const struts = advisories[0];
    const client = {
      id: struts?.id,
      cveId: struts?.cveId,
      title: struts?.title,
      severity: struts?.severity,
      scope: struts?.scope,
      summary: struts?.summary,
      remediation: struts?.remediation,
      references: struts?.references,
      patchStatus: struts?.patchStatus,
      publishedAt: struts?.publishedAt,
      source: 'VUNVAULT Intelligence',
      acknowledged: false,
    };
    expect(ClientAdvisory.parse(client)).toMatchObject({ source: 'VUNVAULT Intelligence' });
    expect(ClientAdvisory.safeParse({ ...client, source: 'NVD' }).success).toBe(false);
  });

  it('labels every scope category, severity hint and status', () => {
    expect(SCOPE_CATEGORY_LABELS.web_api).toBe('Web & API');
    expect(SCOPE_CATEGORY_LABELS.ot_ics).toBe('OT / ICS');
    expect(SCOPE_CATEGORY_LABELS.identity_sso).toBe('Identity & SSO');
    expect(Object.keys(SCOPE_CATEGORY_LABELS)).toHaveLength(7);
    expect(SEVERITY_CVSS_HINTS.critical).toBe('CVSS 9.0 – 10.0');
    expect(SEVERITY_CVSS_HINTS.low).toBe('CVSS 0.1 – 3.9');
    expect(PATCH_STATUS_LABELS.patch_in_progress).toBe('Patch in progress');
    expect(ADVISORY_STATUS_LABELS.draft).toBe('Draft — Not Published');
  });
});

describe('dashboard schemas', () => {
  it('parses every Command Center fixture', () => {
    expect(DashboardKpis.parse(dashboardKpis)).toEqual(dashboardKpis);
    expect(RevenueSummary.parse(revenueSummary)).toEqual(revenueSummary);
    expect(TrafficSummary.parse(trafficSummary)).toEqual(trafficSummary);
    expect(PipelineSummary.parse(pipelineSummary)).toEqual(pipelineSummary);
    expect(NodesResponse.parse(nodes)).toEqual(nodes);
    expect(RunningScansResponse.parse(runningScans)).toEqual(runningScans);
    expect(ThreatLevel.parse(threatLevel)).toEqual(threatLevel);
    expect(TransactionsResponse.parse(transactions)).toEqual(transactions);
    for (const stat of endpointStats) expect(EndpointStat.parse(stat)).toEqual(stat);
    for (const txn of recentTransactions) expect(RecentTransaction.parse(txn)).toEqual(txn);
  });

  it('rejects out-of-range dashboard values', () => {
    expect(DashboardKpis.safeParse({ ...dashboardKpis, totalPaidClients: -1 }).success).toBe(false);
    expect(ThreatLevel.safeParse({ ...threatLevel, level: 6 }).success).toBe(false);
    expect(NodesResponse.safeParse({ ...nodes, online: 500, total: 412 }).success).toBe(true);
    const node = nodes.data[0];
    expect(
      NodesResponse.safeParse({ ...nodes, data: [{ ...node, loadPercent: 140 }] }).success,
    ).toBe(false);
    expect(
      TransactionsResponse.safeParse({
        ...transactions,
        data: [{ ...recentTransactions[0], txnCode: 'TX-90241' }],
      }).success,
    ).toBe(false);
    expect(
      RunningScansResponse.safeParse({
        ...runningScans,
        data: [{ ...runningScans.data[0], progress: 120 }],
      }).success,
    ).toBe(false);
  });

  it('names the threat levels and escalates from level 4', () => {
    expect(THREAT_LEVEL_LABELS).toEqual({
      1: 'Low',
      2: 'Guarded',
      3: 'Elevated',
      4: 'High',
      5: 'Severe',
    });
    expect(THREAT_ESCALATION_LEVEL).toBe(4);
    expect(threatLevel.label).toBe(THREAT_LEVEL_LABELS[threatLevel.level as 4]);
    expect(NODE_STATUS_LABELS.drift_warning).toBe('Drift Warning');
    expect(WEEKDAYS).toHaveLength(7);
    expect(threatLevel.blockedLast7Days.map((day) => day.day)).toEqual([...WEEKDAYS]);
  });

  it('validates a signed node heartbeat', () => {
    const heartbeat = {
      nodeCode: 'node-nbo-01',
      sentAt: '2026-09-24T12:00:00Z',
      reqPerMin: 41200,
      loadPercent: 62,
      clockDriftMs: 2,
      signature: 'MEUCIQDx-signature-base64',
    };
    expect(NodeHeartbeatBody.parse(heartbeat)).toEqual(heartbeat);
    expect(NodeHeartbeatBody.safeParse({ ...heartbeat, loadPercent: 101 }).success).toBe(false);
    expect(NodeHeartbeatBody.safeParse({ ...heartbeat, signature: '' }).success).toBe(false);
  });
});

describe('account schemas', () => {
  it('enforces the password rules and the confirmation match', () => {
    const valid = {
      currentPassword: 'Old-Password-1!',
      newPassword: 'New-Password-2@',
      confirmPassword: 'New-Password-2@',
    };
    expect(ChangePasswordBody.parse(valid)).toMatchObject({ newPassword: valid.newPassword });

    const mismatch = ChangePasswordBody.safeParse({ ...valid, confirmPassword: 'New-Password-3@' });
    expect(mismatch.success).toBe(false);
    if (!mismatch.success) {
      expect(mismatch.error.issues[0]?.path).toEqual(['confirmPassword']);
      expect(mismatch.error.issues[0]?.message).toBe(CONFIRM_PASSWORD_MESSAGE);
    }
    expect(ChangePasswordBody.safeParse({ ...valid, newPassword: 'short1!' }).success).toBe(false);
    expect(ChangePasswordBody.safeParse({ ...valid, newPassword: 'alllowercase1!' }).success).toBe(
      false,
    );
    expect(ChangePasswordBody.safeParse({ ...valid, newPassword: 'NoDigitsHere!' }).success).toBe(
      false,
    );
    expect(ChangePasswordBody.safeParse({ ...valid, newPassword: 'NoSymbol12345' }).success).toBe(
      false,
    );
    expect(
      ChangePasswordBody.safeParse({ ...valid, newPassword: valid.currentPassword }).success,
    ).toBe(false);
    expect(PASSWORD_RULES.map((rule) => rule.id)).toEqual([
      'len',
      'upper',
      'lower',
      'digit',
      'symbol',
    ]);
    expect(PASSWORD_RULES[0]?.label).toBe('At least 12 characters');
  });

  it('scores a password from 0 to 4', () => {
    expect(scorePassword('')).toEqual({ score: 0, label: 'Awaiting input' });
    // 1 rule satisfied → Weak; 5 rules satisfied → Strong.
    expect(scorePassword('abc')).toEqual({ score: 1, label: 'Weak' });
    expect(scorePassword('Abcdefgh')).toEqual({ score: 1, label: 'Weak' });
    expect(scorePassword('Abcdefgh1')).toEqual({ score: 2, label: 'Fair' });
    expect(scorePassword('Abcdefgh1!')).toEqual({ score: 3, label: 'Good' });
    expect(scorePassword('Abcdefghij1!')).toEqual({ score: 4, label: 'Strong' });
  });

  it('parses the TOTP, WebAuthn and recovery-code shapes', () => {
    const enroll = {
      data: {
        factorId: 'factor-01HZX9K3Q7V2T8AB',
        qrCodeSvg: '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
        secret: 'JBSWY3DPEHPK3PXP',
        uri: 'otpauth://totp/VUNVAULT:e.reed@vunvault.com?secret=JBSWY3DPEHPK3PXP',
      },
    };
    expect(TotpEnrollStart.parse(enroll)).toEqual(enroll);
    expect(
      TotpEnrollStart.safeParse({
        ...enroll,
        data: { ...enroll.data, secret: 'not base32 1018' },
      }).success,
    ).toBe(false);

    expect(TotpVerifyBody.parse({ factorId: 'factor-1', code: '481920' })).toMatchObject({
      code: '481920',
    });
    expect(TotpVerifyBody.safeParse({ factorId: 'factor-1', code: '12345' }).success).toBe(false);

    expect(WebauthnRegisterVerifyBody.parse({ credential: { rawId: 'AA' } })).toBeDefined();
    const key = {
      id: UUID,
      deviceName: 'YubiKey 5C NFC',
      createdAt: '2026-08-12T00:00:00Z',
      lastUsedAt: null,
    };
    expect(WebauthnKey.parse(key)).toEqual(key);
    expect(WebauthnKey.safeParse({ ...key, createdAt: 'last year' }).success).toBe(false);

    expect(RecoveryCodeBody.parse({ code: 'K7QX-2M9F-4TWA' })).toEqual({ code: 'K7QX-2M9F-4TWA' });
    expect(RecoveryCodeBody.safeParse({ code: 'k7qx-2m9f-4twa' }).success).toBe(false);
    expect(RecoveryCodeBody.safeParse({ code: 'K7QX-2M9F' }).success).toBe(false);

    const codes = {
      data: {
        codes: Array.from({ length: 10 }, (_unused, index) => `K7QX-2M9F-4TW${index}`),
        batchId: UUID,
        generatedAt: '2026-08-12T00:00:00Z',
      },
    };
    expect(RecoveryCodesResponse.parse(codes).data.codes).toHaveLength(10);
    expect(
      RecoveryCodesResponse.safeParse({
        ...codes,
        data: { ...codes.data, codes: codes.data.codes.slice(0, 9) },
      }).success,
    ).toBe(false);

    expect(RecoveryCodesStatus.parse(mfaStatus.recovery)).toEqual(mfaStatus.recovery);
    expect(RecoveryCodesStatus.safeParse({ ...mfaStatus.recovery, total: 8 }).success).toBe(false);
  });

  it('parses the MFA, session, settings and posture fixtures', () => {
    expect(MfaStatus.parse(mfaStatus)).toEqual(mfaStatus);
    expect(MfaStatus.safeParse({ ...mfaStatus, require2fa: 'yes' }).success).toBe(false);

    for (const session of sessions) expect(SessionView.parse(session)).toEqual(session);
    expect(SessionsResponse.parse({ data: sessions })).toEqual({ data: sessions });
    expect(sessions.filter((session) => session.current)).toHaveLength(1);
    expect(SessionView.safeParse({ ...sessions[0], startedAt: 'today' }).success).toBe(false);

    expect(ProfileSettings.parse(profileSettings)).toEqual(profileSettings);
    expect(profileSettings.timezone).toBe('Africa/Nairobi');
    expect(ProfileSettings.safeParse({ ...profileSettings, language: 'de' }).success).toBe(false);

    expect(SecurityPosture.parse(securityPosture)).toEqual(securityPosture);
    // The formula, not the prototype's hard-coded 80.
    expect(postureScore(3, 4)).toBe(75);
    expect(securityPosture.score).toBe(75);
    expect(securityPosture.items.map((item) => item.label)).toEqual([...SECURITY_POSTURE_ITEMS]);
    expect(SecurityPosture.safeParse({ ...securityPosture, score: 101 }).success).toBe(false);
  });

  it('validates settings updates, avatars and deactivation', () => {
    expect(
      UpdateProfileSettingsBody.parse({
        firstName: 'Evelyn',
        lastName: 'Reed',
        displayName: 'e.reed',
        timezone: 'Africa/Nairobi',
        language: 'en-GB',
      }),
    ).toMatchObject({ firstName: 'Evelyn' });
    expect(
      UpdateProfileSettingsBody.safeParse({
        firstName: 'Evelyn',
        lastName: 'Reed',
        displayName: 'e',
        timezone: 'Mars/Olympus',
        language: 'en-GB',
      }).success,
    ).toBe(false);
    expect(Object.keys(TIMEZONES)).toHaveLength(8);
    expect(TIMEZONES['Africa/Nairobi']).toBe('Africa/Nairobi — EAT (UTC+3)');
    expect(LANGUAGES.fr).toBe('Français');

    expect(
      AvatarUploadRequest.parse({ contentType: 'image/png', sizeBytes: 204800 }),
    ).toMatchObject({ contentType: 'image/png' });
    expect(
      AvatarUploadRequest.safeParse({ contentType: 'image/tiff', sizeBytes: 1024 }).success,
    ).toBe(false);
    expect(
      AvatarUploadRequest.safeParse({ contentType: 'image/png', sizeBytes: 4_194_305 }).success,
    ).toBe(false);
    expect(
      AvatarUploadResponse.parse({
        data: {
          uploadUrl: 'https://r2.example.test/avatars/e.reed.png?sig=1',
          objectKey: 'avatars/e.reed.png',
          expiresAt: '2026-09-24T12:15:00Z',
        },
      }).data.objectKey,
    ).toBe('avatars/e.reed.png');
    expect(AvatarConfirmBody.safeParse({ objectKey: '' }).success).toBe(false);

    expect(DeactivationRequestBody.parse({ reason: 'Leaving the organisation.' })).toBeDefined();
    expect(DeactivationRequestBody.safeParse({ reason: 'short' }).success).toBe(false);
  });

  it('parses notification preferences at the planner defaults', () => {
    expect(UpdateNotificationPrefsBody.parse(notificationPrefs)).toEqual(notificationPrefs);
    expect(Object.keys(notificationPrefs.events)).toHaveLength(11);
    for (const toggles of Object.values(notificationPrefs.events)) {
      expect(toggles).toEqual({ inApp: true, email: true, sms: false, push: false });
    }
    expect(notificationPrefs.quietHours).toEqual({ enabled: false, from: null, to: null });
    expect(
      UpdateNotificationPrefsBody.safeParse({
        ...notificationPrefs,
        quietHours: { enabled: true, from: '22:00', to: '06:00' },
      }).success,
    ).toBe(true);
    expect(
      UpdateNotificationPrefsBody.safeParse({
        ...notificationPrefs,
        quietHours: { enabled: true, from: '10pm', to: null },
      }).success,
    ).toBe(false);
  });

  it('documents every notification event and channel', () => {
    for (const [event, meta] of Object.entries(NOTIFICATION_EVENT_META)) {
      expect(NOTIFICATION_GROUPS, event).toContain(meta.group);
      expect(meta.title.length, event).toBeGreaterThan(0);
      expect(meta.description.length, event).toBeGreaterThan(0);
    }
    expect(Object.keys(NOTIFICATION_EVENT_META)).toHaveLength(11);
    expect(NOTIFICATION_EVENT_META.advisory_broadcast.title).toBe('Zero-day advisory broadcast');
    expect(NOTIFICATION_CHANNEL_LABELS).toEqual({
      in_app: 'In-App',
      email: 'Email',
      sms: 'SMS',
      push: 'Push',
    });
    expect(RECOVERY_QUESTION_LABELS.first_pet).toBe('What was the name of your first pet?');
    expect(RECOVERY_QUESTION_LABELS.maiden_name).toBe("What is your mother's maiden name?");
  });
});

describe('onboarding schemas', () => {
  const step1 = {
    fullName: 'Jane Wanjiru',
    dateOfBirth: '1990-04-18',
    phone: '+254712345678',
    email: 'jane.wanjiru@acmefintech.co.ke',
    emailConfirm: 'jane.wanjiru@acmefintech.co.ke',
  };

  it('accepts a valid first step', () => {
    expect(OnboardingStep1.parse(step1)).toEqual(step1);
    expect(isAtLeast16('1990-04-18', new Date('2026-09-24T00:00:00Z'))).toBe(true);
  });

  it('refuses an under-16 date of birth', () => {
    const tooYoung = OnboardingStep1.safeParse({ ...step1, dateOfBirth: '2015-01-01' });
    expect(tooYoung.success).toBe(false);
    if (!tooYoung.success) {
      expect(tooYoung.error.issues[0]?.path).toEqual(['dateOfBirth']);
      expect(tooYoung.error.issues[0]?.message).toBe(MIN_AGE_MESSAGE);
    }
    expect(isAtLeast16('2015-01-01', new Date('2026-09-24T00:00:00Z'))).toBe(false);
    // Exactly 16 today is allowed.
    expect(isAtLeast16('2010-09-24', new Date('2026-09-24T00:00:00Z'))).toBe(true);
    expect(isAtLeast16('2010-09-25', new Date('2026-09-24T00:00:00Z'))).toBe(false);
  });

  it('requires matching emails and an E.164 phone', () => {
    const mismatch = OnboardingStep1.safeParse({ ...step1, emailConfirm: 'jane@other.co.ke' });
    expect(mismatch.success).toBe(false);
    if (!mismatch.success) {
      expect(mismatch.error.issues[0]?.path).toEqual(['emailConfirm']);
      expect(mismatch.error.issues[0]?.message).toBe(EMAIL_MATCH_MESSAGE);
    }
    expect(OnboardingStep1.safeParse({ ...step1, phone: '0712345678' }).success).toBe(false);
    expect(OnboardingStep1.safeParse({ ...step1, phone: undefined }).success).toBe(true);
  });

  it('requires all three declarations and a recovery answer', () => {
    expect(OnboardingStep2.parse({ career: 'business_owner', entity: 'company' })).toEqual({
      career: 'business_owner',
      entity: 'company',
    });
    expect(OnboardingStep2.safeParse({ career: 'hobbyist', entity: 'company' }).success).toBe(
      false,
    );

    const step3 = {
      recoveryQuestion: 'first_pet',
      recoveryAnswer: 'Simba',
      declarations: { infoAccurate: true, authorisedTesting: true, termsAccepted: true },
    };
    expect(OnboardingStep3.parse(step3)).toEqual(step3);
    expect(
      OnboardingStep3.safeParse({
        ...step3,
        declarations: { ...step3.declarations, termsAccepted: false },
      }).success,
    ).toBe(false);
    expect(OnboardingStep3.safeParse({ ...step3, recoveryAnswer: 'no' }).success).toBe(false);

    expect(
      OnboardingSubmitBody.parse({
        step1,
        step2: { career: 'student', entity: 'individual' },
        step3,
      }),
    ).toBeDefined();
    expect(
      OnboardingStatus.parse({ completed: true, completedAt: '2026-09-24T12:00:00Z' }),
    ).toBeDefined();
    expect(OnboardingStatus.safeParse({ completed: true }).success).toBe(false);

    expect(CAREER_LABELS.cybersecurity_professional).toBe('Cybersecurity Professional');
    expect(CAREER_DESCRIPTIONS.student).toBe('Learning tracks, labs and free certificates.');
    expect(ENTITY_LABELS.corporation).toBe('Corporation');
    expect(ENTITY_DESCRIPTIONS.company).toBe('Registered business or startup.');
  });
});

describe('content studio schemas', () => {
  it('counts words and derives reading time', () => {
    expect(countWords('')).toBe(0);
    expect(countWords('# Heading\n\nOne two three')).toBe(4);
    // Link labels are kept, images are dropped: `A link and an`.
    expect(
      countWords('A [link](https://example.test) and an ![image](https://example.test/i.png)'),
    ).toBe(4);
    // Inline code is dropped: it is not prose a reader reads at 200 wpm.
    expect(countWords('Text with `inline code` here')).toBe(3);
    expect(countWords('```js\nconst a = 1;\n```\nAfter the fence')).toBe(3);
    expect(readMinutes('')).toBe(1);
    expect(readMinutes('word '.repeat(150))).toBe(1);
    expect(readMinutes('word '.repeat(400))).toBe(2);
    expect(readMinutes('word '.repeat(1000))).toBe(5);
    expect(STUDIO_LIMITS).toEqual({
      title: 120,
      excerpt: 240,
      tags: 8,
      minWords: 150,
      imageMaxBytes: 5_242_880,
    });
  });

  it('validates a draft body, its slug and its tags', () => {
    const draft = {
      title: 'Africa’s Cyber Awakening',
      slug: 'africa-cyber-awakening',
      category: 'blog',
      excerpt: 'An overview of cyber defence investment across the continent.',
      bodyMd: 'word '.repeat(200),
      tags: ['#security', 'africa'],
      featuredImageUrl: 'https://cdn.vunvault.test/blog/africa.png',
      imageAlt: 'Map of Africa with sensor nodes',
    };
    expect(StudioDraftBody.parse(draft)).toMatchObject({ slug: 'africa-cyber-awakening' });
    expect(StudioDraftBody.safeParse({ ...draft, slug: 'Africa Cyber' }).success).toBe(false);
    expect(StudioDraftBody.safeParse({ ...draft, tags: ['#UPPER'] }).success).toBe(false);
    expect(
      StudioDraftBody.safeParse({ ...draft, tags: Array.from({ length: 9 }, () => '#security') })
        .success,
    ).toBe(false);
    expect(StudioDraftBody.safeParse({ ...draft, excerpt: 'x'.repeat(241) }).success).toBe(false);
    expect(StudioDraftBody.safeParse({ ...draft, category: 'opinion' }).success).toBe(false);
    expect(STUDIO_TAG_SUGGESTIONS).toHaveLength(6);
    expect(BLOG_CATEGORY_LABELS.threat_intel).toBe('Threat Intel');
  });

  it('gates submission on the three required readiness checks', () => {
    const ready: StudioSubmitReadiness = {
      title: true,
      category: true,
      bodyWords: true,
      excerpt: false,
      featuredImage: false,
      tags: false,
    };
    expect(StudioSubmitReadiness.parse(ready)).toEqual(ready);
    expect(isReadyToSubmit(ready)).toBe(true);
    expect(STUDIO_REQUIRED_READINESS).toEqual(['title', 'category', 'bodyWords']);
    for (const key of STUDIO_REQUIRED_READINESS) {
      expect(isReadyToSubmit({ ...ready, [key]: false }), key).toBe(false);
    }
    expect(STUDIO_READINESS_LABELS.bodyWords).toBe('Body ≥ 150 words');
    expect(STUDIO_READINESS_LABELS.tags).toBe('At least 2 tags');

    const item = {
      id: UUID,
      title: 'Africa’s Cyber Awakening',
      slugPath: '/blog/africa-cyber-awakening',
      category: 'blog',
      excerpt: 'An overview of cyber defence investment across the continent.',
      bodyMd: 'word '.repeat(200),
      tags: ['security', 'africa'],
      featuredImageUrl: 'https://cdn.vunvault.test/blog/africa.png',
      imageAlt: 'Map of Africa with sensor nodes',
      status: 'draft',
      readiness: ready,
      readMinutes: 1,
      updatedAt: '2026-09-24T10:00:00Z',
      reviewerNote: null,
    };
    expect(StudioItem.parse(item)).toEqual(item);
    expect(StudioItem.safeParse({ ...item, status: 'live' }).success).toBe(false);

    expect(
      StudioStatus.parse({
        verified: true,
        verifiedAt: '2026-09-01T09:00:00Z',
        displayName: 'Amara Njoroge',
      }),
    ).toMatchObject({ verified: true });
    expect(StudioStatus.safeParse({ verified: true, displayName: 'x' }).success).toBe(false);

    expect(
      StudioImageUploadRequest.parse({ contentType: 'image/webp', sizeBytes: 1_048_576 }),
    ).toBeDefined();
    expect(
      StudioImageUploadRequest.safeParse({ contentType: 'image/svg+xml', sizeBytes: 1024 }).success,
    ).toBe(false);
    expect(
      StudioImageUploadRequest.safeParse({
        contentType: 'image/gif',
        sizeBytes: 5_242_881,
      }).success,
    ).toBe(false);
    expect(
      StudioImageUploadResponse.parse({
        data: {
          uploadUrl: 'https://r2.example.test/studio/a.png?sig=1',
          objectKey: 'studio/a.png',
          publicUrl: 'https://cdn.vunvault.test/studio/a.png',
          expiresAt: '2026-09-24T12:15:00Z',
        },
      }).data.publicUrl,
    ).toContain('cdn.vunvault.test');
  });
});

/** `ROUTES_C` is `as const`, so widen a match before reading optional fields. */
function findRoute(path: string): RouteDocC | undefined {
  return ROUTES_C.find((route) => route.path === path) as RouteDocC | undefined;
}

describe('ROUTES_C', () => {
  it('documents the zero-day, dashboard, account, studio and onboarding routes', () => {
    const paths = ROUTES_C.map((route) => `${route.method} ${route.path}`);
    for (const expected of [
      'GET /api/v1/admin/advisories',
      'GET /api/v1/admin/advisories/summary',
      'GET /api/v1/admin/advisories/drafts',
      'GET /api/v1/admin/advisories/nvd',
      'POST /api/v1/admin/advisories',
      'PUT /api/v1/admin/advisories/:id',
      'POST /api/v1/admin/advisories/:id/estimate',
      'POST /api/v1/admin/advisories/:id/broadcast',
      'POST /api/v1/admin/advisories/:id/rebroadcast',
      'POST /api/v1/admin/advisories/:id/retract',
      'PATCH /api/v1/admin/advisories/:id/patch-status',
      'GET /api/v1/admin/advisories/:id/broadcasts',
      'GET /api/v1/admin/advisories/:id/broadcasts/stream',
      'GET /api/v1/advisories',
      'POST /api/v1/advisories/:id/acknowledge',
      'GET /api/v1/admin/dashboard/kpis',
      'GET /api/v1/admin/dashboard/revenue',
      'GET /api/v1/admin/dashboard/transactions',
      'GET /api/v1/admin/dashboard/traffic',
      'GET /api/v1/admin/dashboard/endpoints',
      'GET /api/v1/admin/dashboard/nodes',
      'GET /api/v1/admin/dashboard/pipeline',
      'GET /api/v1/admin/dashboard/running-scans',
      'GET /api/v1/admin/dashboard/threat-level',
      'POST /api/v1/nodes/heartbeat',
      'POST /api/v1/account/password',
      'GET /api/v1/account/security',
      'POST /api/v1/account/mfa/totp/enroll',
      'POST /api/v1/account/mfa/totp/verify',
      'DELETE /api/v1/account/mfa/totp',
      'POST /api/v1/account/mfa/webauthn/register/options',
      'POST /api/v1/account/mfa/webauthn/register/verify',
      'DELETE /api/v1/account/mfa/webauthn/:id',
      'POST /api/v1/account/recovery-codes',
      'POST /api/v1/account/recovery-codes/regenerate',
      'GET /api/v1/account/sessions',
      'DELETE /api/v1/account/sessions/:id',
      'POST /api/v1/account/sessions/revoke-others',
      'GET /api/v1/account/settings',
      'PATCH /api/v1/account/settings',
      'POST /api/v1/account/avatar/upload-url',
      'POST /api/v1/account/avatar/confirm',
      'DELETE /api/v1/account/avatar',
      'GET /api/v1/account/notifications',
      'PUT /api/v1/account/notifications',
      'POST /api/v1/account/deactivation-request',
      'GET /api/v1/studio/status',
      'GET /api/v1/studio/submissions',
      'POST /api/v1/studio/drafts',
      'PUT /api/v1/studio/drafts/:id',
      'DELETE /api/v1/studio/drafts/:id',
      'POST /api/v1/studio/drafts/:id/submit',
      'POST /api/v1/studio/images/upload-url',
      'GET /api/v1/onboarding',
      'POST /api/v1/onboarding',
    ]) {
      expect(paths, expected).toContain(expected);
    }
    // 56 since Task 94 documented the broadcast progress SSE relay.
    expect(ROUTES_C).toHaveLength(55);
  });

  it('gates broadcasting on intel:broadcast and never offers a delete', () => {
    const broadcastRoutes: readonly RouteDocC[] = ROUTES_C.filter(
      (route) =>
        route.path.endsWith('/broadcast') ||
        route.path.endsWith('/rebroadcast') ||
        route.path.endsWith('/retract'),
    );
    expect(broadcastRoutes).toHaveLength(3);
    for (const route of broadcastRoutes) {
      expect(route.permission).toBe('intel:broadcast');
    }
    const draftRoutes: readonly RouteDocC[] = ROUTES_C.filter(
      (route) => route.path.startsWith('/api/v1/admin/advisories') && route.method !== 'GET',
    );
    for (const route of draftRoutes) {
      expect(route.method).not.toBe('DELETE');
    }
    expect(findRoute('/api/v1/admin/advisories/summary')?.permission).toBe('intel:read');
    expect(findRoute('/api/v1/admin/advisories')?.permission).toBe('intel:read');
    expect(findRoute('/api/v1/admin/advisories/:id')?.permission).toBe('intel:write');
    expect(findRoute('/api/v1/nodes/heartbeat')?.permission).toBeUndefined();
  });

  it('documents the broadcast guard rails and the recovery-login caveat', () => {
    const broadcast = ROUTES_C.find(
      (route) => route.path === '/api/v1/admin/advisories/:id/broadcast',
    ) as RouteDocC | undefined;
    expect(broadcast?.successStatus).toBe(202);
    expect(broadcast?.errors?.map((error) => error.code)).toEqual([
      'validation_failed',
      'advisory_incomplete',
      'broadcast_in_progress',
    ]);
    const password = findRoute('/api/v1/account/password');
    expect(password?.errors?.map((error) => error.code)).toContain('breached_password');
  });
});
