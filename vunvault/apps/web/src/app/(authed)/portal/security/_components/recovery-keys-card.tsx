'use client';

import { useEffect, useState } from 'react';
import { Copy, KeyRound, Printer, EyeOff, RefreshCw } from 'lucide-react';
import type { RecoveryCodesResponse } from '@vunvault/contracts';
import { formatRelativeActive } from '@vunvault/lib';
import { Skeleton, toast } from '@vunvault/ui';
import {
  useGenerateRecoveryCodes,
  useRegenerateRecoveryCodes,
  useSecurityInvalidator,
  useSecurityStatus,
} from '../_hooks/use-security';
import { RegenerateDialog } from './regenerate-dialog';

/**
 * Recovery-keys card (Task 67) — the ten single-use codes, shown EXACTLY
 * once. The plaintext codes live only in this component's state: Hide Codes
 * or unmount destroys them, and neither the API nor any storage can bring
 * them back (the server holds SHA-256 digests only). After a reload the card
 * falls back to the API-derived status line
 * `Generated <relative time> · <remaining> of 10 unused`.
 *
 * Print Codes renders a print-only sheet (the `@media print` block in
 * `security.css` hides everything else) and calls `window.print()`.
 * Regenerate goes through the confirmation dialog, then replaces the batch.
 */

type CodeBatch = RecoveryCodesResponse['data'] & { regenerated: boolean };

export function RecoveryKeysCard() {
  const status = useSecurityStatus();
  const generate = useGenerateRecoveryCodes();
  const regenerate = useRegenerateRecoveryCodes();
  const invalidate = useSecurityInvalidator();
  const [batch, setBatch] = useState<CodeBatch | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const recovery = status.data?.recovery;
  const busy = generate.isPending || regenerate.isPending;

  // Clear the plaintext codes when the card unmounts (belt and braces — the
  // state dies with the component anyway).
  useEffect(() => () => setBatch(null), []);

  const showCodes = (data: RecoveryCodesResponse['data'], regenerated: boolean) => {
    setBatch({ ...data, regenerated });
  };

  const onGenerate = async () => {
    try {
      const data = await generate.mutateAsync();
      showCodes(data, false);
      toast({ kind: 'ok', title: '10 recovery keys generated' });
      invalidate();
    } catch {
      // 409 already_generated (or any other failure): the status read is the
      // source of truth — refetch and let the generated-state UI take over.
      invalidate();
    }
  };

  const onRegenerate = async () => {
    setDialogOpen(false);
    try {
      const data = await regenerate.mutateAsync();
      showCodes(data, true);
      toast({ kind: 'ok', title: 'New recovery keys generated' });
      invalidate();
    } catch {
      toast({ kind: 'crit', title: 'Regeneration failed', message: 'Please try again.' });
    }
  };

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard?.writeText(code);
    } catch {
      // Clipboard permission denied — the code stays visible on screen.
    }
    toast({ kind: 'ok', title: 'Recovery code copied' });
  };

  const printCodes = () => {
    toast({ kind: 'info', title: 'Preparing printable sheet…' });
    window.print();
  };

  const statusLine = (): string => {
    if (batch !== null) {
      return batch.regenerated
        ? 'Regenerated just now · 10 of 10 unused'
        : 'Generated just now · 10 of 10 unused';
    }
    if (recovery === undefined || recovery.generatedAt === null) return '';
    const relative = formatRelativeActive(new Date(recovery.generatedAt), new Date());
    return `Generated ${relative} · ${recovery.remaining} of ${recovery.total} unused`;
  };

  const generated = batch !== null || recovery?.generated === true;

  return (
    <div className="vpm-card">
      <div className="vpm-card-head">
        <span className="vpm-card-icon" aria-hidden="true">
          <KeyRound size={20} />
        </span>
        <div>
          <h2 className="vpm-card-title">Recovery Keys</h2>
          <p className="vpm-card-sub">
            Single-use backup codes for when you lose your phone, token or network access. Print
            them and store them offline.
          </p>
        </div>
      </div>

      {status.isLoading || recovery === undefined ? (
        <Skeleton className="h-20 w-full" aria-busy="true" />
      ) : !generated ? (
        <>
          <p className="vpm-empty">No recovery keys generated yet</p>
          <p className="vpm-2fa-sub">
            Generate a set of 10 single-use emergency codes. Each code can be used exactly once to
            regain access to your account.
          </p>
          <div className="vpm-keys-actions">
            <button
              type="button"
              className="vpm-btn vpm-btn--primary"
              disabled={busy}
              aria-busy={busy}
              onClick={() => void onGenerate()}
            >
              {busy ? <span className="vpm-btn-spinner" aria-hidden="true" /> : null}
              <span>Generate Recovery Keys</span>
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="vpm-keys-panel">
            <div className="vpm-keys-title">Emergency Backup Codes</div>
            <div className="vpm-keys-status" role="status">
              {statusLine()}
            </div>
            {batch !== null ? (
              <>
                <p className="vpm-keys-warning">
                  These codes are shown once. Print them, store them in a safe, and never share them
                  — anyone with a code can bypass your two-factor authentication.
                </p>
                <ul className="vpm-code-list">
                  {batch.codes.map((code, index) => (
                    <li key={code} className="vpm-code-row">
                      <code>{code}</code>
                      <button
                        type="button"
                        className="vpm-code-copy"
                        aria-label={`Copy recovery code ${index + 1}`}
                        onClick={() => void copyCode(code)}
                      >
                        <Copy size={13} aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
            <div className="vpm-keys-actions">
              {batch !== null ? (
                <>
                  <button
                    type="button"
                    className="vpm-btn vpm-btn--ghost vpm-btn--sm"
                    onClick={() => setBatch(null)}
                  >
                    <EyeOff size={13} aria-hidden="true" />
                    Hide Codes
                  </button>
                  <button
                    type="button"
                    className="vpm-btn vpm-btn--ghost vpm-btn--sm"
                    onClick={printCodes}
                  >
                    <Printer size={13} aria-hidden="true" />
                    Print Codes
                  </button>
                </>
              ) : null}
              <button
                type="button"
                className="vpm-btn vpm-btn--danger vpm-btn--sm"
                disabled={busy}
                onClick={() => setDialogOpen(true)}
              >
                <RefreshCw size={13} aria-hidden="true" />
                Regenerate
              </button>
            </div>
          </div>

          {/* Print-only sheet: the only thing that reaches paper. */}
          {batch !== null ? (
            <div className="vpm-print-sheet" aria-hidden="true">
              <div className="vpm-print-title">VUNVAULT — Emergency Backup Codes</div>
              <ul className="vpm-print-list">
                {batch.codes.map((code) => (
                  <li key={code}>{code}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      )}

      <RegenerateDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onConfirm={() => void onRegenerate()}
        pending={regenerate.isPending}
      />
    </div>
  );
}
