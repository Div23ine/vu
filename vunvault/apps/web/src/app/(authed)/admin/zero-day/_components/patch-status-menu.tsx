'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import type { Advisory, AdvisoryPatchStatus } from '@vunvault/contracts';
import { PATCH_STATUS_LABELS } from '@vunvault/contracts';
import { cn, isApiError } from '@vunvault/lib';
import { toast } from '@vunvault/ui';
import { useUpdatePatchStatus } from '../_hooks/use-advisories-admin';

/**
 * Patch-status inline menu (Task 81) — the `Status` cell of the published
 * table. For a reader it is the plain `adm-badge`-toned chip from the
 * reference; for an analyst holding `intel:write` it opens a three-item menu
 * that PATCHes `…/patch-status`.
 *
 * The menu is a real `menu`/`menuitemradio` popup rather than a `<select>`:
 * the reference renders the current value as a coloured pill, and a select
 * cannot carry that styling. Escape closes it and returns focus to the
 * trigger, and a click outside dismisses it — the same contract the design
 * rules require of dialogs, applied to the lighter popup case.
 */

const STATUSES: readonly AdvisoryPatchStatus[] = [
  'unpatched',
  'patch_in_progress',
  'patched',
] as const;

export interface PatchStatusMenuProps {
  advisory: Advisory;
  /** `intel:write` — without it the chip is read-only. */
  canWrite: boolean;
}

export function PatchStatusMenu({ advisory, canWrite }: PatchStatusMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const patchStatus = useUpdatePatchStatus();
  const current = advisory.patchStatus;

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent): void => {
      if (rootRef.current?.contains(event.target as Node) === true) return;
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  if (!canWrite) {
    return (
      <span className={cn('adm-badge', `adm-badge--${current === 'patched' ? 'ok' : current === 'patch_in_progress' ? 'warn' : 'crit'}`)}>
        {PATCH_STATUS_LABELS[current]}
      </span>
    );
  }

  const choose = (next: AdvisoryPatchStatus): void => {
    setOpen(false);
    if (next === current) return;
    patchStatus.mutate(
      { id: advisory.id, patchStatus: next },
      {
        onSuccess: () =>
          toast({
            kind: 'ok',
            title: 'Patch status updated',
            message: `${advisory.cveId} is now ${PATCH_STATUS_LABELS[next]}.`,
          }),
        onError: (error) =>
          toast({
            kind: 'crit',
            title: 'Could not update patch status',
            message: isApiError(error) ? error.message : 'Please try again.',
          }),
      },
    );
  };

  return (
    <div className="zd-patch" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className={cn('zd-patch-trigger', `zd-patch-trigger--${current}`)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Patch status for ${advisory.cveId}: ${PATCH_STATUS_LABELS[current]}`}
        disabled={patchStatus.isPending}
        onClick={() => setOpen((value) => !value)}
      >
        {PATCH_STATUS_LABELS[current]}
        <ChevronDown size={12} aria-hidden="true" />
      </button>
      {open ? (
        <div className="zd-patch-menu" role="menu" aria-label="Patch status">
          {STATUSES.map((status) => (
            <button
              key={status}
              type="button"
              role="menuitemradio"
              aria-checked={status === current}
              onClick={() => choose(status)}
            >
              {PATCH_STATUS_LABELS[status]}
              {status === current ? <Check size={13} aria-hidden="true" /> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
