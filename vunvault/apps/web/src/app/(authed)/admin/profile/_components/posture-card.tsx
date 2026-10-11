'use client';

import { Check, Circle, ShieldCheck } from 'lucide-react';
import type { SecurityPosture } from '@vunvault/contracts';
import { cn } from '@vunvault/lib';
import { Skeleton } from '@vunvault/ui';

/**
 * Security posture card (Task 83d) — the score meter and the checklist behind
 * it, straight from `GET /account/security`.
 *
 * Nothing here is computed: the contract already carries `score`, the
 * `Strong|Fair|Weak posture` label and the per-item `done` flags, and its own
 * `postureScore()` documents the formula. Re-deriving the score in the view is
 * how a UI ends up disagreeing with the API, so the card only renders.
 *
 * The ✓ / ○ markers are the reference's own; each is paired with a visually
 * hidden `Complete` / `Outstanding` word so a screen reader hears the state
 * rather than a glyph.
 */

export interface PostureCardProps {
  posture: SecurityPosture | null;
  isLoading: boolean;
}

export function PostureCard({ posture, isLoading }: PostureCardProps) {
  if (isLoading || posture === null) {
    return (
      <div className="ps-posture" aria-busy="true">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-full" />
      </div>
    );
  }

  return (
    <div className="ps-posture">
      <div className="ps-posture-head">
        <span className="ps-posture-label">
          <ShieldCheck size={13} aria-hidden="true" />
          {posture.label}
        </span>
        <span className="ps-posture-score">
          {posture.score}
          <small>%</small>
        </span>
      </div>

      <div
        className="ps-posture-meter"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={posture.score}
        aria-label="Security posture score"
      >
        <span className="ps-posture-fill" style={{ width: `${posture.score}%` }} />
      </div>

      <p className="ps-posture-count">
        {posture.completed} of {posture.total} controls in place
      </p>

      <ul className="ps-posture-items">
        {posture.items.map((item) => (
          <li
            key={item.id}
            className={cn('ps-posture-item', item.done ? 'is-done' : 'is-todo')}
          >
            {item.done ? (
              <Check size={13} aria-hidden="true" />
            ) : (
              <Circle size={13} aria-hidden="true" />
            )}
            <span>{item.label}</span>
            <span className="sr-only">{item.done ? 'Complete' : 'Outstanding'}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
