'use client';

import { useState } from 'react';
import { Preloader } from '@vunvault/ui';

/**
 * Preloader gate (Task 44).
 *
 * Renders the Task 13 `<Preloader />` ONCE per full page load — tracked by a
 * module-level boolean, never by web storage — and on completion dispatches
 * `vunvault:preloader-done` on `document` (the cookie-consent banner listens
 * for it in Task 58). SSR renders the preloader markup, so there is no flash
 * of content before the gate mounts; under reduced motion the Preloader's own
 * sequence is already collapsed to 800ms (Task 13).
 *
 * The Preloader owns its lifecycle (visible → `is-hidden` fade → unmount →
 * `onDone`); this gate flips to `null` on `onDone` so client-side navigations
 * within the page load never replay the sequence.
 */

/** Dispatched on `document` when the first-load preloader completes. */
export const PRELOADER_DONE_EVENT = 'vunvault:preloader-done';

let shownThisPageLoad = false;

export function PreloaderGate() {
  const [done, setDone] = useState(shownThisPageLoad);

  if (done) return null;

  return (
    <Preloader
      onDone={() => {
        shownThisPageLoad = true;
        setDone(true);
        document.dispatchEvent(new CustomEvent(PRELOADER_DONE_EVENT));
      }}
    />
  );
}
