'use client';

import { cn } from '@vunvault/lib';
import type { SaveState } from '../../_hooks/use-draft';
import '../../_styles/editor.css';

/**
 * Save indicator — the actionbar's dot + label. The STORAGE CHANGE
 * replaced the design's `Working copy saved locally` (localStorage copy)
 * with the server-draft states: `Unsaved changes` → `Saving…` → `Saved`.
 */

const LABELS: Record<SaveState, string> = {
  saved: 'Saved',
  dirty: 'Unsaved changes',
  saving: 'Saving…',
  error: 'Unsaved changes',
};

export function SaveIndicator({ state }: { state: SaveState }) {
  return (
    <div className="vbg-actionbar-note" role="status" aria-live="polite">
      <span
        className={cn('vbg-save-dot', state === 'saved' ? 'is-saved' : 'is-dirty')}
        aria-hidden="true"
      />
      <span>{LABELS[state]}</span>
    </div>
  );
}
