import Link from 'next/link';

/**
 * Contact routing + emergency line for the team section.
 *
 * Every route below uses a name and role already published on this page —
 * nothing invented, no credentials or statistics claimed. The incident line
 * repeats the 24/7 escalation channel from the contact page's operational
 * info; no response-time number is published because none is guaranteed.
 */

const ROUTES: readonly { need: string; person: string; role: string; href: string }[] = [
  {
    need: 'SACCO, CBK & SASRA compliance',
    person: 'Raphunga Tshepiso',
    role: 'Research Analyst',
    href: '/contact?category=general_support#contact-form',
  },
  {
    need: 'Penetration testing & red team scoping',
    person: 'Jaymit Sarena',
    role: 'Security Analyst VAPT',
    href: '/contact?category=penetration_testing_request#contact-form',
  },
  {
    need: 'Active incident / emergency',
    person: 'Daniel Okafor',
    role: 'Security and Project Coordinator',
    href: 'mailto:support@vunvault.com',
  },
];

export function ContactRouting() {
  return (
    <div className="vv-routing space-y-6">
      <div className="rounded-2xl border border-neutral-200 bg-white p-6 sm:p-7">
        <h3 className="text-sm font-extrabold uppercase tracking-[0.14em] text-cyan-700">
          Who to ask for what
        </h3>
        <ul className="mt-4 space-y-3">
          {ROUTES.map((route) => (
            <li key={route.need} className="flex flex-wrap items-baseline gap-x-2 text-sm">
              <span className="font-bold text-neutral-900">{route.need} →</span>
              <Link
                className="font-semibold text-cyan-700 underline underline-offset-2"
                href={route.href}
              >
                {route.person}
              </Link>
              <span className="text-neutral-500">({route.role})</span>
            </li>
          ))}
          <li className="flex flex-wrap items-baseline gap-x-2 text-sm">
            <span className="font-bold text-neutral-900">General enquiries →</span>
            <Link
              className="font-semibold text-cyan-700 underline underline-offset-2"
              href="/contact#contact-form"
            >
              the contact form
            </Link>
          </li>
        </ul>
      </div>
      <EmergencyBand />
    </div>
  );
}

export function EmergencyBand() {
  return (
    <aside
      aria-label="24/7 incident line"
      className="rounded-2xl border border-rose-200 bg-rose-50 p-6 sm:p-7"
    >
      <h3 className="text-sm font-extrabold uppercase tracking-[0.14em] text-rose-700">
        Active incident, right now?
      </h3>
      <p className="mt-3 text-sm leading-relaxed text-neutral-700">
        The 24/7 escalation line is{' '}
        <a
          className="font-bold text-rose-700 underline underline-offset-2"
          href="mailto:support@vunvault.com"
        >
          support@vunvault.com
        </a>{' '}
        — monitored around the clock by the duty coordinator, currently Daniel Okafor (Security and
        Project Coordinator). We do not publish a response-time number we cannot guarantee; triage
        begins as soon as the duty coordinator is paged, and every incident gets a named lead.
      </p>
    </aside>
  );
}
