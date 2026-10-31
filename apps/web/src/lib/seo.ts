/**
 * SEO / AEO — the single source of truth for how this site describes itself to
 * crawlers, to search engines and to LLM-based answer engines.
 *
 * Everything machine-readable is derived from here so the surfaces cannot drift
 * apart: `app/robots.ts`, `app/sitemap.ts`, `app/llms.txt/route.ts`, the
 * Organisation + WebSite JSON-LD in the root layout and every page's canonical
 * URL all read the same constants and the same route table. A new public page is
 * added in exactly one place — `INDEXABLE_ROUTES` — and appears in the sitemap,
 * in `llms.txt` and in the robots policy at the same time.
 *
 * Design rules this file encodes:
 *
 * - **Never invent a fact.** The organisation data below (location, support and
 *   press addresses, support hours) is copied from what the site already
 *   publishes on `/contact` and in the footer. There is deliberately no `logo`
 *   and no `sameAs`: the repository ships only `public/brand/logo.svg`, and
 *   schema.org's `logo` requires a raster image of at least 112×112, while
 *   `sameAs` needs real profile URLs that do not exist yet. Both are listed in
 *   `docs/seo-runbook.md` as things to add once the assets do.
 * - **Canonical URLs are absolute.** `metadataBase` is set in the root layout,
 *   but canonicals are built through `siteUrl()` so the value is explicit and
 *   testable rather than dependent on resolution order.
 * - **Non-production builds are never indexable.** `robots.ts` emits a blanket
 *   `Disallow: /` unless the site URL is a real host, so a preview deployment or
 *   a laptop cannot leak into the index as duplicate content.
 */

import { env } from '../env';

/** Brand name, exactly as the wordmark renders. */
export const SITE_NAME = 'VUNVAULT';

/**
 * The spelling variants people actually type. "vunvault" is the query we most
 * need to own; `alternateName` is how schema.org expresses "same entity, other
 * spelling", which is what makes an LLM confident the two are one company.
 */
export const SITE_ALTERNATE_NAMES = ['VunVault', 'Vunvault', 'VUN VAULT'] as const;

export const SITE_TAGLINE = 'We Find The Cracks Before They Do';

/** Root-layout `description`; also the WebSite and Organisation description. */
export const SITE_DESCRIPTION =
  'Africa-rooted, worldwide penetration testing, vulnerability assessments and cybersecurity education.';

/** Primary language, BCP-47: content is English, the company is Kenyan. */
export const SITE_LOCALE = 'en_KE';

/** Facts copied verbatim from `/contact` and the footer. Do not invent more. */
export const ORGANISATION_FACTS = {
  email: 'support@vunvault.com',
  pressEmail: 'press@vunvault.com',
  addressLocality: 'Nairobi',
  /** ISO 3166-1 alpha-2, which is what schema.org's `addressCountry` wants. */
  addressCountry: 'KE',
  /** The prose form, for `llms.txt` — "Nairobi, KE" reads like a typo. */
  addressCountryName: 'Kenya',
  /** From the contact card: "Mon–Fri · 08:00–18:00 EAT". */
  supportHours: 'Mo-Fr 08:00-18:00',
  /** From the contact card: "24 / 7 escalation line". */
  incidentResponse: '24/7 escalation line',
} as const;

/**
 * Raster brand assets.
 *
 * Both are rendered from the repository's own `public/brand/logo.svg` monogram
 * (cropped to its measured artwork box, not eyeballed) — never AI-imagined — so
 * what a search engine or a share card shows is the actual mark. `logo-512.png`
 * exists because schema.org's `logo` requires a raster of at least 112×112 and
 * ignores the SVG; `og-default.png` exists because social crawlers do not render
 * SVG either. `docs/seo-runbook.md` records how they were produced so design can
 * regenerate or replace them without guessing.
 */
export const BRAND_ASSETS = {
  /** Square, transparent, for `Organization.logo`. */
  logoSquare: '/brand/logo-512.png',
  /** 1200×630 share card for Open Graph and Twitter. */
  ogImage: '/brand/og-default.png',
  ogWidth: 1200,
  ogHeight: 630,
  ogAlt: `${SITE_NAME} — ${SITE_TAGLINE}`,
} as const;

/** Absolute origin with no trailing slash, from the one validated env value. */
export function siteOrigin(): string {
  return env.NEXT_PUBLIC_SITE_URL.replace(/\/+$/, '');
}

/**
 * Absolute URL for an app-router path. `siteUrl('/')` keeps the trailing slash
 * (the canonical form of a root URL); every other path gets exactly one leading
 * slash and no trailing slash.
 */
export function siteUrl(path = '/'): string {
  if (path === '' || path === '/') return `${siteOrigin()}/`;
  const trimmed = path.replace(/^\/+/, '').replace(/\/+$/, '');
  return `${siteOrigin()}/${trimmed}`;
}

/** True when the configured site URL is a real, publicly reachable host. */
export function isPublicSiteUrl(origin = siteOrigin()): boolean {
  try {
    const url = new URL(origin);
    const host = url.hostname.toLowerCase();
    return (
      url.protocol === 'https:' &&
      host !== 'localhost' &&
      host !== '127.0.0.1' &&
      !host.endsWith('.local') &&
      !host.startsWith('192.168.') &&
      !host.startsWith('10.')
    );
  } catch {
    return false;
  }
}

/** How often a crawler should re-check a page, per the sitemaps protocol. */
export type ChangeFrequency = 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';

export interface SeoRoute {
  /** App Router path. `/` for the home page; no trailing slash elsewhere. */
  path: string;
  /** The published page title (matches that route's `metadata.title`). */
  title: string;
  /** One-line description used by `llms.txt` and by the runbook's URL table. */
  summary: string;
  changeFrequency: ChangeFrequency;
  /** 0.0–1.0 relative importance hint. Advisory only, but kept consistent. */
  priority: number;
  /** `llms.txt` heading this route is listed under. */
  group: SeoGroup;
}

/** The `llms.txt` sections, in presentation order. */
export const SEO_GROUPS = [
  'Company',
  'Services',
  'Products & pricing',
  'Policies & legal',
] as const;

export type SeoGroup = (typeof SEO_GROUPS)[number];

/** Routes bucketed by group, preserving `INDEXABLE_ROUTES` order within each. */
export function routesByGroup(): ReadonlyArray<{ group: SeoGroup; routes: readonly SeoRoute[] }> {
  return SEO_GROUPS.map((group) => ({
    group,
    routes: INDEXABLE_ROUTES.filter((route) => route.group === group),
  }));
}

/**
 * Every publicly indexable route, in the order `llms.txt` presents them.
 *
 * Deliberately EXCLUDED (see `NOINDEX_PATHS` / `NOINDEX_PREFIXES`):
 * `/academy` is a one-line placeholder the page itself marks `noindex`;
 * `/checkout*` is transactional and per-session; `/portal`, `/admin` and
 * `/onboarding` need a session; `/login`, `/signup`, `/accept-invite`,
 * `/newsletter/confirm` and `/forbidden` are flows, not content.
 *
 * Blog articles are NOT listed here — they are dynamic and are appended to the
 * sitemap by `app/sitemap.ts` from the public content API.
 */
export const INDEXABLE_ROUTES: readonly SeoRoute[] = [
  {
    path: '/',
    title: 'VUNVAULT — We Find The Cracks Before They Do',
    summary:
      'Offensive security and vulnerability management: scoped penetration testing, compliance assessment, continuous attack-surface monitoring and training, delivered from Nairobi to clients worldwide.',
    changeFrequency: 'weekly',
    priority: 1,
    group: 'Company',
  },
  {
    path: '/services',
    title: 'Services',
    summary:
      'The full service catalogue: penetration testing, vulnerability assessment, SACCO and fintech compliance, M-Pesa and API security review, and continuous monitoring retainers.',
    changeFrequency: 'monthly',
    priority: 0.9,
    group: 'Services',
  },
  {
    path: '/services/penetration-testing',
    title: 'Penetration Testing',
    summary:
      'Scoped penetration testing of web applications, APIs and network perimeters, mapped to OWASP ASVS and NIST SP 800-115, with manual validation of every automated finding and a redacted sample report.',
    changeFrequency: 'monthly',
    priority: 0.9,
    group: 'Services',
  },
  {
    path: '/services/sacco-compliance',
    title: 'SACCO & Fintech Compliance Assessment',
    summary:
      'Control mapping and gap assessment for SACCOs and fintechs against CBK and SASRA cyber risk guidance and the Kenya Data Protection Act 2019.',
    changeFrequency: 'monthly',
    priority: 0.8,
    group: 'Services',
  },
  {
    path: '/services/mpesa-api-security',
    title: 'M-Pesa & API Security',
    summary:
      'Security review of M-Pesa Daraja integrations and payment APIs: callbacks, credentials, personal data in payment payloads, and telco-side fraud controls.',
    changeFrequency: 'monthly',
    priority: 0.8,
    group: 'Services',
  },
  {
    path: '/products',
    title: 'Products',
    summary:
      'The VUNVAULT platform: attack-surface monitoring, vulnerability scanning, advisory intelligence and the client portal every engagement is delivered through.',
    changeFrequency: 'monthly',
    priority: 0.8,
    group: 'Products & pricing',
  },
  {
    path: '/pricing',
    title: 'Pricing',
    summary:
      'Starter assessments, SACCO and fintech compliance assessments and enterprise retainers. Transparent USD pricing with local-currency equivalents.',
    changeFrequency: 'weekly',
    priority: 0.8,
    group: 'Products & pricing',
  },
  {
    path: '/blog',
    title: 'Blog & Advisories',
    summary:
      'Published research, vulnerability advisories and security news from the VUNVAULT team, with CVE tracking and zero-day telemetry.',
    changeFrequency: 'daily',
    priority: 0.8,
    group: 'Company',
  },
  {
    path: '/about',
    title: 'About VUNVAULT — Africa-Rooted. Worldwide Defense.',
    summary:
      'Who VUNVAULT is, how the team works, the research and detection stack behind the engagements, and live telemetry from the zero-day tracking feed.',
    changeFrequency: 'monthly',
    priority: 0.6,
    group: 'Company',
  },
  {
    path: '/contact',
    title: 'Contact VUNVAULT',
    summary:
      'Reach the team for scoping calls, assessment scheduling, press or security disclosures. Based in Nairobi, Kenya; support Mon–Fri 08:00–18:00 EAT.',
    changeFrequency: 'yearly',
    priority: 0.6,
    group: 'Company',
  },
  {
    path: '/status',
    title: 'Status',
    summary: 'Live availability of the VUNVAULT API, database and exchange-rate feed.',
    changeFrequency: 'always',
    priority: 0.4,
    group: 'Company',
  },
  {
    path: '/responsible-disclosure',
    title: 'Responsible Disclosure',
    summary:
      "VUNVAULT's coordinated vulnerability disclosure policy: scope, safe harbour, timelines and the PGP channel, aligned with ISO/IEC 29147 and 30111.",
    changeFrequency: 'yearly',
    priority: 0.4,
    group: 'Policies & legal',
  },
  {
    path: '/privacy',
    title: 'Privacy Policy',
    summary:
      'How VUNVAULT collects, uses and protects personal data under the GDPR, the Australian Privacy Principles, the Kenya Data Protection Act and related laws.',
    changeFrequency: 'yearly',
    priority: 0.2,
    group: 'Policies & legal',
  },
  {
    path: '/terms',
    title: 'Terms of Service',
    summary:
      'The agreement governing use of the VUNVAULT website, portal and published tooling, with consumer protections under EU, UK, Australian and Kenyan law.',
    changeFrequency: 'yearly',
    priority: 0.2,
    group: 'Policies & legal',
  },
  {
    path: '/cookie-policy',
    title: 'Cookie Policy',
    summary:
      'Every cookie VUNVAULT sets, why it exists, how long it lives, and how to change or withdraw your choice under the ePrivacy Directive, GDPR and APPs.',
    changeFrequency: 'yearly',
    priority: 0.2,
    group: 'Policies & legal',
  },
];

/**
 * Individual pages that must be crawlable but not indexed. These get a
 * `noindex` meta tag and stay OUT of `robots.txt`'s disallow list: a disallowed
 * page cannot be crawled, so Google would never see the `noindex` and could
 * still list the bare URL from inbound links.
 */
export const NOINDEX_PATHS = [
  '/login',
  '/login/mfa',
  '/login/mfa/setup',
  '/signup',
  '/signup/enroll',
  '/accept-invite',
  '/newsletter/confirm',
  '/academy',
  '/checkout',
  '/checkout/cancelled',
] as const;

/**
 * Whole route groups that are private. These are DISALLOWED in `robots.txt`
 * (nothing public links to them, so crawling them is pure waste) and also carry
 * `noindex` from their group layout as a second line of defence.
 */
export const NOINDEX_PREFIXES = ['/portal', '/admin', '/onboarding'] as const;

/**
 * Server-to-server and per-session endpoints. Disallowed because they are not
 * pages at all — `/checkout/callback` is a payment-provider redirect target and
 * `/checkout/success/[reference]` is keyed to one order.
 */
export const DISALLOWED_PREFIXES = ['/checkout/callback', '/checkout/success', '/api'] as const;

/** Look a route up by path; `undefined` for anything not publicly indexable. */
export function findRoute(path: string): SeoRoute | undefined {
  return INDEXABLE_ROUTES.find((route) => route.path === path);
}

// ---------------------------------------------------------------------------
// JSON-LD builders.
//
// These return plain objects, not strings: `lib/json-ld.tsx` serialises them and
// escapes `<` so no value can break out of the script element. Keeping them as
// data makes them unit-testable without rendering.
// ---------------------------------------------------------------------------

/** Stable node ids so the graph can cross-reference without duplicating data. */
export const ORGANISATION_ID = '#organization';
export const WEBSITE_ID = '#website';

/** Absolute `@id` for a named node: `https://host/#organization`. */
function nodeId(fragment: string): string {
  return `${siteOrigin()}/${fragment}`;
}

/**
 * `Organization` — the entity answer to "what is vunvault".
 *
 * No `logo` (only an SVG exists; schema.org requires raster ≥112×112) and no
 * `sameAs` (no social profiles are published anywhere in this repository, and an
 * invented profile URL would damage entity disambiguation rather than help it).
 * Both are in the runbook's "add these next" list.
 */
export function organisationJsonLd(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': nodeId(ORGANISATION_ID),
    name: SITE_NAME,
    alternateName: [...SITE_ALTERNATE_NAMES],
    url: siteUrl('/'),
    logo: siteUrl(BRAND_ASSETS.logoSquare),
    slogan: SITE_TAGLINE,
    description: SITE_DESCRIPTION,
    email: ORGANISATION_FACTS.email,
    address: {
      '@type': 'PostalAddress',
      addressLocality: ORGANISATION_FACTS.addressLocality,
      addressCountry: ORGANISATION_FACTS.addressCountry,
    },
    contactPoint: [
      {
        '@type': 'ContactPoint',
        contactType: 'customer support',
        email: ORGANISATION_FACTS.email,
        areaServed: 'Worldwide',
        availableLanguage: ['English'],
        hoursAvailable: {
          '@type': 'OpeningHoursSpecification',
          dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
          opens: '08:00',
          closes: '18:00',
        },
      },
      {
        '@type': 'ContactPoint',
        contactType: 'press',
        email: ORGANISATION_FACTS.pressEmail,
        areaServed: 'Worldwide',
        availableLanguage: ['English'],
      },
    ],
    knowsAbout: [
      'Penetration testing',
      'Vulnerability assessment',
      'Attack surface management',
      'OWASP ASVS',
      'NIST SP 800-115',
      'SACCO cyber risk compliance',
      'Kenya Data Protection Act 2019',
      'M-Pesa Daraja API security',
      'Coordinated vulnerability disclosure',
    ],
  };
}

/**
 * `WebSite` — ties the origin to the organisation node.
 *
 * No `potentialAction`/`SearchAction`: the only public query surface is the
 * blog's client-side filter, not a site-wide search endpoint, and Google retired
 * the sitelinks-searchbox rich result in 2024. Claiming a search action the site
 * does not have is worse than omitting it.
 */
export function webSiteJsonLd(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': nodeId(WEBSITE_ID),
    url: siteUrl('/'),
    name: SITE_NAME,
    alternateName: [...SITE_ALTERNATE_NAMES],
    description: SITE_DESCRIPTION,
    inLanguage: 'en',
    publisher: { '@id': nodeId(ORGANISATION_ID) },
  };
}

/**
 * `FAQPage` from the Q&A knowledge base.
 *
 * IMPORTANT: only emit this on a page that visibly renders the same questions and
 * answers. Google requires FAQ markup to match on-page content, and since August
 * 2023 it only shows FAQ rich results for well-known authoritative government and
 * health sites — so the realistic value here is answer-engine grounding (an LLM
 * reading the page gets an unambiguous Q→A mapping), not a SERP snippet. Markup
 * with no matching visible text is a structured-data spam signal.
 *
 * The home page's `QaSection` component renders `HOME_QA` and is currently not
 * mounted on any page; wire this up together with that component, not before.
 */
export function faqJsonLd(
  entries: readonly { q: string; a: string }[],
): Record<string, unknown> | null {
  if (entries.length === 0) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: entries.map((entry) => ({
      '@type': 'Question',
      name: entry.q,
      acceptedAnswer: { '@type': 'Answer', text: entry.a },
    })),
  };
}

/**
 * `Service` for the catalogue routes, built from the route table so the sitemap,
 * `llms.txt` and the structured data cannot disagree about what a service is
 * called or does. Returns `null` for a path that is not publicly indexable, so a
 * typo surfaces as "no markup" rather than as a wrong claim.
 */
export function serviceJsonLd(path: string): Record<string, unknown> | null {
  const route = findRoute(path);
  if (route === undefined) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: route.title,
    serviceType: route.title,
    description: route.summary,
    url: siteUrl(path),
    provider: { '@id': nodeId(ORGANISATION_ID) },
    areaServed: { '@type': 'Place', name: 'Worldwide' },
    availableChannel: {
      '@type': 'ServiceChannel',
      serviceUrl: siteUrl('/contact'),
      availableLanguage: ['English'],
    },
  };
}

/**
 * `BreadcrumbList` for the nested service and article routes.
 * `items` are `{ name, path }` pairs, root-first, excluding the current page.
 */
export function breadcrumbJsonLd(
  items: readonly { name: string; path: string }[],
): Record<string, unknown> | null {
  if (items.length === 0) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: siteUrl(item.path),
    })),
  };
}

/**
 * `Article` for `/blog/[slug]`. Only fields the content API actually provides —
 * no invented author identity beyond the published display name.
 */
export function articleJsonLd(article: {
  title: string;
  slug: string;
  publishedAt: string;
  excerpt: string | null;
  authorName: string;
  featuredImageUrl: string | null;
}): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    description: article.excerpt ?? undefined,
    datePublished: article.publishedAt,
    dateModified: article.publishedAt,
    author: { '@type': 'Organization', name: article.authorName },
    publisher: { '@id': nodeId(ORGANISATION_ID) },
    mainEntityOfPage: { '@type': 'WebPage', '@id': siteUrl(`/blog/${article.slug}`) },
    image: article.featuredImageUrl === null ? undefined : [article.featuredImageUrl],
    isPartOf: { '@id': nodeId(WEBSITE_ID) },
  };
}
