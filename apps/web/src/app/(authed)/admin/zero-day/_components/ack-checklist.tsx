'use client';

import { ListChecks } from 'lucide-react';
import type { BroadcastAck } from '@vunvault/contracts';
import { BROADCAST_ACK_LABELS } from '@vunvault/contracts';

/**
 * Pre-Broadcast Acknowledgement — the five gates that unlock an
 * emergency broadcast, titles and descriptions verbatim from the contract's
 * `BROADCAST_ACK_LABELS`.
 *
 * The items are written out statically rather than mapped over the record (the
 * `gate-checklist.tsx` precedent): `jsx-a11y/label-has-associated-control`
 * verifies a label's accessible text statically, which dynamic `{expression}`
 * children defeat. `broadcast.test.tsx` asserts these literals against the
 * contract map so they cannot drift. The key ORDER for the dialog's counting
 * logic comes from the contract record itself.
 */

export type BroadcastAckKey = keyof BroadcastAck;

export const ACK_KEYS = Object.keys(BROADCAST_ACK_LABELS) as BroadcastAckKey[];

export const EMPTY_ACK: BroadcastAck = {
  severityCorrect: false,
  scopeComplete: false,
  contentSafe: false,
  remediationActionable: false,
  authorised: false,
};

export interface AckChecklistProps {
  ack: BroadcastAck;
  disabled?: boolean;
  onToggle(key: BroadcastAckKey): void;
}

export function AckChecklist({ ack, disabled = false, onToggle }: AckChecklistProps) {
  return (
    <div>
      <div className="zd-modal-section-title">
        <ListChecks size={13} aria-hidden="true" />
        Pre-Broadcast Acknowledgement
      </div>
      <ul className="zd-acks">
        <li className="zd-ack">
          <label className="zd-ack-label">
            <input
              type="checkbox"
              className="zd-ack-input"
              aria-label="Severity level is correct"
              checked={ack.severityCorrect}
              disabled={disabled}
              onChange={() => onToggle('severityCorrect')}
            />
            <span className="zd-ack-text">
              <span className="zd-ack-title">Severity level is correct</span>
              <span className="zd-ack-desc">
                The assigned severity matches the CVSS base score and observed exploitation status.
              </span>
            </span>
          </label>
        </li>
        <li className="zd-ack">
          <label className="zd-ack-label">
            <input
              type="checkbox"
              className="zd-ack-input"
              aria-label="Affected scope is complete"
              checked={ack.scopeComplete}
              disabled={disabled}
              onChange={() => onToggle('scopeComplete')}
            />
            <span className="zd-ack-text">
              <span className="zd-ack-title">Affected scope is complete</span>
              <span className="zd-ack-desc">
                Every affected product, version range and platform is listed — no over- or
                under-matching.
              </span>
            </span>
          </label>
        </li>
        <li className="zd-ack">
          <label className="zd-ack-label">
            <input
              type="checkbox"
              className="zd-ack-input"
              aria-label="Content is safe for client distribution"
              checked={ack.contentSafe}
              disabled={disabled}
              onChange={() => onToggle('contentSafe')}
            />
            <span className="zd-ack-text">
              <span className="zd-ack-title">Content is safe for client distribution</span>
              <span className="zd-ack-desc">
                No unredacted exploit code, internal credentials or third-party confidential data is
                included.
              </span>
            </span>
          </label>
        </li>
        <li className="zd-ack">
          <label className="zd-ack-label">
            <input
              type="checkbox"
              className="zd-ack-input"
              aria-label="Remediation guidance is actionable"
              checked={ack.remediationActionable}
              disabled={disabled}
              onChange={() => onToggle('remediationActionable')}
            />
            <span className="zd-ack-text">
              <span className="zd-ack-title">Remediation guidance is actionable</span>
              <span className="zd-ack-desc">
                Immediate mitigations and the permanent fix are both documented for clients.
              </span>
            </span>
          </label>
        </li>
        <li className="zd-ack">
          <label className="zd-ack-label">
            <input
              type="checkbox"
              className="zd-ack-input"
              aria-label="I am authorised to issue emergency broadcasts"
              checked={ack.authorised}
              disabled={disabled}
              onChange={() => onToggle('authorised')}
            />
            <span className="zd-ack-text">
              <span className="zd-ack-title">I am authorised to issue emergency broadcasts</span>
              <span className="zd-ack-desc">
                This action is recorded against your administrator identity and cannot be revoked.
              </span>
            </span>
          </label>
        </li>
      </ul>
    </div>
  );
}
