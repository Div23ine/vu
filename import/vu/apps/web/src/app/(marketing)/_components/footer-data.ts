/**
 * Footer link sets , extracted from the design pages verbatim.
 *
 * Label → destination rules given by the spec (they OVERRIDE the
 * design's own hrefs/buttons, several of which pointed at `*.html` pages or
 * did nothing):
 * Services → /services · About Us → /about · Contact → /contact ·
 * Blog → /blog · News → /blog · Pricing & Plans → /services#pricing ·
 * Request a Report → /contact#contact-form ·
 * Free Security Scan → opens the scanner dialog (action) ·
 * the legal labels → their published pages (/privacy, /terms,
 * /cookie-policy, /responsible-disclosure) · anchors for the About and
 * Products sections · portal routes for Checkout / My Account / Zero-Day.
 * Labels whose pages do not exist yet (/careers, /templates, /breach-watch)
 * carry their natural path anyway: the unknown-route flow redirects home
 * with the coming-soon banner and its waitlist, which is the honest answer.
 * Anything still unmapped renders as `<button type="button">` as designed.
 */

export interface FooterLink {
  label: string;
  /** Internal route; absent for placeholder buttons. */
  href?: string;
  /** `'scanner'` dispatches the `vunvault:open-scanner` window event . */
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
  // Legal — published pages.
  'Privacy Policy': '/privacy',
  'Terms of Service': '/terms',
  'Cookie Policy': '/cookie-policy',
  'Responsible Disclosure': '/responsible-disclosure',
  'Press Office': 'mailto:press@vunvault.com',
  // Anchors into existing sections.
  Press: '/#press-media',
  Support: '/contact',
  'Core Team': '/about#contributors',
  'Mission & Vision': '/about#mission',
  'Live Telemetry': '/about#telemetry',
  'Free Tools': '/products#free-tools',
  'Free OSINT Tools': '/products#free-tools',
  'Free Resources': '/products#free-tools',
  'Premium Catalog': '/products#catalog',
  'Live Console': '/products',
  Products: '/products',
  'Small Business': '/services#core-services',
  'SACCO & Fintech': '/services#core-services',
  Enterprise: '/services#core-services',
  'Security Training': '/services#core-services',
  'Starter Audit': '/services#pricing',
  'Advanced VA': '/services#pricing',
  'Full-Scope Pen Test': '/services#pricing',
  'Enterprise Retainer': '/services#pricing',
  // Authenticated product surfaces.
  Checkout: '/portal/billing',
  'My Account': '/portal',
  'Zero-Day Portal': '/portal/advisories',
  // Not built yet — the coming-soon redirect answers these honestly.
  Careers: '/careers',
  Templates: '/templates',
  'Breach Watch': '/breach-watch',
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
 * services.html — kept verbatim, currently UNSHIPPED: the spec defines
 * four variants and both the About and Services pages request `company`
 * , so the about.html set above is the canonical one and this
 * set has no variant to bind to. Exported so the extraction stays complete
 * and a later task can bind it without re-deriving the data.
 */
export const SERVICES_PAGE_COLUMNS: readonly FooterColumn[] = [
  column('Resources', ['Blog', 'Zero-Day Portal', 'Free OSINT Tools']),
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
