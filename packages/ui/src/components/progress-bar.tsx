import { cn } from '@vunvault/lib';

export interface ProgressBarProps {
  /** Completion percentage; clamped to 0–100. */
  value: number;
  /** Accessible name — required, the bar has no visible text. */
  label: string;
  className?: string;
}

/** Determinate progress bar used by scan rows and upload states. */
export function ProgressBar({ value, label, className }: ProgressBarProps) {
  const clamped = Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 0;

  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={clamped}
      aria-label={label}
      className={cn('h-1.5 overflow-hidden rounded-full bg-line', className)}
    >
      <div
        className="h-full rounded-full bg-grad-brand transition-[width] duration-[400ms] ease-vv"
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
