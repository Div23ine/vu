import { AUDIT_CATEGORIES, AUDIT_SEVERITIES } from '@vunvault/db/enum-values';
import { describe, expect, it } from 'vitest';
import {
  AUDIT_EVENT_TYPES,
  AUDIT_EVENTS,
  eventDefinition,
  isHigherSevLevel,
  isMoreSevere,
  type AuditEventType,
} from './events.js';

describe('AUDIT_EVENTS catalog', () => {
  it('assigns every event a known category and severity', () => {
    for (const eventType of AUDIT_EVENT_TYPES) {
      const definition = eventDefinition(eventType);
      expect(AUDIT_CATEGORIES, `${eventType} category`).toContain(definition.category);
      expect(AUDIT_SEVERITIES, `${eventType} severity`).toContain(definition.severity);
      if (definition.sevLevel !== undefined) {
        expect([1, 2, 3], `${eventType} sevLevel`).toContain(definition.sevLevel);
      }
    }
    expect(AUDIT_EVENT_TYPES.length).toBeGreaterThan(50);
    expect(new Set(AUDIT_EVENT_TYPES).size).toBe(AUDIT_EVENT_TYPES.length);
  });

  it('keeps the security-critical classifications exact', () => {
    const critical: Array<[AuditEventType, 1 | 2]> = [
      ['ADVISORY_BROADCAST', 1],
      ['RELEASE_LOCK_VIOLATION', 2],
      ['PERMISSION_CHANGED', 2],
      ['ACCOUNT_SUSPENDED', 2],
      ['ACCOUNT_DELETED', 2],
      ['MFA_DISABLED', 2],
      ['DEACTIVATION_REQUESTED', 2],
      ['ADVISORY_RETRACTED', 2],
    ];
    for (const [eventType, sevLevel] of critical) {
      expect(eventDefinition(eventType).severity, eventType).toBe(
        eventType === 'RELEASE_LOCK_VIOLATION' || eventType === 'ADVISORY_BROADCAST'
          ? 'critical'
          : 'warning',
      );
      expect(eventDefinition(eventType).sevLevel, eventType).toBe(sevLevel);
    }
    // Exactly one event pages the incident commander.
    expect(
      AUDIT_EVENT_TYPES.filter((eventType) => eventDefinition(eventType).sevLevel === 1),
    ).toEqual(['ADVISORY_BROADCAST']);
  });

  it('groups events into the five database categories', () => {
    const byCategory = new Map<string, number>();
    for (const eventType of AUDIT_EVENT_TYPES) {
      const category = eventDefinition(eventType).category;
      byCategory.set(category, (byCategory.get(category) ?? 0) + 1);
    }
    expect([...byCategory.keys()].sort()).toEqual([...AUDIT_CATEGORIES].sort());
    // 14 since the magic-link work order added MAGIC_LINK_ISSUED,
    // MAGIC_LINK_VERIFIED, SIGNUP_INVITE_SENT and MFA_SETUP_BLOCKED.
    expect(byCategory.get('authentication')).toBe(14);
    // 5 since Phase 4 added AUTH_BOT_REJECTED to the security events.
    expect(byCategory.get('security_event')).toBe(5);
    // 7 since Task 95 added SCAN_CONTROL_SENT to the scan lifecycle.
    expect(byCategory.get('scan_completion')).toBe(7);
    expect(byCategory.get('report_release')).toBe(2);
    expect(byCategory.get('system')).toBe(5);
  });

  it('classifies the store and newsletter events added by Task 40c', () => {
    // A licence being granted is a good thing that happened; the rest are records
    // of an intention or an action, so they are `info`.
    expect(eventDefinition('PRODUCT_PURCHASE_STARTED')).toEqual({
      category: 'administrative',
      severity: 'info',
    });
    expect(eventDefinition('PRODUCT_DOWNLOADED')).toEqual({
      category: 'administrative',
      severity: 'info',
    });
    expect(eventDefinition('NEWSLETTER_SUBSCRIBED')).toEqual({
      category: 'administrative',
      severity: 'info',
    });
    expect(eventDefinition('NEWSLETTER_UNSUBSCRIBED')).toEqual({
      category: 'administrative',
      severity: 'info',
    });
    expect(eventDefinition('ENTITLEMENT_GRANTED')).toEqual({
      category: 'administrative',
      severity: 'ok',
    });
    // None of them escalates: selling a licence is not an incident.
    for (const eventType of [
      'PRODUCT_PURCHASE_STARTED',
      'PRODUCT_DOWNLOADED',
      'NEWSLETTER_SUBSCRIBED',
      'NEWSLETTER_UNSUBSCRIBED',
      'ENTITLEMENT_GRANTED',
    ] as AuditEventType[]) {
      expect(eventDefinition(eventType).sevLevel, eventType).toBeUndefined();
    }
  });

  it('classifies the contact-triage event added by Task 40f', () => {
    // Triaging an inbox message is a routine administrative record: it neither
    // escalates nor signals trouble — it is the opposite, trouble being handled.
    expect(eventDefinition('CONTACT_TRIAGED')).toEqual({
      category: 'administrative',
      severity: 'info',
    });
    expect(eventDefinition('CONTACT_TRIAGED').sevLevel).toBeUndefined();
  });

  it('classifies the scan control event added by Task 95', () => {
    // Forwarding abort/pause/resume/kill is routine operation on the scan
    // terminal, so it belongs to the scan lifecycle at informational severity —
    // the consequences (SCAN_CANCELLED, SCAN_HELD) carry their own weight.
    expect(eventDefinition('SCAN_CONTROL_SENT')).toEqual({
      category: 'scan_completion',
      severity: 'info',
    });
    expect(eventDefinition('SCAN_CONTROL_SENT').sevLevel).toBeUndefined();
  });

  it('covers the events the fixed audit fixtures use', () => {
    for (const eventType of [
      'AUTH_SUCCESS',
      'AUTH_FAILURE',
      'AUTH_RATE_LIMIT',
      'SCAN_COMPLETE',
      'REPORT_RELEASED',
      'USER_PROVISIONED',
      'PERMISSION_CHANGED',
      'ADVISORY_BROADCAST',
      'KEY_ROTATION',
      'CHAIN_VERIFIED',
      'CHAIN_GENESIS',
      'LOG_BACKUP',
    ] as AuditEventType[]) {
      expect(AUDIT_EVENT_TYPES, eventType).toContain(eventType);
    }
    expect(AUDIT_EVENTS.AUTH_SUCCESS).toEqual({ category: 'authentication', severity: 'ok' });
    expect(AUDIT_EVENTS.CHAIN_GENESIS).toEqual({ category: 'system', severity: 'info' });
    expect(eventDefinition('ADVISORY_BROADCAST')).toEqual({
      category: 'administrative',
      severity: 'critical',
      sevLevel: 1,
    });
  });

  it('orders severity so an override can only raise it', () => {
    expect(isMoreSevere('critical', 'info')).toBe(true);
    expect(isMoreSevere('info', 'critical')).toBe(false);
    expect(isMoreSevere('warning', 'warning')).toBe(false);
    expect(isMoreSevere('ok', 'info')).toBe(false);
    expect(isHigherSevLevel(1, 2)).toBe(true);
    expect(isHigherSevLevel(3, 2)).toBe(false);
    expect(isHigherSevLevel(2, 2)).toBe(false);
  });
});
