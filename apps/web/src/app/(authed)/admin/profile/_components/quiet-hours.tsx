'use client';

import { Moon } from 'lucide-react';
import type { NotificationPrefs } from '@vunvault/contracts';
import { cn } from '@vunvault/lib';
import { Switch } from '@vunvault/ui';

/**
 * Quiet hours (Task 83d) — the switch and the two `time` inputs.
 *
 * The window is `HH:MM` in 24-hour form, exactly what the contract's
 * `TimeOfDay` regex accepts, and a native `<input type="time">` produces that
 * shape directly — so the value the browser gives is the value the API
 * validates. Both times are cleared to `null` when quiet hours are off, because
 * the contract stores them as nullable and a stale window would otherwise be
 * saved against a disabled feature.
 *
 * The helper line states the one rule that matters: credential changes and
 * SEV-1 alerts ignore this window.
 */

export interface QuietHoursProps {
  value: NotificationPrefs['quietHours'];
  disabled?: boolean;
  onChange(next: NotificationPrefs['quietHours']): void;
}

export function QuietHours({ value, disabled = false, onChange }: QuietHoursProps) {
  return (
    <div className="ps-quiet">
      <div className="ps-quiet-head">
        <span className="ps-panel-label">
          <Moon size={13} aria-hidden="true" />
          Quiet Hours
        </span>
        <Switch
          id="ps-quiet-enabled"
          checked={value.enabled}
          disabled={disabled}
          aria-label="Quiet hours"
          onCheckedChange={(enabled) =>
            onChange(
              enabled
                ? { enabled, from: value.from, to: value.to }
                : { enabled, from: null, to: null },
            )
          }
        />
      </div>

      <div className="ps-quiet-fields">
        <div className="ps-field">
          <label className="ps-label" htmlFor="ps-quiet-from">
            <span>From</span>
          </label>
          <input
            id="ps-quiet-from"
            className={cn('ps-input ps-input--time')}
            type="time"
            value={value.from ?? ''}
            disabled={disabled || !value.enabled}
            onChange={(event) =>
              onChange({ ...value, from: event.target.value === '' ? null : event.target.value })
            }
          />
        </div>
        <div className="ps-field">
          <label className="ps-label" htmlFor="ps-quiet-to">
            <span>To</span>
          </label>
          <input
            id="ps-quiet-to"
            className={cn('ps-input ps-input--time')}
            type="time"
            value={value.to ?? ''}
            disabled={disabled || !value.enabled}
            onChange={(event) =>
              onChange({ ...value, to: event.target.value === '' ? null : event.target.value })
            }
          />
        </div>
      </div>

      <p className="ps-note">Critical security alerts are always delivered.</p>
    </div>
  );
}
