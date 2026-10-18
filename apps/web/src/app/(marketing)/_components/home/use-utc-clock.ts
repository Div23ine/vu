'use client';

import { useEffect, useState } from 'react';

/**
 * UTC clock hook .
 *
 * Ticks every second and returns `HH:MM:SS` in UTC — or `null` until mounted.
 * The `null` matters: the server (and the first client render) must produce
 * the SAME placeholder text (`--:--:-- UTC` at the call site) or hydration
 * warns about a mismatched clock. Timers are cleaned up on unmount.
 */

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/** `HH:MM:SS` (UTC) for the given date. Exported for the widget's stamps. */
export function utcStamp(date: Date = new Date()): string {
  return `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`;
}

export function useUtcClock(): string | null {
  const [stamp, setStamp] = useState<string | null>(null);

  useEffect(() => {
    const tick = () => setStamp(utcStamp());
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, []);

  return stamp;
}
