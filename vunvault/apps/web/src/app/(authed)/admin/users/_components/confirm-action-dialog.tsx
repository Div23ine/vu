'use client';

import type * as React from 'react';
import { useState } from 'react';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from '@vunvault/ui';
import '../_styles/users.css';

/**
 * Confirm-action dialog (Task 79) — the shared confirm surface for the row
 * writes: Suspend (optional reason), Change role (the caller passes the role
 * select as `children`) and the destructive Delete. Radix supplies
 * `role="dialog"`, `aria-modal`, the focus trap and Escape-to-close.
 */

export interface ConfirmActionDialogProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
  /** Renders an optional reason textarea and passes its value to confirm. */
  reasonLabel?: string;
  pending?: boolean;
  children?: React.ReactNode;
  onConfirm(reason?: string): void;
}

export function ConfirmActionDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  destructive = false,
  reasonLabel,
  pending = false,
  children,
  onConfirm,
}: ConfirmActionDialogProps) {
  const [reason, setReason] = useState('');

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setReason('');
        onOpenChange(next);
      }}
    >
      <DialogContent size="sm">
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
        {children}
        {reasonLabel === undefined ? null : (
          <div className="um-field um-reason-field">
            <label className="um-field-label" htmlFor="um-action-reason">
              {reasonLabel}
            </label>
            <textarea
              id="um-action-reason"
              className="um-textarea"
              rows={3}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </div>
        )}
        <div className="um-confirm-actions">
          <DialogClose asChild>
            <button type="button" className="adm-btn adm-btn-ghost">
              Cancel
            </button>
          </DialogClose>
          <button
            type="button"
            className={
              destructive ? 'adm-btn adm-btn-dark um-btn-danger' : 'adm-btn adm-btn-primary'
            }
            disabled={pending}
            onClick={() => {
              onConfirm(reasonLabel === undefined ? undefined : reason.trim() || undefined);
              setReason('');
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
