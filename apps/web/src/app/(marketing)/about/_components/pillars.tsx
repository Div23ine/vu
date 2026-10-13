'use client';

import { Check, Crosshair, GraduationCap, Scale } from 'lucide-react';
import { cn } from '@vunvault/lib';
import { useReveal } from './about-hero';
import '../_styles/about.css';

/**
 * Core Pillars (Task 53) — three disciplines, verbatim copy and bullet lists.
 */

const PILLARS = [
  {
    num: '01',
    title: 'Precision Offense',
    text: 'Adversary emulation that mirrors the tradecraft actually landing on East African targets — not a generic scanner dump.',
    items: [
      'Web, API and mobile penetration testing',
      'Custom fuzzing pipelines & zero-day research',
      'Purple-team validation against your SIEM rules',
    ],
    Icon: Crosshair,
  },
  {
    num: '02',
    title: 'Regulatory Mastery',
    text: 'Findings mapped to the framework your regulator actually cites — so remediation doubles as evidence.',
    items: [
      'Central Bank of Kenya cyber requirements',
      'Kenya Data Protection Act & GDPR alignment',
      'ISO 27001 / SOC 2 control evidence',
    ],
    Icon: Scale,
  },
  {
    num: '03',
    title: 'Capacity Building',
    text: 'A finding you can’t reproduce is a finding you can’t fix. We train your team to hold the line after we leave.',
    items: [
      'VUNVAULT Academy learning tracks',
      'Developer secure-coding workshops',
      'Incident-response tabletop exercises',
    ],
    Icon: GraduationCap,
  },
] as const;

export function Pillars() {
  const reveals = [useReveal<HTMLElement>(), useReveal<HTMLElement>(), useReveal<HTMLElement>()];

  return (
    <section className="vv-section" id="pillars">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        <div className="max-w-3xl space-y-4">
          <span className="vv-eyebrow">Core Pillars</span>
          <h2 className="vv-h2">Three disciplines. One engagement.</h2>
          <p className="vv-body max-w-2xl">
            Every VUNVAULT engagement is delivered against the same three pillars — the technical,
            the regulatory and the human. Drop one and the other two collapse.
          </p>
        </div>

        <div className="vv-pillar-grid">
          {PILLARS.map((pillar, index) => {
            const reveal = reveals[index];
            return (
              <article
                key={pillar.num}
                ref={reveal?.ref}
                className={cn('vv-pillar', reveal?.className)}
              >
                <div className="flex items-center gap-3">
                  <span className="vv-pillar-icon" aria-hidden="true">
                    <pillar.Icon size={22} />
                  </span>
                  <span className="vv-pillar-num">{pillar.num}</span>
                </div>
                <h3 className="vv-h3">{pillar.title}</h3>
                <p className="vv-body">{pillar.text}</p>
                <ul className="vv-pillar-list">
                  {pillar.items.map((item) => (
                    <li key={item}>
                      <Check size={14} aria-hidden="true" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
