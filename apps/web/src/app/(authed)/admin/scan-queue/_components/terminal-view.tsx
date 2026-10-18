'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowDown } from 'lucide-react';
import { cn } from '@vunvault/lib';
import type { ScanLine } from '../_lib/scan-stream-reducer';

/**
 * The scan terminal's log renderer .
 *
 * `role="log"` with `aria-live="off"`: a scan emits hundreds of lines a minute
 * and a screen reader that read them aloud would drown the operator. The
 * status chip beside it is `aria-live="polite"`, so state changes ARE
 * announced — the log is there to be read, not narrated.
 *
 * Every `msg` is a React text node. There is no `dangerouslySetInnerHTML`
 * anywhere in this feature and there never will be: the controller sanitises
 * and redacts upstream, and a second, structural guarantee here means a
 * message containing markup is drawn as the characters it contains.
 */

/** Pixels from the bottom that still count as "the operator is at the end". */
const AT_BOTTOM_THRESHOLD_PX = 24;

function stampOf(ts: string): string {
  const date = new Date(ts);
  if (Number.isNaN(date.getTime())) return '--:--:--';
  const pad = (value: number): string => String(value).padStart(2, '0');
  return `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`;
}

export interface TerminalViewProps {
  lines: readonly ScanLine[];
  autoScroll: boolean;
  onToggleAutoScroll(): void;
}

export function TerminalView({ lines, autoScroll, onToggleAutoScroll }: TerminalViewProps) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const [atBottom, setAtBottom] = useState(true);
  /** True once a line has been seen: the empty state has its own copy. */
  const hasLines = lines.length > 0;

  const scrollToBottom = useCallback((): void => {
    const body = bodyRef.current;
    if (body === null) return;
    body.scrollTop = body.scrollHeight;
  }, []);

  // Follow the tail while auto-scroll is on and the operator has not scrolled
  // up to read something; a manual scroll-up takes over immediately.
  useEffect(() => {
    if (!autoScroll || !atBottom) return;
    scrollToBottom();
  }, [lines, autoScroll, atBottom, scrollToBottom]);

  const onScroll = (): void => {
    const body = bodyRef.current;
    if (body === null) return;
    const distance = body.scrollHeight - body.scrollTop - body.clientHeight;
    setAtBottom(distance <= AT_BOTTOM_THRESHOLD_PX);
  };

  const jumpToLatest = (): void => {
    setAtBottom(true);
    scrollToBottom();
  };

  return (
    <div className="vv-term">
      <div className="vv-term-toolbar">
        <label className="vv-term-autoscroll">
          <input
            type="checkbox"
            checked={autoScroll}
            onChange={onToggleAutoScroll}
            aria-label="Auto-scroll"
          />
          <span>Auto-scroll</span>
        </label>
        {atBottom ? null : (
          <button type="button" className="vv-term-jump" onClick={jumpToLatest}>
            <ArrowDown size={12} aria-hidden="true" />
            <span>Jump to latest</span>
          </button>
        )}
      </div>

      <div
        className="vv-term-body"
        id="vv-term-body"
        ref={bodyRef}
        role="log"
        aria-live="off"
        onScroll={onScroll}
      >
        {hasLines ? (
          lines.map((line) => (
            <p className="vv-term-line" key={line.seq}>
              <span className="vv-term-ts">[{stampOf(line.ts)}]</span>{' '}
              <span className={cn('vv-term-msg', `vv-term-${line.kind}`)}>{line.msg}</span>
            </p>
          ))
        ) : (
          <p className="vv-term-waiting">Waiting for output…</p>
        )}
      </div>
    </div>
  );
}
