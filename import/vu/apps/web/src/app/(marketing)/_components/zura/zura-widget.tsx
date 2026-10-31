'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { env } from '../../../../env';
import { matchKnowledge, ZURA_SUGGESTIONS } from './zura-kb';

/**
 * Zura — VUNVAULT's floating assistant, mounted once from the marketing
 * layout so it follows the visitor across every public page.
 *
 * Brains, in order (the operator's rule: knowledge base first, the LLM
 * endpoint when it is ready):
 *  1. `matchKnowledge` answers verbatim from `qa-data.ts` — VUNVAULT's own
 *     published copy. Deterministic, offline, never invents.
 *  2. If — and only if — `NEXT_PUBLIC_ZURA_LLM_URL` is set at build time, a
 *     question the KB cannot answer is POSTed there (`{ question, history }`,
 *     answering `{ answer }` or an OpenAI-style `choices[0].message.content`).
 *     The origin is added to the CSP `connect-src` by the middleware.
 *  3. No KB match and no usable endpoint answer → Zura says it does not know
 *     and points at the contact form. Honesty beats a confident guess.
 *
 * The panel is a labelled dialog: Escape closes and returns focus to the
 * launcher, the transcript is an `aria-live` log, and the input carries a
 * screen-reader label plus a visible placeholder.
 */

interface ZuraMessage {
  id: number;
  role: 'user' | 'zura';
  text: string;
  pending?: boolean;
}

const GREETING =
  'I’m Zura, VUNVAULT’s assistant. I answer from VUNVAULT’s published information — plans, billing, engagements, the scanner. What would you like to know?';

const FALLBACK =
  'I don’t have a published answer for that yet — I answer from VUNVAULT’s own information, never guesses. Try plans, pricing, billing or the scanner, or reach a human via the contact form.';

const LLM_TIMEOUT_MS = 8000;
const MAX_LLM_ANSWER = 1500;

/** `{ answer }`, `{ data: { answer } }` or OpenAI-style chat completions. */
function extractAnswer(payload: unknown): string | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const record = payload as Record<string, unknown>;
  if (typeof record.answer === 'string' && record.answer.trim() !== '') return record.answer;
  if (typeof record.data === 'object' && record.data !== null) {
    const nested = (record.data as Record<string, unknown>).answer;
    if (typeof nested === 'string' && nested.trim() !== '') return nested;
  }
  const choices = record.choices;
  if (Array.isArray(choices) && choices.length > 0) {
    const content = (choices[0] as { message?: { content?: unknown } })?.message?.content;
    if (typeof content === 'string' && content.trim() !== '') return content;
  }
  return null;
}

async function askLlm(question: string, history: ZuraMessage[]): Promise<string | null> {
  const url = env.NEXT_PUBLIC_ZURA_LLM_URL;
  if (url === undefined) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        question,
        history: history
          .slice(-6)
          .map((message) => ({ role: message.role, content: message.text })),
      }),
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const answer = extractAnswer(await response.json());
    return answer === null ? null : answer.slice(0, MAX_LLM_ANSWER);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export function ZuraWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ZuraMessage[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const idRef = useRef(1);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([{ id: 0, role: 'zura', text: GREETING }]);
    }
  }, [open, messages.length]);

  useEffect(() => {
    const log = logRef.current;
    if (log !== null) log.scrollTop = log.scrollHeight;
  }, [messages]);

  // Escape closes from anywhere on the page (focus usually sits on the
  // launcher or the input); a Radix modal eating the key first wins.
  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      setOpen(false);
      launcherRef.current?.focus();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  async function ask(question: string) {
    const trimmed = question.trim();
    if (trimmed === '' || busy) return;
    setBusy(true);
    setInput('');
    const userMessage: ZuraMessage = { id: idRef.current++, role: 'user', text: trimmed };
    const history = [...messages, userMessage];
    setMessages(history);

    const match = matchKnowledge(trimmed);
    if (match !== null) {
      setMessages([...history, { id: idRef.current++, role: 'zura', text: match.entry.a }]);
      setBusy(false);
      return;
    }

    const pendingId = idRef.current++;
    setMessages([...history, { id: pendingId, role: 'zura', text: 'Thinking…', pending: true }]);
    const answer = await askLlm(trimmed, history);
    setMessages((previous) =>
      previous.map((message) =>
        message.id === pendingId
          ? { ...message, text: answer ?? FALLBACK, pending: false }
          : message,
      ),
    );
    setBusy(false);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void ask(input);
  }

  return (
    <>
      <button
        ref={launcherRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="zura-panel"
        onClick={() => setOpen((value) => !value)}
        className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-cyan-700 px-4 py-3 text-sm font-bold text-white shadow-xl transition hover:bg-cyan-800"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z"
            fill="currentColor"
          />
          <circle cx="19" cy="19" r="2" fill="currentColor" />
        </svg>
        Zura
      </button>

      {open && (
        <div
          id="zura-panel"
          role="dialog"
          aria-label="Zura, the VUNVAULT assistant"
          className="fixed bottom-24 right-5 z-40 flex w-[min(22rem,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-2xl"
        >
          <header className="flex items-start justify-between gap-3 border-b border-neutral-200 bg-cyan-50/60 px-4 py-3">
            <div>
              <p className="text-sm font-extrabold text-neutral-900">Zura</p>
              <p className="text-[11px] leading-snug text-neutral-500">
                Answers from VUNVAULT’s published information — never guesses.
              </p>
            </div>
            <button
              type="button"
              aria-label="Close Zura"
              onClick={() => {
                setOpen(false);
                launcherRef.current?.focus();
              }}
              className="rounded-lg px-2 py-1 text-sm font-bold text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
            >
              ✕
            </button>
          </header>

          <div
            ref={logRef}
            role="log"
            aria-live="polite"
            aria-label="Zura conversation"
            className="max-h-80 space-y-2 overflow-y-auto px-4 py-3"
          >
            {messages.map((message) => (
              <p
                key={message.id}
                className={`max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-relaxed ${
                  message.role === 'user'
                    ? 'ml-auto bg-cyan-700 text-white'
                    : 'bg-neutral-100 text-neutral-700'
                } ${message.pending === true ? 'opacity-60' : ''}`}
              >
                {message.text}
              </p>
            ))}
            {messages.length === 1 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {ZURA_SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => void ask(suggestion)}
                    className="rounded-full border border-cyan-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-cyan-700 hover:bg-cyan-50"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
          </div>

          <form
            onSubmit={submit}
            noValidate
            className="flex items-center gap-2 border-t border-neutral-200 px-3 py-2.5"
          >
            <label htmlFor="zura-input" className="sr-only">
              Your question for Zura
            </label>
            <input
              id="zura-input"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask about plans, billing, engagements…"
              className="min-w-0 flex-1 rounded-xl border border-neutral-300 bg-white px-3 py-2 text-xs text-neutral-900 placeholder:text-neutral-400 focus:border-cyan-600 focus:outline-none"
            />
            <button
              type="submit"
              disabled={busy || input.trim() === ''}
              className="rounded-xl bg-cyan-700 px-3 py-2 text-xs font-bold text-white hover:bg-cyan-800 disabled:opacity-50"
            >
              Send
            </button>
          </form>
        </div>
      )}
    </>
  );
}
