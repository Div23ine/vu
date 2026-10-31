'use client';

import { Copy, FileText, Link2, ScrollText, X } from 'lucide-react';
import type { AuditEntryView } from '@vunvault/contracts';
import { AUDIT_CATEGORY_LABELS } from '@vunvault/contracts';
import { formatUtcStamp } from '@vunvault/lib';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  toast,
} from '@vunvault/ui';
import { SeverityChip } from './severity-chip';

/**
 * Audit event detail dialog — the read-only record behind one row.
 *
 * The header carries the category and severity chips, the chain `seq` and the
 * event type; the body carries the timestamp, actor, subject, IP, the full
 * message, and the two digests with a `Copy` button each, closed by the
 * chain-link line `Linked to entry #<seq-1>`.
 *
 * DELIBERATE OMISSIONS (the spec is explicit): no raw encrypted payload, no
 * signature line and no key id. The API never returns them, so the reference's
 * `Raw Encrypted Payload` section, its `Signature: AES-256-GCM · HMAC-SHA256`
 * row and the footer's `Copy Payload` button are not rendered — showing them
 * would imply data the trail does not expose. The per-hash `Copy` buttons keep
 * the reference's toast copy.
 *
 * Clipboard failure is a real state (permissions policy, insecure context), so
 * it has its own verbatim toast rather than failing silently.
 */

async function copyValue(value: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(value);
    toast({ kind: 'ok', title: 'Payload copied', message: 'Hash copied to clipboard.' });
  } catch {
    toast({
      kind: 'warn',
      title: 'Clipboard blocked',
      message: 'Select and copy the value manually.',
    });
  }
}

export interface EventDialogProps {
  entry: AuditEntryView | null;
  open: boolean;
  onOpenChange(open: boolean): void;
}

export function EventDialog({ entry, open, onOpenChange }: EventDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size="md"
        className="al-modal-content"
        hideClose
        aria-labelledby="al-event-title"
      >
        {entry === null ? null : (
          <>
            <div className="al-modal-head">
              <div>
                <span className="al-modal-eyebrow">
                  <ScrollText size={13} aria-hidden="true" />
                  Audit Event Detail
                </span>
                <DialogTitle className="al-modal-title" id="al-event-title">
                  {entry.eventType}
                </DialogTitle>
                <DialogDescription className="al-modal-sub">
                  Event ID: <span id="al-modal-event-id">{entry.id}</span>
                </DialogDescription>
                <div className="al-modal-chips">
                  <span className="al-type-chip">{AUDIT_CATEGORY_LABELS[entry.category]}</span>
                  <SeverityChip severity={entry.severity} sevLevel={entry.sevLevel} />
                  <span className="al-seq-chip">#{entry.seq}</span>
                </div>
              </div>
              <DialogClose asChild>
                <button type="button" className="al-modal-close" aria-label="Close event detail">
                  <X size={16} aria-hidden="true" />
                </button>
              </DialogClose>
            </div>

            <div className="al-modal-body">
              <div>
                <div className="al-modal-section-title">
                  <FileText size={13} aria-hidden="true" />
                  Event Summary
                </div>
                <div className="al-modal-summary">
                  <div className="al-modal-summary-item">
                    <span className="al-modal-summary-label">Timestamp (UTC)</span>
                    <span className="al-modal-summary-value" id="al-modal-ts">
                      {formatUtcStamp(new Date(entry.createdAt))}
                    </span>
                  </div>
                  <div className="al-modal-summary-item">
                    <span className="al-modal-summary-label">Event Type</span>
                    <span className="al-modal-summary-value">
                      {AUDIT_CATEGORY_LABELS[entry.category]}
                    </span>
                  </div>
                  <div className="al-modal-summary-item">
                    <span className="al-modal-summary-label">Actor</span>
                    <span className="al-modal-summary-value">{entry.actorLabel}</span>
                  </div>
                  <div className="al-modal-summary-item">
                    <span className="al-modal-summary-label">Severity</span>
                    <span className="al-modal-summary-value">
                      {entry.sevLevel === null
                        ? entry.severity
                        : `${entry.severity} · SEV-${entry.sevLevel}`}
                    </span>
                  </div>
                  <div className="al-modal-summary-item">
                    <span className="al-modal-summary-label">Event Code</span>
                    <span className="al-modal-summary-value">{entry.eventType}</span>
                  </div>
                  <div className="al-modal-summary-item">
                    <span className="al-modal-summary-label">Subject</span>
                    <span className="al-modal-summary-value">{entry.subject ?? '—'}</span>
                  </div>
                  <div className="al-modal-summary-item">
                    <span className="al-modal-summary-label">Source IP</span>
                    <span className="al-modal-summary-value">{entry.ip ?? '—'}</span>
                  </div>
                </div>
              </div>

              <div>
                <div className="al-modal-section-title">
                  <FileText size={13} aria-hidden="true" />
                  Full Message
                </div>
                <p className="al-modal-message">{entry.message}</p>
              </div>

              <div>
                <div className="al-modal-section-title">
                  <Link2 size={13} aria-hidden="true" />
                  Hash Chain Verification
                </div>
                <p className="al-modal-verified">
                  Chain verified — entry is authentic and unmodified
                </p>
                <dl className="al-hashes">
                  <div className="al-hash-row">
                    <dt>Entry hash:</dt>
                    <dd>
                      <code className="al-hash-value">{entry.hash}</code>
                      <button
                        type="button"
                        className="al-copy"
                        aria-label={`Copy entry hash for event ${entry.seq}`}
                        onClick={() => void copyValue(entry.hash)}
                      >
                        <Copy size={12} aria-hidden="true" />
                        Copy
                      </button>
                    </dd>
                  </div>
                  <div className="al-hash-row">
                    <dt>Previous hash:</dt>
                    <dd>
                      <code className="al-hash-value">{entry.prevHash}</code>
                      <button
                        type="button"
                        className="al-copy"
                        aria-label={`Copy previous hash for event ${entry.seq}`}
                        onClick={() => void copyValue(entry.prevHash)}
                      >
                        <Copy size={12} aria-hidden="true" />
                        Copy
                      </button>
                    </dd>
                  </div>
                </dl>
                <p className="al-chain-link">Linked to entry #{entry.seq - 1}</p>
              </div>
            </div>

            <div className="al-modal-foot">
              <span className="al-modal-foot-note">
                Audit entries are append-only. This record cannot be edited or deleted within the
                7-year retention window.
              </span>
              <div className="al-modal-foot-actions">
                <DialogClose asChild>
                  <button type="button" className="adm-btn adm-btn-primary">
                    Close
                  </button>
                </DialogClose>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
