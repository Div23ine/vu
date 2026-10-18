'use client';

import { Eye, Send } from 'lucide-react';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from '@vunvault/ui';
// an earlier iteration's closed markdown renderer — imported from the marketing blog per
// the an earlier iteration spec ("import from the marketing blog components"); it is a
// named export there, so no copy into src/components is needed.
import { SafeMarkdown } from '../../../../../(marketing)/blog/_components/safe-markdown';
import '../../_styles/editor.css';

/**
 * Preview dialog — the reader preview rendered from the current
 * draft with `SafeMarkdown` (never `dangerouslySetInnerHTML`). The
 * design's `Publish Post` footer button becomes `Submit for Review`,
 * gated on the required readiness items. Radix (through the shared `Dialog`)
 * supplies `role="dialog"`, `aria-modal`, the focus trap and Escape-to-close.
 */

interface PreviewDialogProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  title: string;
  slug: string;
  bodyMd: string;
  canSubmit: boolean;
  submitting: boolean;
  onSubmit(): void;
}

export function PreviewDialog({
  open,
  onOpenChange,
  title,
  slug,
  bodyMd,
  canSubmit,
  submitting,
  onSubmit,
}: PreviewDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg" className="vbe-preview">
        <div className="vbg-modal-head">
          <div>
            <span className="vbg-modal-eyebrow">
              <Eye size={13} aria-hidden="true" />
              Reader Preview
            </span>
            <DialogTitle className="vbg-modal-title">
              {title.trim() === '' ? 'Untitled article' : title}
            </DialogTitle>
            <p className="vbg-modal-sub">/blog/{slug}</p>
          </div>
        </div>
        <DialogDescription className="sr-only">
          A local reader preview of the current draft.
        </DialogDescription>
        <div className="vbg-modal-body">
          <SafeMarkdown source={bodyMd} />
        </div>
        <div className="vbg-modal-foot">
          <span className="vbg-modal-foot-note">
            This is a local preview rendered from your device only. Nothing has been published or
            submitted yet.
          </span>
          <div className="vbg-modal-foot-actions">
            <DialogClose asChild>
              <button type="button" className="vbg-btn vbg-btn--ghost">
                Close
              </button>
            </DialogClose>
            <button
              type="button"
              className="vbg-btn vbg-btn--primary"
              disabled={!canSubmit || submitting}
              onClick={onSubmit}
            >
              <Send size={15} aria-hidden="true" />
              <span>Submit for Review</span>
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
