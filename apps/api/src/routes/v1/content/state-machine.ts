import type { ContentStatus } from '@vunvault/db/enum-values';

/**
 * Content status transitions, as pure rules.
 *
 *   draft → pending_review            (the author submits)
 *   pending_review → in_review        (a reviewer opens it; optional)
 *   pending_review|in_review → approved | changes_requested | rejected
 *   changes_requested → draft         (the author edits, then resubmits)
 *   approved → published | scheduled
 *   scheduled → published             (the worker, at `scheduled_for`)
 *
 * Anything else is `409 invalid_transition`. There is no transition out of
 * `published` and none out of `rejected`: a published item is corrected by a new
 * item, and moderation history is append-only.
 *
 * This module has no database, no HTTP and no clock of its own — `now` is always
 * a parameter — so every edge in the table above can be tested directly.
 */

export type ContentAction =
  'approve' | 'request_changes' | 'reject' | 'publish' | 'schedule' | 'remind_author';

/** The author's own two moves, which are not moderation actions. */
export type AuthorAction = 'submit' | 'edit';

/** The worker's move, which no HTTP route performs. */
export type WorkerAction = 'publish_scheduled';

export type AnyAction = ContentAction | AuthorAction | WorkerAction;

export interface Transition {
  from: readonly ContentStatus[];
  /** `null` for an action that changes no status (`remind_author`). */
  to: ContentStatus | null;
}

export const TRANSITIONS: Record<AnyAction, Transition> = {
  approve: { from: ['pending_review', 'in_review'], to: 'approved' },
  request_changes: { from: ['pending_review', 'in_review'], to: 'changes_requested' },
  reject: { from: ['pending_review', 'in_review'], to: 'rejected' },
  publish: { from: ['approved', 'scheduled'], to: 'published' },
  schedule: { from: ['approved'], to: 'scheduled' },
  remind_author: { from: ['pending_review', 'in_review', 'changes_requested'], to: null },
  submit: { from: ['draft', 'changes_requested'], to: 'pending_review' },
  edit: { from: ['draft', 'changes_requested'], to: null },
  publish_scheduled: { from: ['scheduled'], to: 'published' },
};

/** The statuses the moderation queue shows by default. */
export const DEFAULT_QUEUE_STATUSES: readonly ContentStatus[] = [
  'pending_review',
  'in_review',
  'changes_requested',
];

/** Actions that must carry a substantive note: the author reads it. */
export const NOTE_REQUIRED_ACTIONS: readonly ContentAction[] = ['request_changes', 'reject'];

/** The minimum note length, matching the contract's message. */
export const MIN_NOTE_LENGTH = 10;

export function canTransition(status: ContentStatus, action: AnyAction): boolean {
  return TRANSITIONS[action].from.includes(status);
}

/** The status to write, or `null` when the action changes none. */
export function nextStatus(status: ContentStatus, action: AnyAction): ContentStatus | null {
  if (!canTransition(status, action)) return null;
  return TRANSITIONS[action].to;
}

/** Every status, for exhaustive tests. */
export const ALL_STATUSES: readonly ContentStatus[] = [
  'draft',
  'pending_review',
  'in_review',
  'changes_requested',
  'approved',
  'rejected',
  'scheduled',
  'published',
];

/** Every moderation action, for exhaustive tests. */
export const ALL_ACTIONS: readonly ContentAction[] = [
  'approve',
  'request_changes',
  'reject',
  'publish',
  'schedule',
  'remind_author',
];

export function requiresNote(action: ContentAction): boolean {
  return NOTE_REQUIRED_ACTIONS.includes(action);
}

export function noteIsLongEnough(note: string | undefined): boolean {
  return note !== undefined && note.trim().length >= MIN_NOTE_LENGTH;
}

/** `schedule` needs a timestamp that has not already passed. */
export function scheduleIsInFuture(scheduledFor: string | undefined, now: Date): boolean {
  if (scheduledFor === undefined) return false;
  const when = new Date(scheduledFor).getTime();
  return Number.isFinite(when) && when > now.getTime();
}

/**
 * Which statuses are terminal for the author: no edit, no resubmit.
 * `rejected` is final; a published item is superseded by a new one, never edited.
 */
export function isEditable(status: ContentStatus): boolean {
  return TRANSITIONS.edit.from.includes(status);
}

/** True when a published or scheduled item must not be touched by moderation. */
export function isFinal(status: ContentStatus): boolean {
  return status === 'published' || status === 'rejected';
}
