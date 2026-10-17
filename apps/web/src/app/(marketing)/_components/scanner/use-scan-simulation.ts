// SIMULATION — no scan is performed
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * The simulated reconnaissance engine (Task 48), ported from the prototype's
 * scanner script to a typed hook. No DOM access, no `innerHTML`, no network
 * request is ever made and nothing is stored — React state drives the log and
 * the dialog renders it. Reused by the Services page's inline CLI (Task 54).
 *
 * Cadence: one line every 260 ms; under `prefers-reduced-motion` the whole
 * log is appended instantly. Timestamps are `[HH:MM:SS]` UTC, exactly like
 * the prototype's `toISOString().substr(11, 8)`.
 */

export type ScanLineKind = 'sys' | 'muted' | 'info' | 'ok' | 'warn' | 'crit';

export interface ScanLine {
  id: number;
  ts: string;
  kind: ScanLineKind;
  msg: string;
}

export type ScanStatus = 'idle' | 'scanning' | 'done';

export interface UseScanSimulation {
  lines: ScanLine[];
  progress: number;
  status: ScanStatus;
  run(target: string): void;
  reset(): void;
  error: string | null;
}

/** Validation regex, exactly as the prototype's. */
export const TARGET_PATTERN = /^(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$|^(?:\d{1,3}\.){3}\d{1,3}$/;

export const INVALID_TARGET_LINE =
  '[!] Invalid target. Enter a domain (example.com) or IPv4 address.';

const STEP_CADENCE_MS = 260;

interface ScanStep {
  kind: ScanLineKind;
  msg: string | ((target: string) => string);
}

/** The 19-step script, verbatim from the prototype. */
const SCAN_STEPS: readonly ScanStep[] = [
  { kind: 'sys', msg: 'vunvault-scanner-cli v2.4.0 — initialising reconnaissance engine' },
  { kind: 'muted', msg: (target) => `> target: ${target}` },
  { kind: 'info', msg: '[*] Resolving DNS records ...' },
  { kind: 'ok', msg: '[+] A record resolved → 203.0.113.42' },
  { kind: 'info', msg: '[*] Enumerating subdomains (CT logs + DNS brute) ...' },
  { kind: 'ok', msg: '[+] 14 subdomains discovered' },
  { kind: 'info', msg: '[*] Probing TCP ports 1-1024 ...' },
  { kind: 'warn', msg: '[!] Port 22/tcp open — SSH (OpenSSH 8.2p1)' },
  { kind: 'warn', msg: '[!] Port 8080/tcp open — HTTP proxy' },
  { kind: 'ok', msg: '[+] Port 443/tcp open — TLS 1.3, HSTS enabled' },
  { kind: 'info', msg: '[*] Fingerprinting web stack ...' },
  { kind: 'ok', msg: '[+] nginx/1.24.0, PHP/8.2, WordPress/6.5.2' },
  { kind: 'info', msg: '[*] Cross-referencing CVEs ...' },
  { kind: 'crit', msg: '[CRITICAL] CVE-2026-9122 — RCE in API ingress (CVSS 9.8)' },
  { kind: 'warn', msg: '[HIGH] CVE-2026-4401 — Directory traversal (CVSS 7.5)' },
  { kind: 'warn', msg: '[MEDIUM] CVE-2025-18820 — SQLi in search parameter (CVSS 5.3)' },
  { kind: 'info', msg: '[*] Generating prioritised remediation map ...' },
  { kind: 'ok', msg: '[+] Report ready. 3 findings — 1 critical, 1 high, 1 medium.' },
  { kind: 'sys', msg: 'scan complete in 4.28s' },
];

function prefersReducedMotion(): boolean {
  // Defensive shape: jsdom ships no matchMedia.
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function timestamp(): string {
  return new Date().toISOString().slice(11, 19);
}

export function useScanSimulation(): UseScanSimulation {
  const [lines, setLines] = useState<ScanLine[]>([]);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<ScanStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const nextId = useRef(0);
  const stepIndex = useRef(0);

  const clearTimer = useCallback(() => {
    if (timer.current !== null) {
      clearInterval(timer.current);
      timer.current = null;
    }
  }, []);

  const append = useCallback((kind: ScanLineKind, msg: string) => {
    nextId.current += 1;
    const line: ScanLine = { id: nextId.current, ts: timestamp(), kind, msg };
    setLines((previous) => [...previous, line]);
  }, []);

  // Unmounting mid-scan kills the interval; nothing else outlives the hook.
  useEffect(() => clearTimer, [clearTimer]);

  const run = useCallback(
    (rawTarget: string) => {
      const target = rawTarget.trim();
      if (target === '' || !TARGET_PATTERN.test(target)) {
        append('crit', INVALID_TARGET_LINE);
        setError(INVALID_TARGET_LINE);
        return;
      }

      clearTimer();
      setError(null);
      setLines([]);
      setProgress(0);
      setStatus('scanning');
      stepIndex.current = 0;

      const finish = () => {
        clearTimer();
        setProgress(100);
        setStatus('done');
      };

      if (prefersReducedMotion()) {
        // Reduced motion: the whole log lands instantly, no cadence.
        for (const step of SCAN_STEPS) {
          append(step.kind, typeof step.msg === 'function' ? step.msg(target) : step.msg);
        }
        finish();
        return;
      }

      timer.current = setInterval(() => {
        const index = stepIndex.current;
        if (index >= SCAN_STEPS.length) {
          finish();
          return;
        }
        const step = SCAN_STEPS[index];
        if (step !== undefined) {
          append(step.kind, typeof step.msg === 'function' ? step.msg(target) : step.msg);
        }
        stepIndex.current = index + 1;
        setProgress(Math.round(((index + 1) / SCAN_STEPS.length) * 100));
      }, STEP_CADENCE_MS);
    },
    [append, clearTimer],
  );

  const reset = useCallback(() => {
    clearTimer();
    setLines([]);
    setProgress(0);
    setStatus('idle');
    setError(null);
  }, [clearTimer]);

  return { lines, progress, status, run, reset, error };
}
