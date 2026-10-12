'use client';

import { useEffect, useRef, useState } from 'react';
import { Play } from 'lucide-react';
import { cn } from '@vunvault/lib';
import { Dialog, DialogContent, DialogTitle } from '@vunvault/ui';
import { useScannerStore } from './scanner-store';
import { INVALID_TARGET_LINE, useScanSimulation } from './use-scan-simulation';
import '../../_styles/scanner.css';

/**
 * Free Scanner terminal dialog (Task 48).
 *
 * The OS-style window from the prototype, rebuilt on the Task 11 `Dialog`
 * primitive: Radix supplies `role="dialog"`, `aria-modal`, the focus trap,
 * Escape-to-close, focus restoration to the opener and the `nav-open` body
 * class. The three traffic-light buttons keep their roles — close and
 * minimise both close; maximise toggles `is-max` on the window.
 *
 * Everything the log shows is the local simulation engine
 * (`use-scan-simulation`): no network, no storage. The dialog is mounted once
 * by the marketing layout; openers are the store's concern.
 */

const STATUS_LABELS = { idle: 'IDLE', scanning: 'SCANNING', done: 'COMPLETE' } as const;

const SUGGESTIONS = ['example.com', '192.168.1.1', 'api.vunvault.com'] as const;

export function ScannerDialog() {
  const open = useScannerStore((state) => state.open);
  const closeDialog = useScannerStore((state) => state.closeDialog);
  const simulation = useScanSimulation();

  const [target, setTarget] = useState('');
  const [maximized, setMaximized] = useState(false);
  // A suggestion click clears the invalid marking without clearing the log
  // (the prototype removes `is-invalid` and refocuses; it does not reset).
  const [invalidDismissed, setInvalidDismissed] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const screenRef = useRef<HTMLDivElement>(null);

  // Auto-scroll the log after every appended line.
  useEffect(() => {
    const screen = screenRef.current;
    if (screen !== null) screen.scrollTop = screen.scrollHeight;
  }, [simulation.lines]);

  // A fresh engine error re-arms the invalid styling.
  useEffect(() => {
    if (simulation.error !== null) setInvalidDismissed(false);
  }, [simulation.error]);

  const inputInvalid = simulation.error === INVALID_TARGET_LINE && !invalidDismissed;

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    simulation.run(target);
  };

  const handleSuggestion = (value: string) => {
    setTarget(value);
    setInvalidDismissed(true);
    inputRef.current?.focus();
  };

  const handleClear = () => {
    setTarget('');
    setInvalidDismissed(false);
    simulation.reset();
    inputRef.current?.focus();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) closeDialog();
      }}
    >
      <DialogContent
        hideClose
        className={cn('vv-scan-window', maximized && 'is-max')}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          inputRef.current?.focus();
        }}
      >
        <div className="vv-scan-titlebar">
          <div className="vv-scan-controls">
            <button
              type="button"
              className="vv-dot vv-dot-close"
              aria-label="Close scanner"
              onClick={closeDialog}
            />
            <button
              type="button"
              className="vv-dot vv-dot-min"
              aria-label="Minimize scanner"
              onClick={closeDialog}
            />
            <button
              type="button"
              className="vv-dot vv-dot-max"
              aria-label="Maximize scanner"
              onClick={() => setMaximized((value) => !value)}
            />
          </div>
          <DialogTitle id="vv-scan-dialog-title" className="vv-scan-title">
            vunvault-scanner-cli v2.4.0 — vvscan --interactive
          </DialogTitle>
          <div className="vv-scan-status" data-state={simulation.status}>
            <span className="vv-scan-status-dot" aria-hidden="true" />
            <span>{STATUS_LABELS[simulation.status]}</span>
          </div>
        </div>

        <div className="vv-scan-body">
          <form className="vv-scan-form" onSubmit={handleSubmit} noValidate>
            <label className="sr-only" htmlFor="vv-scan-target">
              Target IP address or domain name
            </label>
            <div className="vv-scan-input-wrap">
              <span className="vv-scan-prompt" aria-hidden="true">
                $
              </span>
              <input
                id="vv-scan-target"
                ref={inputRef}
                className={cn('vv-scan-input', inputInvalid && 'is-invalid')}
                type="text"
                name="target"
                placeholder="example.com   or   192.168.1.1"
                autoComplete="off"
                value={target}
                aria-invalid={inputInvalid}
                onChange={(event) => setTarget(event.target.value)}
              />
            </div>
            <button
              type="submit"
              className="vv-scan-execute"
              disabled={simulation.status === 'scanning'}
            >
              <Play size={14} aria-hidden="true" />
              <span>Execute Scan</span>
            </button>
            <button type="button" className="vv-scan-reset" onClick={handleClear}>
              Clear
            </button>
          </form>

          <div className="vv-scan-chips">
            <span className="vv-scan-chips-label">Try:</span>
            {SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                className="vv-chip"
                onClick={() => handleSuggestion(suggestion)}
              >
                {suggestion}
              </button>
            ))}
          </div>

          <div
            className="vv-scan-screen"
            role="log"
            aria-live="polite"
            aria-label="Scan output"
            ref={screenRef}
          >
            {simulation.lines.map((line) => (
              <div key={line.id} className={cn('vv-line', `vv-line--${line.kind}`)}>
                <span className="vv-line-ts">[{line.ts}]</span>
                <span className="vv-line-msg">{line.msg}</span>
              </div>
            ))}
          </div>

          <div
            className="vv-scan-progress"
            role="progressbar"
            aria-label="Scan progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={simulation.progress}
          >
            <span style={{ width: `${simulation.progress}%` }} />
          </div>

          <p className="vv-scan-disclaimer">
            Simulated reconnaissance for demonstration purposes. Only scan systems you own or have
            written authorisation to test.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
