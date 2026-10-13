'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Play } from 'lucide-react';
import { cn } from '@vunvault/lib';
import {
  useScanSimulation,
  type ScanLineKind,
} from '../../_components/scanner/use-scan-simulation';
import { FREE_RESOURCES } from '../_data/free-resources';
import '../_styles/products.css';

/**
 * Toolbox Shell (Task 55b) — the interactive console, a React port of the
 * prototype's command interpreter. Every output string is verbatim EXCEPT the
 * purchase routes, per the catalogue's planner edit: `buy` announces and
 * navigates to `/portal/billing` (Task 66's checkout) instead of the
 * prototype's `payment.html`.
 *
 * `scan <target>` delegates to Task 48's `useScanSimulation` (the catalogue
 * mandates the reuse — same validation, same 19-step script); the engine's
 * lines are mirrored into this log as they arrive. `download` prints its
 * verbatim lines but fetches nothing: the files are unpublished (the same
 * `TODO(content)` that disables the resource cards' buttons).
 *
 * Nothing here touches the network or storage — it is a local simulation.
 */

interface TermLine {
  id: number;
  ts: string;
  kind: ScanLineKind;
  msg: string;
}

type TermStatus = 'idle' | 'scanning' | 'done';

const STATUS_TEXT: Record<TermStatus, string> = {
  idle: 'READY',
  scanning: 'SCANNING',
  done: 'COMPLETE',
};

/** The prototype's PAID map — the shell's `buy`/`products` catalogue. */
const PAID = {
  reconvault: { name: 'ReconVault Pro', price: 49 },
  vulnscope: { name: 'VulnScope API', price: 129 },
  phishguard: { name: 'PhishGuard Kit', price: 79 },
  loghound: { name: 'LogHound SIEM Pack', price: 199 },
  payloadforge: { name: 'PayloadForge', price: 99 },
  compliancemapper: { name: 'ComplianceMapper', price: 149 },
} as const;

const SUGGESTIONS = [
  'help',
  'products',
  'free',
  'scan example.com',
  'download cve-tracker',
] as const;

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/** The prototype stamps shell lines with LOCAL time (the engine uses UTC). */
function localStamp(date: Date = new Date()): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export function ToolboxShell() {
  const router = useRouter();
  const simulation = useScanSimulation();

  const [lines, setLines] = useState<TermLine[]>([]);
  const [command, setCommand] = useState('');
  const [status, setStatus] = useState<TermStatus>('idle');

  const nextId = useRef(0);
  const seenEngineLines = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const screenRef = useRef<HTMLDivElement>(null);

  const print = useCallback((kind: ScanLineKind, msg: string) => {
    nextId.current += 1;
    const line: TermLine = { id: nextId.current, ts: localStamp(), kind, msg };
    setLines((previous) => [...previous, line]);
  }, []);

  // Boot banner (client-side only, so SSR markup stays empty and stable).
  useEffect(() => {
    print('sys', 'vunvault-toolbox v2.4.0 — interactive shell');
    print('muted', 'type "help" to list available commands');
  }, [print]);

  // Mirror engine output into the shell log as it streams in.
  useEffect(() => {
    if (simulation.lines.length <= seenEngineLines.current) return;
    const fresh = simulation.lines.slice(seenEngineLines.current);
    seenEngineLines.current = simulation.lines.length;
    setLines((previous) => {
      const appended = fresh.map((engineLine) => {
        nextId.current += 1;
        return {
          id: nextId.current,
          ts: engineLine.ts,
          kind: engineLine.kind,
          msg: engineLine.msg,
        } satisfies TermLine;
      });
      return [...previous, ...appended];
    });
  }, [simulation.lines]);

  // Status pill follows the engine; COMPLETE falls back to READY after 2.6s.
  useEffect(() => {
    if (simulation.status === 'scanning') {
      setStatus('scanning');
      return;
    }
    if (simulation.status === 'done') {
      setStatus('done');
      const timer = setTimeout(() => setStatus('idle'), 2600);
      return () => clearTimeout(timer);
    }
  }, [simulation.status]);

  // Auto-scroll the log.
  useEffect(() => {
    const screen = screenRef.current;
    if (screen !== null) screen.scrollTop = screen.scrollHeight;
  }, [lines]);

  const clearScreen = useCallback(() => {
    simulation.reset();
    seenEngineLines.current = 0;
    setLines([]);
  }, [simulation]);

  const run = useCallback(
    (raw: string) => {
      const text = raw.trim();
      if (text === '') return;
      print('muted', `$ ${text}`);
      const parts = text.split(/\s+/);
      const cmd = (parts.shift() ?? '').toLowerCase();
      const arg = parts.join(' ');

      switch (cmd) {
        case 'help': {
          print('sys', 'VUNVAULT toolbox shell — available commands');
          print('muted', ' help show this message');
          print('muted', ' products list premium products');
          print('muted', ' free list free resources');
          print('muted', ' buy <id> open /portal/billing for a product');
          print('muted', ' download <id> fetch a free resource');
          print('muted', ' scan <target> run a simulated reconnaissance pass');
          print('muted', ' about about this toolbox');
          print('muted', ' clear clear the screen');
          break;
        }
        case 'products': {
          const ids = Object.keys(PAID);
          print('info', `[*] Premium catalog — ${ids.length} products`);
          for (const id of ids) {
            const product = PAID[id as keyof typeof PAID];
            print(
              'muted',
              ` ${id.padEnd(18, ' ')}${product.name.padEnd(24, ' ')}$${product.price}`,
            );
          }
          print('ok', '[+] run `buy <id>` to open secure checkout');
          break;
        }
        case 'free': {
          print('info', `[*] Free resources — ${FREE_RESOURCES.length} downloads`);
          for (const resource of FREE_RESOURCES) {
            print('muted', ` ${resource.id.padEnd(22, ' ')}${resource.shellName}`);
          }
          print('ok', '[+] run `download <id>` to fetch a file');
          break;
        }
        case 'buy': {
          if (arg === '') {
            print('warn', '[!] usage: buy <product-id> (try `products`)');
            break;
          }
          const product = PAID[arg.toLowerCase() as keyof typeof PAID];
          if (product === undefined) {
            print('crit', `[!] unknown product id: ${arg}`);
            break;
          }
          // Planner edit: checkout lives at /portal/billing, not payment.html.
          print('info', `[*] redirecting to /portal/billing for ${product.name} …`);
          setTimeout(() => router.push('/portal/billing'), 420);
          break;
        }
        case 'download': {
          if (arg === '') {
            print('warn', '[!] usage: download <resource-id> (try `free`)');
            break;
          }
          const resource = FREE_RESOURCES.find((candidate) => candidate.id === arg.toLowerCase());
          if (resource === undefined) {
            print('crit', `[!] unknown resource id: ${arg}`);
            break;
          }
          print('ok', `[+] fetching ${resource.shellName}`);
          print('muted', ` source → ${resource.file}`);
          // TODO(content): file URLs — nothing is fetched until the files are
          // published (the resource cards' Download buttons are disabled for
          // the same reason).
          break;
        }
        case 'scan': {
          if (arg === '') {
            print('warn', '[!] usage: scan <domain|ip>');
            break;
          }
          if (simulation.status === 'scanning') {
            print('warn', '[!] a scan is already running');
            break;
          }
          // Task 48's engine: validation, cadence and the 19-step script.
          simulation.run(arg);
          break;
        }
        case 'about': {
          print('sys', 'VUNVAULT Toolbox — build 2.4.0 (Nairobi, Kenya)');
          print('muted', 'Penetration testing tooling, automation scripts and');
          print('muted', 'technical documentation for defenders and offensive engineers.');
          break;
        }
        case 'clear': {
          clearScreen();
          break;
        }
        default: {
          print('crit', `[!] command not found: ${cmd}`);
          print('muted', ' type `help` for the command list');
        }
      }
    },
    [clearScreen, print, router, simulation],
  );

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    run(command);
    setCommand('');
    inputRef.current?.focus();
  };

  return (
    <section id="terminal" className="py-14 md:py-20 bg-paper border-t border-neutral-200/80">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="space-y-3 max-w-3xl">
          <div className="flex items-center gap-2">
            <span className="h-[2px] w-6 bg-cyan-600 rounded-full" />
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-700">
              Live Console
            </span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-neutral-900 tracking-tight">
            Try the toolbox before you download it
          </h2>
          <p className="text-neutral-500 text-sm md:text-base leading-relaxed">
            This is the same shell our operators use. Browse the catalogue, preview a scan or pull a
            free resource — right here in the browser.
          </p>
        </div>

        <div className="rounded-2xl bg-neutral-900/95 text-neutral-100 p-4 sm:p-5 border border-neutral-800 shadow-2xl overflow-hidden font-sans">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3.5 border-b border-neutral-800 text-xs">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5" aria-hidden="true">
                <span className="vv-term-dot vv-term-dot--r" />
                <span className="vv-term-dot vv-term-dot--y" />
                <span className="vv-term-dot vv-term-dot--g" />
              </span>
              <span className="font-extrabold tracking-wider text-white">VUNVAULT</span>
              <span className="text-neutral-600 hidden sm:inline">|</span>
              <span className="text-neutral-300 font-semibold uppercase tracking-wider hidden sm:inline">
                Toolbox Shell
              </span>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="vv-scan-status" id="vv-term-status" data-state={status}>
                <span className="vv-scan-status-dot" aria-hidden="true" />
                <span id="vv-term-status-text">{STATUS_TEXT[status]}</span>
              </span>
            </div>
          </div>

          <div
            className="vv-scan-screen vv-term-screen mt-4"
            id="vv-term-screen"
            role="log"
            aria-live="polite"
            aria-label="Interactive toolbox console output"
            ref={screenRef}
          >
            {lines.map((line) => (
              <div key={line.id} className={cn('vv-line', `vv-line--${line.kind}`)}>
                <span className="vv-line-ts">[{line.ts}]</span>
                <span className="vv-line-msg">{line.msg}</span>
              </div>
            ))}
          </div>

          <form className="vv-term-form" id="vv-term-form" onSubmit={handleSubmit}>
            <label className="sr-only" htmlFor="vv-term-input">
              Enter a command
            </label>
            <div className="vv-scan-input-wrap">
              <span className="vv-scan-prompt" aria-hidden="true">
                $
              </span>
              <input
                id="vv-term-input"
                ref={inputRef}
                className="vv-scan-input"
                type="text"
                name="command"
                placeholder="help"
                autoComplete="off"
                value={command}
                onChange={(event) => setCommand(event.target.value)}
              />
            </div>
            <button
              type="submit"
              className="vv-scan-execute"
              disabled={simulation.status === 'scanning'}
            >
              <Play size={14} aria-hidden="true" />
              <span>Run</span>
            </button>
            <button
              type="button"
              className="vv-scan-reset"
              id="vv-term-clear"
              onClick={() => {
                clearScreen();
                inputRef.current?.focus();
              }}
            >
              Clear
            </button>
          </form>

          <div className="vv-scan-chips mt-3.5">
            <span className="vv-scan-chips-label">Try:</span>
            {SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                className="vv-chip"
                onClick={() => {
                  run(suggestion);
                  inputRef.current?.focus();
                }}
              >
                {suggestion}
              </button>
            ))}
          </div>

          <p className="pt-4 mt-4 border-t border-neutral-800 text-[10px] text-neutral-500 leading-relaxed">
            Simulated environment for demonstration. Purchases route to checkout; free downloads are
            fetched directly from source.
          </p>
        </div>
      </div>
    </section>
  );
}
