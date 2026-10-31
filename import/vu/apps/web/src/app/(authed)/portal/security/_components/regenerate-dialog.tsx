'use client';

import { X } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@vunvault/ui';

/**
 * Regenerate recovery keys confirmation — the design's
 * irreversible-action dialog on the an earlier iteration `Dialog` primitive (Radix supplies
 * `role="dialog"`, `aria-modal`, the focus trap and Escape-to-close), wearing
 * the `vpm-modal-*` classes reproduced in `security.css`. All copy verbatim.
 */

export interface RegenerateDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  pending?: boolean;
}

export function RegenerateDialog({
  open,
  onClose,
  onConfirm,
  pending = false,
}: RegenerateDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent size="sm" className="vpm-modal-card" id="regenerateKeysModal" hideClose>
        <div className="vpm-modal-head">
          <div>
            <span className="vpm-eyebrow">Irreversible action</span>
            <DialogTitle className="vpm-modal-title" id="vpm-regen-title">
              Regenerate Recovery Keys?
            </DialogTitle>
            <DialogDescription className="vpm-modal-text">
              Your existing 10 recovery codes will be permanently invalidated the moment new ones
              are created. Any printed copies you hold will stop working.
            </DialogDescription>
          </div>
          <button
            type="button"
            className="vpm-modal-close"
            aria-label="Close dialog"
            onClick={onClose}
          >
            <X size={17} aria-hidden="true" />
          </button>
        </div>
        <div className="vpm-modal-actions">
          <p className="vpm-modal-note">
            Confirm only if you have lost your codes or suspect they may have leaked.
          </p>
          <button type="button" className="vpm-btn vpm-btn--ghost" onClick={onClose}>
            Keep Existing Codes
          </button>
          <button
            type="button"
            className="vpm-btn vpm-btn--danger"
            id="vpm-regen-confirm"
            disabled={pending}
            aria-busy={pending}
            onClick={onConfirm}
          >
            {pending ? <span className="vpm-btn-spinner" aria-hidden="true" /> : null}
            <span>Yes, Regenerate</span>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
