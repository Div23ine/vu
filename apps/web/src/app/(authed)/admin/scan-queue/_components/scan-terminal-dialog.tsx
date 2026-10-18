'use client';

import { useCallback, useState } from 'react';
import { Copy, Download, OctagonX, Skull } from 'lucide-react';
import type { ScanControlType, ScanJob } from '@vunvault/contracts';
import { SCAN_TYPE_LABELS } from '@vunvault/contracts';
import { cn, formatEta } from '@vunvault/lib';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  ProgressBar,
  toast,
} from '@vunvault/ui';
import { can } from '../../../../../lib/permissions';
import { useSession } from '../../../../../lib/session';
import { useScanStream } from '../_hooks/use-scan-stream';
import { ENDED_COPY, terminalChipLabel, type TerminalStatus } from '../_lib/scan-stream-reducer';
import { TerminalView } from './terminal-view';
import '../_styles/terminal.css';

/**
 * The staff live scan terminal .
 *
 * Staff-only by construction: the relay behind it refuses a `client`-role
 * session before the socket even upgrades , so this dialog is only
 * ever reachable from the admin Scan Queue. What it shows is the controller's
 * already-sanitised output — no target credentials, no raw tool output, no pod
 * names — and the only thing an operator can put back on the wire is one of
 * four whitelisted verbs.
 *
 * `Pause` and `Resume` render disabled with a tooltip rather than being
 * hidden: the controller cannot pause a pod , and a control that
 * silently does not exist invites the question of whether the terminal is
 * broken.
 */

/** The verbatim tooltip on the two controls the platform cannot honour. */
export const PAUSE_UNSUPPORTED_TOOLTIP = 'Pause is not supported in this environment.';

/** Copy and download filenames both come from here, so they cannot drift. */
export function logFileName(jobCode: string): string {
  return `${jobCode}.log`;
}

export function logTextOf(lines: readonly { seq: number; ts: string; msg: string }[]): string {
  return lines.map((line) => `[${line.ts}] ${line.msg}`).join('\n');
}

/** Hidden `<a download>` + object URL, revoked right after the click. */
function triggerBlobDownload(blob: Blob, filename: string): void {
  if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') return;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.hidden = true;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

const CONFIRM_COPY = {
  abort: {
    confirmLabel: 'Abort scan',
    buttonClass: 'adm-btn adm-btn-dark',
    body: 'The scan stops and partial results are kept.',
  },
  kill: {
    confirmLabel: 'Kill scan',
    buttonClass: 'adm-btn adm-btn-danger',
    body: 'The scan pod is terminated without cleanup.',
  },
} as const;

export interface ScanTerminalDialogProps {
  job: ScanJob;
  open: boolean;
  onOpenChange(open: boolean): void;
}

export function ScanTerminalDialog({ job, open, onOpenChange }: ScanTerminalDialogProps) {
  const { user } = useSession();
  const canExecute = can(user, 'scans:execute');
  const canKill = user?.role === 'admin' || user?.role === 'super_admin';

  const [autoScroll, setAutoScroll] = useState(true);
  const [pending, setPending] = useState<ScanControlType | null>(null);

  const onControlAck = useCallback(
    (control: ScanControlType): void => {
      toast({
        kind: 'ok',
        title: 'Command sent',
        message: `${control} sent to ${job.jobCode}.`,
      });
    },
    [job.jobCode],
  );

  const onStreamError = useCallback((code: string): void => {
    if (code === 'forbidden') {
      toast({
        kind: 'warn',
        title: 'Command refused',
        message: 'Your role cannot send this command.',
      });
    }
  }, []);

  const { state, sendControl } = useScanStream(open ? job.id : null, open, {
    onControlAck,
    onStreamError,
  });

  const controlsEnabled = state.status === 'running' && canExecute;
  const chipLabel = terminalChipLabel(state);
  const chipState: TerminalStatus | 'reconnecting' = state.reconnecting
    ? 'reconnecting'
    : state.status;

  const endedCopy =
    state.notice ??
    (state.status === 'completed' || state.status === 'cancelled' || state.status === 'failed'
      ? ENDED_COPY[state.status]
      : null);

  const onCopyLog = async (): Promise<void> => {
    const text = logTextOf(state.lines);
    try {
      await navigator.clipboard.writeText(text);
      toast({
        kind: 'ok',
        title: 'Log copied',
        message: `${state.lines.length} lines copied to the clipboard.`,
      });
    } catch {
      toast({
        kind: 'warn',
        title: 'Clipboard blocked',
        message: 'Select and copy the payload text manually.',
      });
    }
  };

  const onDownloadLog = (): void => {
    triggerBlobDownload(
      new Blob([logTextOf(state.lines)], { type: 'text/plain;charset=utf-8' }),
      logFileName(job.jobCode),
    );
  };

  const confirmPending = (): void => {
    const control = pending;
    setPending(null);
    if (control === null) return;
    if (!sendControl(control)) {
      toast({
        kind: 'warn',
        title: 'Command not sent',
        message: 'The scan stream is not connected.',
      });
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent size="lg" className="vv-term-dialog" aria-labelledby="vv-term-title">
          <div className="vv-term-chrome">
            <div className="vv-term-headline">
              <DialogTitle id="vv-term-title" className="vv-term-title">
                {job.jobCode} — {job.targetHost}
              </DialogTitle>
              <DialogDescription className="vv-term-subtitle">
                {SCAN_TYPE_LABELS[job.scanType]} · live controller output, sanitised and redacted
              </DialogDescription>
            </div>
            <span
              className={cn('vv-term-chip', `is-${chipState}`)}
              role="status"
              aria-live="polite"
            >
              <span className="vv-term-chip-dot" aria-hidden="true" />
              {chipLabel}
            </span>
          </div>

          <div className="vv-term-meta">
            <span className="vv-term-phase" id="vv-term-phase">
              {state.phase ?? 'Awaiting first phase'}
            </span>
            <span className="vv-term-eta">
              {state.progress}%
              {state.etaSeconds === null ? '' : ` · ${formatEta(state.etaSeconds)} left`}
            </span>
          </div>
          <ProgressBar value={state.progress} label={`Scan progress for ${job.jobCode}`} />

          <TerminalView
            lines={state.lines}
            autoScroll={autoScroll}
            onToggleAutoScroll={() => setAutoScroll((current) => !current)}
          />

          {endedCopy === null ? null : (
            <p className="vv-term-ended" role="status">
              {endedCopy}
            </p>
          )}

          <div className="vv-term-actions">
            <button type="button" className="vv-term-btn" onClick={() => void onCopyLog()}>
              <Copy size={13} aria-hidden="true" />
              <span>Copy log</span>
            </button>
            <button type="button" className="vv-term-btn" onClick={onDownloadLog}>
              <Download size={13} aria-hidden="true" />
              <span>Download .txt</span>
            </button>

            <span className="vv-term-actions-spacer" />

            {/* A disabled button swallows pointer events and cannot be
        focused, so the explanation rides on the native `title` —
        the audit page's WORM-snapshot precedent. */}
            <button
              type="button"
              className="vv-term-btn"
              disabled
              title={PAUSE_UNSUPPORTED_TOOLTIP}
            >
              <span>Pause</span>
            </button>
            <button
              type="button"
              className="vv-term-btn"
              disabled
              title={PAUSE_UNSUPPORTED_TOOLTIP}
            >
              <span>Resume</span>
            </button>
            <button
              type="button"
              className="vv-term-btn vv-term-btn--danger"
              disabled={!controlsEnabled}
              onClick={() => setPending('abort')}
            >
              <OctagonX size={13} aria-hidden="true" />
              <span>Abort</span>
            </button>
            {canKill ? (
              <button
                type="button"
                className="vv-term-btn vv-term-btn--kill"
                disabled={!controlsEnabled}
                onClick={() => setPending('kill')}
              >
                <Skull size={13} aria-hidden="true" />
                <span>Kill</span>
              </button>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={pending !== null} onOpenChange={(next) => !next && setPending(null)}>
        <DialogContent size="sm">
          <DialogTitle>
            {pending === 'kill' ? `Kill ${job.jobCode} immediately?` : `Abort ${job.jobCode}?`}
          </DialogTitle>
          <DialogDescription>
            {pending === 'kill' ? CONFIRM_COPY.kill.body : CONFIRM_COPY.abort.body}
          </DialogDescription>
          <div className="sq-confirm-actions">
            <DialogClose asChild>
              <button type="button" className="adm-btn adm-btn-ghost">
                Keep scanning
              </button>
            </DialogClose>
            <button
              type="button"
              className={
                pending === 'kill' ? CONFIRM_COPY.kill.buttonClass : CONFIRM_COPY.abort.buttonClass
              }
              onClick={confirmPending}
            >
              {pending === 'kill'
                ? CONFIRM_COPY.kill.confirmLabel
                : CONFIRM_COPY.abort.confirmLabel}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
