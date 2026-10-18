'use client';

import { ShieldCheck } from 'lucide-react';
import { Skeleton } from '@vunvault/ui';
import { useSecurityInvalidator, useSecurityStatus } from '../_hooks/use-security';
import { SecurityKeyPanel } from './security-key-panel';
import { TotpPanel } from './totp-panel';

/**
 * Two-factor card — `GET /account/security` supplies the MFA
 * status; the two panels (authenticator app, hardware keys) own their
 * ceremonies and call `onChanged` to refetch. The security POSTURE also
 * arrives on this response but has no UI on this page (the profile security
 * tab is an earlier iteration) — it is simply not rendered here.
 */

export function TwoFactorCard() {
  const status = useSecurityStatus();
  const invalidate = useSecurityInvalidator();

  return (
    <div className="vpm-card">
      <div className="vpm-card-head">
        <span className="vpm-card-icon" aria-hidden="true">
          <ShieldCheck size={20} />
        </span>
        <div>
          <h2 className="vpm-card-title">Two-Factor Authentication</h2>
          <p className="vpm-card-sub">
            Add a second proof of identity. We recommend enabling at least one method — an
            authenticator app or a hardware token.
          </p>
        </div>
      </div>

      {status.isLoading || status.data === undefined ? (
        <div aria-busy="true">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="mt-3 h-16 w-full" />
        </div>
      ) : (
        <>
          <TotpPanel enabled={status.data.totp.enabled} onChanged={invalidate} />
          <SecurityKeyPanel keys={status.data.webauthn.keys} onChanged={invalidate} />
        </>
      )}
    </div>
  );
}
