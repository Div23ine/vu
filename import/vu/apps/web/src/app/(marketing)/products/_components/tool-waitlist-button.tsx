'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useJoinWaitlist } from '../../_hooks/use-join-waitlist';

/**
 * Per-tool waitlist button for open tools whose artifact is not published
 * yet: the card stays listed, and the visitor can reserve first access with
 * an email address — no account, no file required.
 */
export function ToolWaitlistButton({ toolId, toolName }: { toolId: string; toolName: string }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'done' | 'error'>('idle');
  const inputRef = useRef<HTMLInputElement>(null);
  const join = useJoinWaitlist();

  useEffect(() => {
    if (open) inputRef.current?.focus({ preventScroll: true });
  }, [open]);

  if (status === 'done') {
    return (
      <p role="status" className="vv-tool-waitlist-done">
        You are on the list for {toolName}.
      </p>
    );
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    join.mutate(
      { email, topic: toolId },
      {
        onSuccess: () => setStatus('done'),
        onError: () => setStatus('error'),
      },
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        className="vv-tool-waitlist"
        onClick={() => setOpen(true)}
        title={`Join the waitlist for ${toolName}`}
      >
        Join the waitlist
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="vv-tool-waitlist-form">
      <label className="sr-only" htmlFor={`waitlist-${toolId}`}>
        Email address for the {toolName} waitlist
      </label>
      <input
        id={`waitlist-${toolId}`}
        type="email"
        required
        ref={inputRef}
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="you@company.com"
      />
      <button type="submit" disabled={join.isPending}>
        {join.isPending ? 'Joining…' : 'Notify me'}
      </button>
      {status === 'error' && (
        <span role="alert" className="vv-tool-waitlist-error">
          Try again
        </span>
      )}
    </form>
  );
}
