'use client';

/**
 * Client component: it holds React state and/or wraps a Radix primitive, so it
 * must sit on the client side of the App Router boundary. Server components can
 * still render it — the directive only marks where the boundary is.
 */
import type * as React from 'react';
import * as ToastPrimitive from '@radix-ui/react-toast';
import { cn } from '@vunvault/lib';
import { Check, CircleAlert, Info, TriangleAlert, X } from 'lucide-react';
import { useToastStore, type ToastItem, type ToastKind } from '../lib/toast-store';

export const ToastProvider = ToastPrimitive.Provider;
export const ToastViewport = ToastPrimitive.Viewport;

/**
 * Per-kind accent: border colour, icon and icon colour.
 * `ok` uses `--ok` at 80% rather than a new hex literal.
 */
const KIND_STYLES: Record<ToastKind, { border: string; icon: React.ReactNode }> = {
  ok: { border: 'border-ok/40', icon: <Check size={16} className="text-ok/80" /> },
  warn: { border: 'border-high/40', icon: <TriangleAlert size={16} className="text-high" /> },
  crit: { border: 'border-critical/40', icon: <CircleAlert size={16} className="text-critical" /> },
  info: { border: 'border-brand/32', icon: <Info size={16} className="text-brand-soft" /> },
};

/**
 * Foreground toasts (`crit`, `warn`) are announced assertively — Radix renders
 * them with `role="alert"`. `ok` and `info` are background toasts (`role="status"`)
 * so a routine success never interrupts a screen reader mid-sentence.
 */
function toastType(kind: ToastKind): 'foreground' | 'background' {
  return kind === 'crit' || kind === 'warn' ? 'foreground' : 'background';
}

/**
 * Radix always renders its off-screen announcer as `role="status"` and only
 * varies `aria-live`, so the visible toast carries the role itself: `alert` for
 * the assertive kinds, `status` for the polite ones.
 */
function toastRole(kind: ToastKind): 'alert' | 'status' {
  return kind === 'crit' || kind === 'warn' ? 'alert' : 'status';
}

function ToastCard({ item, onClosed }: { item: ToastItem; onClosed: (id: string) => void }) {
  const style = KIND_STYLES[item.kind];

  return (
    <ToastPrimitive.Root
      role={toastRole(item.kind)}
      type={toastType(item.kind)}
      duration={item.durationMs}
      open={item.open}
      onOpenChange={(open) => {
        if (!open) onClosed(item.id);
      }}
      className={cn(
        'pointer-events-auto flex items-start gap-[11px] rounded-toast border px-4 py-[13px]',
        'bg-[linear-gradient(160deg,var(--dark),var(--dark-deep))] shadow-toast',
        'text-[0.76rem] leading-[1.55] text-slate-text',
        'data-[state=open]:animate-vv-toast-in data-[state=closed]:animate-vv-toast-out',
        style.border,
      )}
    >
      <span className="mt-px shrink-0" aria-hidden="true">
        {style.icon}
      </span>
      <div className="grid gap-0.5">
        <ToastPrimitive.Title className="font-extrabold text-white">
          {item.title}
        </ToastPrimitive.Title>
        {item.message ? (
          <ToastPrimitive.Description className="text-slate-text">
            {item.message}
          </ToastPrimitive.Description>
        ) : null}
      </div>
      <ToastPrimitive.Close
        className={cn(
          'ml-auto inline-grid size-6 shrink-0 place-items-center rounded-full text-slate-muted',
          'outline-none transition-colors duration-200 ease-vv hover:text-white',
        )}
        aria-label="Dismiss notification"
      >
        <X size={14} aria-hidden="true" />
      </ToastPrimitive.Close>
    </ToastPrimitive.Root>
  );
}

/**
 * Mount once, at the app root. Renders every toast in the store into a fixed
 * bottom-left viewport; individual toasts re-enable pointer events.
 */
export function Toaster() {
  const toasts = useToastStore((state) => state.toasts);
  const remove = useToastStore((state) => state.remove);

  return (
    <ToastProvider swipeDirection="down">
      {toasts.map((item) => (
        <ToastCard key={item.id} item={item} onClosed={remove} />
      ))}
      <ToastPrimitive.Viewport
        className={cn(
          'pointer-events-none fixed bottom-5 left-5 z-[400] flex max-w-[min(360px,calc(100vw-40px))]',
          'flex-col gap-2.5',
        )}
      />
    </ToastProvider>
  );
}
