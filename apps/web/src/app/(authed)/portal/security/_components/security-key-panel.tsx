'use client';

import { useState } from 'react';
import { KeyRound, Trash2 } from 'lucide-react';
import type { WebauthnKey } from '@vunvault/contracts';
import { formatLongDate } from '@vunvault/lib';
import { toast } from '@vunvault/ui';
import {
  useRemoveWebauthnKey,
  useWebauthnRegisterOptions,
  useWebauthnRegisterVerify,
} from '../_hooks/use-security';
import { isWebAuthnCancel, registerSecurityKey } from '../_lib/webauthn-register';

/**
 * Hardware security key panel (Task 67) — `Register Key` runs the WebAuthn
 * registration ceremony: `POST …/register/options` → `navigator.credentials
 * .create` (the `_lib/webauthn-register.ts` bridge converts JSON ↔
 * ArrayBuffer) → `POST …/register/verify { credential }`. Registered keys are
 * listed with their device name and added date, each removable
 * (`DELETE …/webauthn/:id`). A user cancel keeps the panel usable with the
 * verbatim cancellation sentence.
 */

export interface SecurityKeyPanelProps {
  keys: WebauthnKey[];
  onChanged: () => void;
}

export function SecurityKeyPanel({ keys, onChanged }: SecurityKeyPanelProps) {
  const options = useWebauthnRegisterOptions();
  const verify = useWebauthnRegisterVerify();
  const remove = useRemoveWebauthnKey();
  const [error, setError] = useState('');
  const [removingId, setRemovingId] = useState<string | null>(null);

  const busy = options.isPending || verify.isPending;

  const register = async () => {
    setError('');
    try {
      const creationOptions = await options.mutateAsync();
      const credential = await registerSecurityKey(creationOptions);
      await verify.mutateAsync({ credential });
      toast({ kind: 'ok', title: 'Hardware security key registered' });
      onChanged();
    } catch (registerError) {
      if (isWebAuthnCancel(registerError)) {
        setError('Security key registration was cancelled.');
        return;
      }
      setError('Security key registration failed. Please try again.');
    }
  };

  const removeKey = async (id: string) => {
    setRemovingId(id);
    setError('');
    try {
      await remove.mutateAsync(id);
      toast({ kind: 'ok', title: 'Hardware key removed' });
      onChanged();
    } catch {
      setError('Could not remove the key. Please try again.');
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <div className="vpm-2fa-panel">
      <div className="vpm-2fa-head">
        <div>
          <h3 className="vpm-2fa-title">Hardware Security Key (FIDO2 / WebAuthn)</h3>
        </div>
        <div className="vpm-2fa-controls">
          <button
            type="button"
            className="vpm-btn vpm-btn--primary vpm-btn--sm"
            disabled={busy}
            aria-busy={busy}
            onClick={() => void register()}
          >
            {busy ? <span className="vpm-btn-spinner" aria-hidden="true" /> : null}
            <KeyRound size={14} aria-hidden="true" />
            <span>Register Key</span>
          </button>
        </div>
      </div>
      <p className="vpm-2fa-sub">
        YubiKey, Google Titan, Feitian and any FIDO2-certified key. Phishing-resistant — the
        strongest factor available today.
      </p>

      {error !== '' ? (
        <p className="vpm-error" role="alert" aria-live="polite">
          {error}
        </p>
      ) : null}

      {keys.length === 0 ? (
        <p className="vpm-empty">No keys registered</p>
      ) : (
        <ul className="vpm-key-list">
          {keys.map((key) => (
            <li key={key.id} className="vpm-key-row">
              <span>
                <span className="vpm-key-name">{key.deviceName ?? 'Security key'}</span>
                <span className="vpm-key-meta">
                  Added {formatLongDate(new Date(key.createdAt))}
                </span>
              </span>
              <button
                type="button"
                className="vpm-btn vpm-btn--ghost vpm-btn--sm"
                disabled={removingId === key.id}
                onClick={() => void removeKey(key.id)}
              >
                <Trash2 size={13} aria-hidden="true" />
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
