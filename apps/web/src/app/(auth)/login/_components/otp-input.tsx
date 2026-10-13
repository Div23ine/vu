'use client';

import { useRef } from 'react';
import { cn } from '@vunvault/lib';
import '../../_styles/auth.css';

/**
 * Six-box OTP input (Task 60, reused by Task 62).
 *
 * The prototype's UX, ported: digits only, auto-advance on entry, Backspace
 * on an empty box moves back (and clears the previous), arrow keys move
 * focus, and pasting a run of digits fills as many boxes as it has digits —
 * completing the sixth fires `onComplete` exactly once (guarded while a
 * verification is pending by the caller disabling the boxes).
 *
 * No test-OTP scaffolding, no console logging, no browser storage.
 */

export const OTP_LENGTH = 6;

export interface OtpInputProps {
  digits: string[];
  onChange(digits: string[]): void;
  /** Fired when the sixth digit lands (typing or paste). */
  onComplete(code: string): void;
  state?: 'idle' | 'error' | 'ok';
  disabled?: boolean;
}

export function OtpInput({
  digits,
  onChange,
  onComplete,
  state = 'idle',
  disabled = false,
}: OtpInputProps) {
  const boxes = useRef<(HTMLInputElement | null)[]>([]);

  const focusBox = (index: number) => {
    boxes.current[index]?.focus();
  };

  const commit = (next: string[]) => {
    onChange(next);
    if (next.every((digit) => digit !== '')) {
      onComplete(next.join(''));
    }
  };

  const handleChange = (index: number, raw: string) => {
    const digit = raw.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[index] = digit;
    commit(next);
    if (digit !== '' && index < OTP_LENGTH - 1) focusBox(index + 1);
  };

  const handleKeyDown = (index: number, event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Backspace') {
      event.preventDefault();
      const next = [...digits];
      if (next[index] !== '') {
        next[index] = '';
        onChange(next);
        return;
      }
      if (index > 0) {
        next[index - 1] = '';
        onChange(next);
        focusBox(index - 1);
      }
      return;
    }
    if (event.key === 'ArrowLeft' && index > 0) {
      event.preventDefault();
      focusBox(index - 1);
    }
    if (event.key === 'ArrowRight' && index < OTP_LENGTH - 1) {
      event.preventDefault();
      focusBox(index + 1);
    }
  };

  const handlePaste = (index: number, event: React.ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH);
    if (pasted === '') return;
    const next = [...digits];
    for (let offset = 0; offset < pasted.length && index + offset < OTP_LENGTH; offset += 1) {
      next[index + offset] = pasted[offset] as string;
    }
    commit(next);
    focusBox(Math.min(index + pasted.length, OTP_LENGTH - 1));
  };

  return (
    <div
      className="vv-otp-inputs"
      id="vvOtpInputs"
      role="group"
      aria-label="6 digit verification code"
    >
      {digits.map((digit, index) => (
        <input
          key={index} // Fixed six slots — index keys are correct here.

          ref={(element) => {
            boxes.current[index] = element;
          }}
          className={cn(
            'vv-otp-digit',
            digit !== '' && state === 'idle' && 'is-filled',
            state === 'error' && digit !== '' && 'is-error',
            state === 'ok' && 'is-ok',
          )}
          type="text"
          inputMode="numeric"
          maxLength={1}
          autoComplete="one-time-code"
          aria-label={`Digit ${index + 1}`}
          value={digit}
          disabled={disabled}
          onChange={(event) => handleChange(index, event.target.value)}
          onKeyDown={(event) => handleKeyDown(index, event)}
          onPaste={(event) => handlePaste(index, event)}
        />
      ))}
    </div>
  );
}
