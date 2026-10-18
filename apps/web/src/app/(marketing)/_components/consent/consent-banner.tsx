'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { CONSENT_ACCEPT_ALL, CONSENT_ESSENTIAL_ONLY } from '@vunvault/contracts';
import type { ContactCategories } from '@vunvault/contracts';
import { cn } from '@vunvault/lib';
import { toast } from '@vunvault/ui';
import { useRecordConsent } from '../../_hooks/use-record-consent';
import { CONSENT_POLICY_VERSION, ConsentProvider, useConsentStore } from './consent-store';
import '../../_styles/consent.css';

/**
 * Cookie consent banner — mounted from the marketing layout.
 *
 * Mount rules: the dialog appears as soon as the layout mounts, unless the
 * decision is already known (the API-set `vv_consent` cookie or an in-memory
 * decision). The first-load preloader gate (and its `vunvault:preloader-done`
 * event / 6 s fallback) was removed with the preloader, so nothing delays the
 * banner any more. Escape does NOT dismiss it — a choice is required — and
 * the first button is focused with `preventScroll`.
 *
 * Recording: `POST /api/v1/consent` `{ categories, policyVersion: "1" }`;
 * on `204` the banner adds `is-leaving`, unmounts after 400 ms and drops
 * `vv-consent-open` from `<body>`; on failure it stays open and toasts
 * `{ kind: "warn", title: "Could not save your choice", message: "Please try
 * again." }` — a network failure stays undecided.
 *
 * The markup's `aria-modal="true"` is kept verbatim even though the behaviour
 * note calls the dialog non-modal: no focus trap is specified and Escape must
 * not close it, so the banner is an alert-style choice prompt — disclosed in
 * the task report.
 */

type Prefs = ContactCategories;
type ToggleKey = 'analytics' | 'marketing' | 'functional';

const TOGGLEABLE: { key: ToggleKey; name: string; desc: string }[] = [
  {
    key: 'analytics',
    name: 'Analytics',
    desc: 'Aggregated, anonymised measurement of which advisories, courses and service pages are actually being used.',
  },
  {
    key: 'marketing',
    name: 'Marketing',
    desc: 'Used to measure campaign reach and avoid showing you the same security briefing twice.',
  },
  {
    key: 'functional',
    name: 'Functional',
    desc: 'Remembers interface choices such as theme, dashboard layout and collapsed panels between visits.',
  },
];

const LEAVE_MS = 400;

function ConsentDialog() {
  const decided = useConsentStore((state) => state.decided);
  const leaving = useConsentStore((state) => state.leaving);
  const record = useRecordConsent();

  const [shown, setShown] = useState(false);
  /** Second frame flag so the mounted dialog transitions in (opacity/transform). */
  const [visibleClass, setVisibleClass] = useState(false);
  const [gone, setGone] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [prefs, setPrefs] = useState<Prefs>({ ...CONSENT_ESSENTIAL_ONLY });
  const [announcement, setAnnouncement] = useState('');

  const acceptRef = useRef<HTMLButtonElement>(null);
  const customizeRef = useRef<HTMLButtonElement>(null);
  const firstSwitchRef = useRef<HTMLInputElement>(null);

  // Mount rules: show on mount unless a decision is already known.
  useEffect(() => {
    if (useConsentStore.getState().decided) return;
    setShown(true);
  }, []);

  // Visible: lock marker on <body> + focus the first button (preventScroll),
  // then flip `is-visible` on the next tick so the CSS transition actually runs.
  useEffect(() => {
    if (!shown) return;
    document.body.classList.add('vv-consent-open');
    acceptRef.current?.focus({ preventScroll: true });
    const flip = setTimeout(() => setVisibleClass(true), 20);
    return () => clearTimeout(flip);
  }, [shown]);

  // Success: 400 ms after `is-leaving`, unmount and release the body class.
  useEffect(() => {
    if (!leaving) return;
    const timer = setTimeout(() => {
      document.body.classList.remove('vv-consent-open');
      setGone(true);
    }, LEAVE_MS);
    return () => clearTimeout(timer);
  }, [leaving]);

  const submit = useCallback(
    async (categories: Prefs) => {
      try {
        await record.mutateAsync({ categories, policyVersion: CONSENT_POLICY_VERSION });
        const store = useConsentStore.getState();
        store.markDecided(categories);
        store.setLeaving();
      } catch {
        // Optimistically undecided: the banner stays open.
        toast({
          kind: 'warn',
          title: 'Could not save your choice',
          message: 'Please try again.',
        });
      }
    },
    [record],
  );

  // Not in the DOM until shown (mount rules above), gone after the leave
  // transition; a decided store keeps it away on the next mount.
  if (gone || !shown || (decided && !leaving)) return null;

  const toggle = (key: ToggleKey, name: string) => {
    const next: Prefs = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    setAnnouncement(`${name} cookies ${next[key] ? 'enabled' : 'disabled'}`);
  };

  const openPanel = () => {
    setPanelOpen(true);
    setAnnouncement('Preference panel opened');
    setTimeout(() => firstSwitchRef.current?.focus({ preventScroll: true }), 0);
  };

  const closePanel = () => {
    setPanelOpen(false);
    setAnnouncement('Returned to quick choices');
    customizeRef.current?.focus({ preventScroll: true });
  };

  return (
    <div
      className={cn('vv-consent', visibleClass && 'is-visible', leaving && 'is-leaving')}
      id="vv-consent"
      role="dialog"
      aria-modal="true"
      aria-labelledby="vv-consent-title"
      aria-describedby="vv-consent-desc"
    >
      <div className="vv-consent-backdrop" aria-hidden="true" />
      <div className="vv-consent-card" role="document">
        <span className="vv-consent-rule" aria-hidden="true" />
        <header className="vv-consent-head">
          <span className="vv-consent-eyebrow">
            <span className="vv-consent-eyebrow-dot" aria-hidden="true" />
            Privacy &amp; Consent
          </span>
          <h2 className="vv-consent-title" id="vv-consent-title">
            We value your privacy
          </h2>
          <p className="vv-consent-desc" id="vv-consent-desc">
            VUNVAULT uses a small set of cookies to keep this site secure, remember your preferences
            and understand how our threat intelligence is used. Strictly necessary cookies are
            always active — everything else is your call.
          </p>
        </header>

        <ul className="vv-consent-chips" aria-label="Cookie categories at a glance">
          <li className="vv-consent-chip is-locked">
            Strictly Necessary <b>Always on</b>
          </li>
          {TOGGLEABLE.map(({ key, name }) => (
            <li key={key} className={cn('vv-consent-chip', prefs[key] && 'is-on')}>
              {name} <b>{prefs[key] ? 'On' : 'Off'}</b>
            </li>
          ))}
        </ul>

        <section className="vv-consent-prefs" hidden={!panelOpen} aria-label="Cookie preferences">
          <div className="vv-pref">
            <div className="vv-pref-text">
              <h3 className="vv-pref-name">Strictly Necessary</h3>
              <p className="vv-pref-desc">
                Authentication, session integrity, CSRF protection and load balancing. Required for
                the site to function and cannot be disabled.
              </p>
            </div>
            <label className="vv-pref-switch vv-pref-switch--locked">
              <input
                type="checkbox"
                checked
                readOnly
                disabled
                aria-label="Strictly necessary cookies — always active"
              />
              <span className="vv-pref-track" aria-hidden="true">
                <span className="vv-pref-knob" />
              </span>
              <span className="vv-pref-state">Always on</span>
            </label>
          </div>

          {TOGGLEABLE.map(({ key, name, desc }, index) => (
            <div className="vv-pref" key={key}>
              <div className="vv-pref-text">
                <h3 className="vv-pref-name">{name}</h3>
                <p className="vv-pref-desc">{desc}</p>
              </div>
              <label className="vv-pref-switch">
                <input
                  type="checkbox"
                  checked={prefs[key]}
                  onChange={() => toggle(key, name)}
                  aria-label={`${name} cookies`}
                  ref={index === 0 ? firstSwitchRef : undefined}
                />
                <span className="vv-pref-track" aria-hidden="true">
                  <span className="vv-pref-knob" />
                </span>
                <span className="vv-pref-state">{prefs[key] ? 'On' : 'Off'}</span>
              </label>
            </div>
          ))}

          <div className="vv-consent-prefs-actions">
            <button
              type="button"
              className="vv-consent-btn vv-consent-btn--ghost"
              data-vv-consent="back"
              onClick={closePanel}
            >
              Back
            </button>
            <button
              type="button"
              className="vv-consent-btn vv-consent-btn--primary"
              data-vv-consent="save"
              disabled={record.isPending}
              onClick={() => void submit(prefs)}
            >
              Save Preferences
            </button>
          </div>
        </section>

        <div className="vv-consent-actions" hidden={panelOpen}>
          <button
            type="button"
            className="vv-consent-btn vv-consent-btn--primary"
            data-vv-consent="accept-all"
            ref={acceptRef}
            disabled={record.isPending}
            onClick={() => void submit({ ...CONSENT_ACCEPT_ALL })}
          >
            Accept All
          </button>
          <button
            type="button"
            className="vv-consent-btn vv-consent-btn--ghost"
            data-vv-consent="essential-only"
            disabled={record.isPending}
            onClick={() => void submit({ ...CONSENT_ESSENTIAL_ONLY })}
          >
            Essential Only
          </button>
          <button
            type="button"
            className="vv-consent-btn vv-consent-btn--link"
            data-vv-consent="customize"
            ref={customizeRef}
            onClick={openPanel}
          >
            Customize Preferences
          </button>
        </div>

        <footer className="vv-consent-foot">
          <span>
            Read our <Link href="/privacy">Privacy Policy</Link> &amp;{' '}
            <Link href="/cookie-policy">Cookie Policy</Link>.
          </span>
          <span className="vv-consent-live" role="status" aria-live="polite">
            {announcement}
          </span>
        </footer>
      </div>
    </div>
  );
}

/**
 * The exported banner: the provider (cookie re-check) wrapping the dialog, so
 * the marketing layout mounts exactly one element.
 */
export function ConsentBanner() {
  return (
    <ConsentProvider>
      <ConsentDialog />
    </ConsentProvider>
  );
}
