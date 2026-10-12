'use client';

import { useEffect, useRef } from 'react';
import { Bell, Image, KeyRound, UserRound } from 'lucide-react';

/**
 * Profile tab bar (Task 83c) — a real ARIA `tablist`.
 *
 * The active tab lives in the URL hash so a deep link works: the invitation
 * flow sends staff to `/admin/profile#security` and they must land on the
 * credentials tab, not on Personal Details. Hashes are `#personal`,
 * `#picture`, `#security`, `#notifications`; an unknown or absent hash falls
 * back to the first tab.
 *
 * Keyboard behaviour is the WAI-ARIA tabs pattern: Left/Right (and Home/End)
 * move both focus and selection, and each panel is reachable with Tab because
 * it carries `tabIndex={0}`.
 */

export type ProfileTabId = 'personal' | 'picture' | 'security' | 'notifications';

export const PROFILE_TABS: readonly {
  id: ProfileTabId;
  label: string;
  icon: typeof UserRound;
}[] = [
  { id: 'personal', label: 'Personal Details', icon: UserRound },
  { id: 'picture', label: 'Profile Picture', icon: Image },
  { id: 'security', label: 'Password & 2FA', icon: KeyRound },
  { id: 'notifications', label: 'Notifications', icon: Bell },
] as const;

export const DEFAULT_TAB: ProfileTabId = 'personal';

/** `#security` → `'security'`; anything unrecognised → the default tab. */
export function tabFromHash(hash: string): ProfileTabId {
  const raw = hash.replace(/^#/, '');
  const found = PROFILE_TABS.find((tab) => tab.id === raw);
  return found === undefined ? DEFAULT_TAB : found.id;
}

export interface ProfileTabsProps {
  active: ProfileTabId;
  onSelect(id: ProfileTabId): void;
}

export function ProfileTabs({ active, onSelect }: ProfileTabsProps) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  // Follow the hash when the browser moves (back/forward, or the invite deep
  // link arriving after mount).
  useEffect(() => {
    const onHashChange = (): void => {
      onSelect(tabFromHash(window.location.hash));
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [onSelect]);

  const move = (from: ProfileTabId, delta: number): void => {
    const index = PROFILE_TABS.findIndex((tab) => tab.id === from);
    const next = PROFILE_TABS[(index + delta + PROFILE_TABS.length) % PROFILE_TABS.length];
    if (next === undefined) return;
    onSelect(next.id);
    refs.current[next.id]?.focus();
  };

  const onKeyDown = (event: React.KeyboardEvent, id: ProfileTabId): void => {
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      move(id, 1);
      return;
    }
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      move(id, -1);
      return;
    }
    if (event.key === 'Home') {
      event.preventDefault();
      const first = PROFILE_TABS[0];
      if (first === undefined) return;
      onSelect(first.id);
      refs.current[first.id]?.focus();
      return;
    }
    if (event.key === 'End') {
      event.preventDefault();
      const last = PROFILE_TABS[PROFILE_TABS.length - 1];
      if (last === undefined) return;
      onSelect(last.id);
      refs.current[last.id]?.focus();
    }
  };

  return (
    // A `tablist` is an interactive role, so the container is a plain `div`
    // rather than a `<nav>` (jsx-a11y forbids the pairing); the tabs themselves
    // are the navigation and the label names the group.
    <div className="ps-tabs" role="tablist" aria-label="Profile settings sections">
      {PROFILE_TABS.map((tab) => {
        const Icon = tab.icon;
        const selected = tab.id === active;
        return (
          <button
            key={tab.id}
            ref={(node) => {
              refs.current[tab.id] = node;
            }}
            type="button"
            className="ps-tab"
            role="tab"
            id={`ps-tab-${tab.id}`}
            aria-controls={`ps-panel-${tab.id}`}
            aria-selected={selected}
            // Roving tabindex: one stop in the tab list, per the ARIA pattern.
            tabIndex={selected ? 0 : -1}
            onClick={() => onSelect(tab.id)}
            onKeyDown={(event) => onKeyDown(event, tab.id)}
          >
            <Icon size={14} aria-hidden="true" />
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
