import { cn } from '@vunvault/lib';

export interface StatusPillProps {
  /** Overrides the default `"SYS: OPERATIONAL"` copy. */
  label?: string;
  className?: string;
}

/**
 * Live system-status pill. The dot carries a `vv-ping` ring (decorative, so it is
 * `aria-hidden`) and the root is a polite live region: an operator screen reader
 * announces a status change without stealing focus.
 */
export function StatusPill({ label = 'SYS: OPERATIONAL', className }: StatusPillProps) {
  return (
    <span
      role="status"
      className={cn(
        'inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-ok/35 bg-ok/10',
        'px-[14px] py-[7px] font-mono text-[10px] font-extrabold uppercase tracking-[0.14em]',
        'text-pill-ok-ink',
        className,
      )}
    >
      <span className="relative flex size-1.5" aria-hidden="true">
        <span className="absolute inline-flex size-full animate-vv-ping rounded-full bg-ok opacity-75" />
        <span className="relative inline-flex size-1.5 rounded-full bg-ok" />
      </span>
      {label}
    </span>
  );
}
