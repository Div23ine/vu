'use client';

import { useEffect, useState } from 'react';
import { cn } from '@vunvault/lib';
import '../_styles/services.css';

/**
 * Services page section tabs — the sticky row under the hero.
 *
 * `is-active` follows the scroll position (an IntersectionObserver watches the
 * section ids through a band across the upper viewport), and clicking a tab
 * smooth-scrolls to its section — instant under `prefers-reduced-motion`.
 * Sections belonging to an earlier iteration's stubs (`pricing`,
 * `request-assessment`) do not exist in the DOM yet; the observer simply
 * skips missing targets and they light up once 54b lands.
 *
 * The row's pill styling is authored in `services.css` (`.vv-svc-tabs`): the
 * catalog specifies the behaviour and the `ServiceTab` shape but embeds no
 * markup for the row itself.
 */

export interface ServiceTab {
  id: string;
  label: string;
}

export const SERVICE_TABS: readonly ServiceTab[] = [
  { id: 'free-tools', label: 'Free Tools' },
  { id: 'core-services', label: 'Core Services' },
  { id: 'pricing', label: 'Pricing' },
  { id: 'request-assessment', label: 'Request Assessment' },
];

export function ServiceTabs() {
  const [activeId, setActiveId] = useState<string>(SERVICE_TABS[0]?.id ?? '');

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const sections: HTMLElement[] = [];
    for (const tab of SERVICE_TABS) {
      const section = document.getElementById(tab.id);
      if (section !== null) sections.push(section);
    }
    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        const topmost = visible[0];
        if (topmost !== undefined) setActiveId(topmost.target.id);
      },
      { rootMargin: '-25% 0px -60% 0px', threshold: 0 },
    );
    for (const section of sections) observer.observe(section);
    return () => observer.disconnect();
  }, []);

  const handleSelect = (id: string) => {
    setActiveId(id);
    const section = document.getElementById(id);
    if (section === null) return;
    const reduceMotion =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    section.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  };

  return (
    <nav className="vv-svc-tabs" aria-label="Services sections">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="vv-svc-tabs-row no-scrollbar">
          {SERVICE_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={cn('vv-svc-tab', activeId === tab.id && 'is-active')}
              aria-current={activeId === tab.id ? 'true' : undefined}
              onClick={() => handleSelect(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
    </nav>
  );
}
