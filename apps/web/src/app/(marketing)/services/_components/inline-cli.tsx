'use client';

import { useEffect, useRef, useState } from 'react';
import { Play } from 'lucide-react';
import { cn } from '@vunvault/lib';
import {
  INVALID_TARGET_LINE,
  useScanSimulation,
} from '../../_components/scanner/use-scan-simulation';
import '../_styles/services.css';

/**
 * Inline OSINT CLI (Task 54) — the services page's terminal window.
 *
 * Per the catalogue's behaviour spec this REUSES Task 48's simulation engine
 * verbatim ("same validation and the same 19-step script", and "do not
 * duplicate the scan engine" is an explicit out-of-scope rule): all three
 * tools run `useScanSimulation`. The tool tabs swap the hint, placeholder and
 * suggestion chips; switching a tool resets the terminal, as the prototype's
 * per-tool form implies.
 *
 * The reference JS embeds per-tool result scripts, but it is truncated in the
 * catalogue mid-DNS-module and the IMEI module is absent entirely — the
 * engine reuse mandated by the behaviour text is what ships. The IMEI tool's
 * hint/placeholder/chip have no recorded copy; minimal consistent strings are
 * authored for them and flagged in the report.
 */

interface CliTool {
  key: 'ip' | 'dns' | 'imei';
  tabLabel: string;
  placeholder: string;
  hint: string;
  chips: readonly string[];
}

const CLI_TOOLS: readonly CliTool[] = [
  {
    key: 'ip',
    tabLabel: '1 · IP / Reverse Lookup',
    placeholder: 'example.com   or   203.0.113.42',
    hint: 'Resolves reverse DNS, WHOIS ownership and geolocation for a domain or IPv4 address.',
    chips: ['example.com', '203.0.113.42', 'api.vunvault.com'],
  },
  {
    key: 'dns',
    tabLabel: '2 · DNS Record Tracer',
    placeholder: 'example.com',
    hint: 'Checks A, AAAA, MX, TXT and NS records against global registries and flags policy weaknesses.',
    chips: ['example.com', 'vunvault.com', 'mail.example.com'],
  },
  {
    // Authored copy — the catalogue's reference JS is truncated before this
    // tool (see file header).
    key: 'imei',
    tabLabel: '3 · IMEI / Device Registry',
    placeholder: '356938035643809',
    hint: 'Checks the device registry for a 15-digit IMEI — blacklist status, carrier lock and reported-loss entries.',
    chips: ['356938035643809'],
  },
];

const STATUS_LABELS = { idle: 'IDLE', scanning: 'SCANNING', done: 'COMPLETE' } as const;
const STATUS_STATE = { idle: 'idle', scanning: 'running', done: 'done' } as const;

export function InlineCli() {
  const simulation = useScanSimulation();
  const [toolIndex, setToolIndex] = useState(0);
  const [target, setTarget] = useState('');
  const [invalidDismissed, setInvalidDismissed] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const screenRef = useRef<HTMLDivElement>(null);

  const tool = CLI_TOOLS[toolIndex] ?? CLI_TOOLS[0];
  if (tool === undefined) throw new Error('No CLI tools configured.');

  // Auto-scroll the log after every appended line.
  useEffect(() => {
    const screen = screenRef.current;
    if (screen !== null) screen.scrollTop = screen.scrollHeight;
  }, [simulation.lines]);

  useEffect(() => {
    if (simulation.error !== null) setInvalidDismissed(false);
  }, [simulation.error]);

  const inputInvalid = simulation.error === INVALID_TARGET_LINE && !invalidDismissed;

  const selectTool = (index: number) => {
    setToolIndex(index);
    setTarget('');
    setInvalidDismissed(false);
    simulation.reset();
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    simulation.run(target);
  };

  const handleClear = () => {
    setTarget('');
    setInvalidDismissed(false);
    simulation.reset();
    inputRef.current?.focus();
  };

  return (
    <section id="free-tools" className="vv-cli-section">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <span className="vv-kicker">Free Security Tools</span>
          <h2 className="vv-section-title">Run OSINT reconnaissance from your browser</h2>
          <p className="vv-section-lede">
            Three free lookups powered by the same enumeration engine behind our paid assessments.
            No account, no commitment, nothing stored.
          </p>
        </div>

        <div className="vv-cli-shell">
          <div className="vv-cli-titlebar">
            <div className="vv-cli-dots" aria-hidden="true">
              <span className="vv-cli-dot vv-cli-dot--r" />
              <span className="vv-cli-dot vv-cli-dot--y" />
              <span className="vv-cli-dot vv-cli-dot--g" />
            </div>
            <div className="vv-cli-title">vunvault-cli v2.4.0 — osint --interactive</div>
            <div className="vv-cli-status" data-state={STATUS_STATE[simulation.status]}>
              <span className="vv-cli-status-dot" aria-hidden="true" />
              <span>{STATUS_LABELS[simulation.status]}</span>
            </div>
          </div>

          <div className="vv-cli-tabs" role="tablist" aria-label="Free OSINT tools">
            {CLI_TOOLS.map((cliTool, index) => (
              <button
                key={cliTool.key}
                type="button"
                role="tab"
                aria-selected={index === toolIndex}
                className={cn('vv-cli-tab', index === toolIndex && 'is-active')}
                onClick={() => selectTool(index)}
              >
                {cliTool.tabLabel}
              </button>
            ))}
          </div>

          <div className="vv-cli-body">
            <p className="vv-cli-hint">{tool.hint}</p>
            <form className="vv-cli-form" onSubmit={handleSubmit} noValidate>
              <label className="sr-only" htmlFor="vv-cli-target">
                Target value for the selected tool
              </label>
              <div className="vv-cli-input-wrap">
                <span className="vv-cli-prompt" aria-hidden="true">
                  $
                </span>
                <input
                  id="vv-cli-target"
                  ref={inputRef}
                  className={cn('vv-cli-input', inputInvalid && 'is-invalid')}
                  type="text"
                  name="target"
                  placeholder={tool.placeholder}
                  autoComplete="off"
                  value={target}
                  aria-invalid={inputInvalid}
                  onChange={(event) => setTarget(event.target.value)}
                />
              </div>
              <button
                type="submit"
                className="vv-cli-execute"
                disabled={simulation.status === 'scanning'}
              >
                <Play size={14} aria-hidden="true" />
                <span>Execute Scan</span>
              </button>
              <button type="button" className="vv-cli-clear" onClick={handleClear}>
                Clear
              </button>
            </form>

            <div className="vv-cli-chips">
              <span className="vv-cli-chips-label">Try:</span>
              {tool.chips.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  className="vv-chip"
                  onClick={() => {
                    setTarget(chip);
                    setInvalidDismissed(true);
                    inputRef.current?.focus();
                  }}
                >
                  {chip}
                </button>
              ))}
            </div>

            <div
              className="vv-cli-screen"
              role="log"
              aria-live="polite"
              aria-label="Terminal output"
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
              className="vv-cli-meter"
              role="progressbar"
              aria-label="Lookup progress"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={simulation.progress}
            >
              <span style={{ width: `${simulation.progress}%` }} />
            </div>

            <p className="vv-cli-footnote">
              Simulated reconnaissance for demonstration purposes. Never query systems, addresses or
              device identifiers you do not own or have written authorisation to investigate.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
