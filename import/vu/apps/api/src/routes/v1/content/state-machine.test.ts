import { describe, expect, it } from 'vitest';
import type { ContentStatus } from '@vunvault/db/enum-values';
import {
  ALL_ACTIONS,
  ALL_STATUSES,
  canTransition,
  DEFAULT_QUEUE_STATUSES,
  isEditable,
  isFinal,
  nextStatus,
  noteIsLongEnough,
  requiresNote,
  scheduleIsInFuture,
  TRANSITIONS,
  type AnyAction,
} from './state-machine.js';

/**
 * The transition table, exhaustively: every status × every action, with the
 * expected result written out longhand. This is the whole editorial workflow in
 * one grid, so a change to any cell is a change someone has to make on purpose.
 */

/** status → action → expected next status (`null` = refused, `'same'` = no change). */
const EXPECTED: Record<ContentStatus, Partial<Record<AnyAction, ContentStatus | null | 'same'>>> = {
  draft: { submit: 'pending_review', edit: 'same' },
  pending_review: {
    approve: 'approved',
    request_changes: 'changes_requested',
    reject: 'rejected',
    remind_author: 'same',
  },
  in_review: {
    approve: 'approved',
    request_changes: 'changes_requested',
    reject: 'rejected',
    remind_author: 'same',
  },
  changes_requested: { submit: 'pending_review', edit: 'same', remind_author: 'same' },
  approved: { publish: 'published', schedule: 'scheduled' },
  rejected: {},
  scheduled: { publish: 'published', publish_scheduled: 'published' },
  published: {},
};

const EVERY_ACTION: AnyAction[] = [...ALL_ACTIONS, 'submit', 'edit', 'publish_scheduled'];

describe('the transition table', () => {
  for (const status of ALL_STATUSES) {
    for (const action of EVERY_ACTION) {
      const expected = EXPECTED[status][action];
      const allowed = expected !== undefined;
      it(`${status} + ${action} → ${allowed ? String(expected) : '409 invalid_transition'}`, () => {
        expect(canTransition(status, action)).toBe(allowed);
        if (!allowed) {
          expect(nextStatus(status, action)).toBeNull();
          return;
        }
        if (expected === 'same') {
          expect(TRANSITIONS[action].to).toBeNull();
          return;
        }
        expect(nextStatus(status, action)).toBe(expected);
      });
    }
  }
});

describe('the rules around the table', () => {
  it('has no way out of published or rejected', () => {
    for (const status of ['published', 'rejected'] as ContentStatus[]) {
      expect(isFinal(status)).toBe(true);
      for (const action of EVERY_ACTION) {
        expect(canTransition(status, action), `${status}/${action}`).toBe(false);
      }
    }
  });

  it('never lets a moderation action un-publish or un-decide', () => {
    // No action anywhere in the table targets a status that is "less decided".
    const backwards: Array<[ContentStatus, ContentStatus]> = [
      ['published', 'approved'],
      ['published', 'draft'],
      ['approved', 'pending_review'],
      ['rejected', 'draft'],
    ];
    for (const [from, to] of backwards) {
      for (const action of EVERY_ACTION) {
        expect(
          canTransition(from, action) && nextStatus(from, action) === to,
          `${from} → ${to}`,
        ).toBe(false);
      }
    }
  });

  it('edits and resubmits only while a draft or sent back for changes', () => {
    expect(isEditable('draft')).toBe(true);
    expect(isEditable('changes_requested')).toBe(true);
    for (const status of [
      'pending_review',
      'in_review',
      'approved',
      'rejected',
      'scheduled',
      'published',
    ] as ContentStatus[]) {
      expect(isEditable(status), status).toBe(false);
    }
  });

  it('queues the three statuses that still need a decision', () => {
    expect(DEFAULT_QUEUE_STATUSES).toEqual(['pending_review', 'in_review', 'changes_requested']);
  });

  it('requires a substantive note for the two actions an author reads', () => {
    expect(requiresNote('request_changes')).toBe(true);
    expect(requiresNote('reject')).toBe(true);
    expect(requiresNote('approve')).toBe(false);
    expect(requiresNote('publish')).toBe(false);
    expect(requiresNote('schedule')).toBe(false);
    expect(requiresNote('remind_author')).toBe(false);

    expect(noteIsLongEnough('nine char')).toBe(false);
    expect(noteIsLongEnough('ten chars!')).toBe(true);
    expect(noteIsLongEnough('           ')).toBe(false);
    expect(noteIsLongEnough(undefined)).toBe(false);
  });

  it('schedules only into the future', () => {
    const now = new Date('2026-10-06T12:00:00.000Z');
    expect(scheduleIsInFuture('2026-10-07T09:00:00.000Z', now)).toBe(true);
    expect(scheduleIsInFuture('2026-10-06T11:59:59.000Z', now)).toBe(false);
    expect(scheduleIsInFuture('2026-10-06T12:00:00.000Z', now)).toBe(false);
    expect(scheduleIsInFuture(undefined, now)).toBe(false);
    expect(scheduleIsInFuture('not-a-date', now)).toBe(false);
  });
});
