/**
 * Footer link sets (Task 44), extracted from the prototype pages verbatim.
 *
 * Label → destination rules given by the catalogue (they OVERRIDE the
 * prototype's own hrefs/buttons, several of which pointed at `*.html` pages or
 * did nothing):
 *   Services → /services · About Us → /about · Contact → /contact ·
 *   Blog → /blog · News → /blog · Pricing & Plans → /services#pricing ·
 *   Request a Report → /contact#contact-form ·
 *   Free Security Scan → opens the scanner dialog (action, Task 48).
 * Every other label has no destination and renders as `<button type="button">`
 * exactly as in the prototype — no navigation, nothing invented.
 */

export interface FooterLink {
  label: string;
  /** Internal route; absent for placeholder buttons. */
  href?: string;
  /** `'scanner'` dispatches the `vunvault:open-scanner` window event (Task 48). */
  action?: 'scanner';
}

export interface FooterColumn {
  title: string;
  links: FooterLink[];
}

export type FooterVariant = 'home' | 'company' | 'products' | 'contact';

const DESTINATIONS: Readonly<Record<string, string>> = {
  Services: '/services',
  'About Us': '/about',
  Contact: '/contact',
  Blog: '/blog',
  News: '/blog',
  'Pricing & Plans': '/services#pricing',
  'Request a Report': '/contact#contact-form',
};

const SCANNER_LABEL = 'Free Security Scan';

function footerLink(label: string): FooterLink {
  if (label === SCANNER_LABEL) return { label, action: 'scanner' };
  const href = DESTINATIONS[label];
  return href === undefined ? { label } : { label, href };
}

function column(title: string, labels: readonly string[]): FooterColumn {
  return { title, links: labels.map(footerLink) };
}

/** index.html — the default `home` variant. */
const HOME_COLUMNS: readonly FooterColumn[] = [
  column('Resources', ['News', 'Blog', 'Breach Watch', 'Templates']),
  column('Company', ['About Us', 'Careers', 'Contact', 'Press', 'Support']),
  column('Solutions', ['Small Business', 'SACCO & Fintech', 'Enterprise', 'Security Training']),
  column('Tools', ['Free Security Scan', 'Pricing & Plans', 'Request a Report']),
];

/** about.html — the `company` variant. */
const COMPANY_COLUMNS: readonly FooterColumn[] = [
  column('Company', ['About Us', 'Core Team', 'Mission & Vision', 'Careers', 'Contact']),
  column('Services', [
    'Small Business',
    'SACCO & Fintech',
    'Enterprise',
    'Security Training',
    'Products',
  ]),
  column('Resources', ['Blog', 'News', 'Live Telemetry', 'Free Security Scan', 'Pricing & Plans']),
  column('Legal', [
    'Privacy Policy',
    'Terms of Service',
    'Responsible Disclosure',
    'Cookie Policy',
    'Press Office',
  ]),
];

/**
 * services.html — kept verbatim, currently UNSHIPPED: the catalogue defines
 * four variants and both the About and Services pages request `company`
 * (Tasks 53/54), so the about.html set above is the canonical one and this
 * set has no variant to bind to. Exported so the extraction stays complete
 * and a later task can bind it without re-deriving the data.
 */
export const SERVICES_PAGE_COLUMNS: readonly FooterColumn[] = [
  column('Resources', ['Blog', 'Zero-Day Portal', 'Free OSINT Tools', 'Academy']),
  column('Company', ['About Us', 'Contact', 'Services', 'Press']),
  column('Solutions', [
    'Starter Audit',
    'Advanced VA',
    'Full-Scope Pen Test',
    'Enterprise Retainer',
  ]),
  column('Legal', ['Privacy Policy', 'Terms of Service', 'NDA Policy']),
];

/** product.html — the `products` variant. */
const PRODUCTS_COLUMNS: readonly FooterColumn[] = [
  column('Resources', ['News', 'Blog', 'Free Tools', 'Live Console']),
  column('Company', ['About Us', 'Services', 'Contact', 'Press']),
  column('Solutions', ['Small Business', 'SACCO & Fintech', 'Enterprise', 'Security Training']),
  column('Products', ['Premium Catalog', 'Free Resources', 'Checkout', 'My Account']),
];

/** contact.html — the dark `contact` variant. */
const CONTACT_COLUMNS: readonly FooterColumn[] = [
  column('Resources', ['News', 'Blog', 'Breach Watch', 'Templates']),
  column('Company', ['About Us', 'Careers', 'Contact', 'Press']),
  column('Solutions', ['Small Business', 'SACCO & Fintech', 'Enterprise', 'Security Training']),
  column('Tools', ['Free Security Scan', 'Pricing & Plans', 'Request a Report']),
];

export const VARIANT_COLUMNS: Readonly<Record<FooterVariant, readonly FooterColumn[]>> = {
  home: HOME_COLUMNS,
  company: COMPANY_COLUMNS,
  products: PRODUCTS_COLUMNS,
  contact: CONTACT_COLUMNS,
};

/** The bottom quick-links row — identical on every variant. */
export const FOOTER_BOTTOM_LINKS: readonly { label: string; href: string }[] = [
  { label: 'Top', href: '/' },
  { label: 'Services', href: '/services' },
  { label: 'Academy', href: '/academy' },
];

export const FOOTER_COPYRIGHT = '© 2026 VUNVAULT. All rights reserved.';

/** Route prefix → variant, used when the layout renders `<SiteFooter />` bare. */
export function variantForPathname(pathname: string): FooterVariant {
  if (pathname.startsWith('/about')) return 'company';
  if (pathname.startsWith('/services')) return 'company';
  if (pathname.startsWith('/product')) return 'products';
  if (pathname.startsWith('/contact')) return 'contact';
  return 'home';
}
