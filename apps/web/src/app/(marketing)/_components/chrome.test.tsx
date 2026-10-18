// Registers the jest-dom matchers and their Vitest type augmentation.
import '@testing-library/jest-dom/vitest';
import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createQueryClient } from '@vunvault/lib';
import { mockClientSession, mockStaffSession } from '../../../mocks/handlers/auth';
import { server } from '../../../mocks/server';
import { OPEN_SCANNER_EVENT, SiteFooter } from './site-footer';
import { SiteHeader } from './site-header';
import type { FooterVariant } from './footer-data';

/**
 * Marketing chrome tests .
 *
 * `next/navigation` is mocked to a settable pathname so the active-route and
 * footer-variant behaviour can be exercised without a router. Sessions come
 * from the MSW fixture handlers (401 by default = anonymous).
 */

const routeState = vi.hoisted(() => ({ pathname: '/' }));
vi.mock('next/navigation', () => ({
  usePathname: () => routeState.pathname,
}));

function renderInProviders(element: React.ReactElement) {
  const queryClient = createQueryClient();
  return render(element, {
    wrapper: ({ children }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  });
}

beforeEach(() => {
  routeState.pathname = '/';
});

describe('SiteHeader', () => {
  it('renders the six primary nav links with the verbatim labels', () => {
    renderInProviders(<SiteHeader />);
    const primary = screen.getByRole('navigation', { name: 'Primary' });
    const links = within(primary).getAllByRole('link');
    expect(links.map((link) => link.textContent)).toEqual([
      'About Us',
      'Services',
      'Blog',
      'Products',
      'Contact',
      'Login',
    ]);
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/about',
      '/services',
      '/blog',
      '/products',
      '/contact',
      '/login',
    ]);
  });

  it('marks the current route with aria-current="page"', () => {
    routeState.pathname = '/blog/cve-of-the-week';
    renderInProviders(<SiteHeader />);
    const primary = screen.getByRole('navigation', { name: 'Primary' });
    expect(within(primary).getByRole('link', { name: 'Blog' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(primary).getByRole('link', { name: 'About Us' })).not.toHaveAttribute(
      'aria-current',
    );
  });

  it('replaces Login with the profile chip once a client session resolves', async () => {
    server.use(
      http.get('*/api/v1/auth/session', () => HttpResponse.json({ data: mockClientSession })),
    );
    renderInProviders(<SiteHeader />);
    const primary = screen.getByRole('navigation', { name: 'Primary' });

    // While loading, the Login link stays — no layout shift.
    expect(within(primary).getByRole('link', { name: 'Login' })).toBeInTheDocument();

    await waitFor(() => expect(within(primary).queryByRole('link', { name: 'Login' })).toBeNull());
    const chip = within(primary).getByRole('link', { name: 'Profile' });
    expect(chip).toHaveAttribute('href', '/portal/profile');
    expect(chip).toHaveTextContent('J'); // first letter of "Jane Wanjiru"
  });

  it('points the staff chip at the admin profile', async () => {
    server.use(
      http.get('*/api/v1/auth/session', () => HttpResponse.json({ data: mockStaffSession })),
    );
    renderInProviders(<SiteHeader />);
    const primary = screen.getByRole('navigation', { name: 'Primary' });
    await waitFor(() =>
      expect(within(primary).getByRole('link', { name: 'Profile' })).toHaveAttribute(
        'href',
        '/admin/profile',
      ),
    );
    expect(within(primary).getByRole('link', { name: 'Profile' })).toHaveTextContent('D');
  });
});

describe('MobileMenu', () => {
  it('mirrors the nav items plus the Login CTA in the drawer', () => {
    renderInProviders(<SiteHeader />);
    const drawer = screen.getByRole('navigation', { name: 'Mobile' });
    expect(
      within(drawer)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['About Us', 'Services', 'Blog', 'Products', 'Contact', 'Login']);
  });

  it('toggles aria-expanded with the drawer state, and Escape closes it', async () => {
    const user = userEvent.setup();
    renderInProviders(<SiteHeader />);
    const toggle = screen.getByRole('button', { name: 'Toggle navigation menu' });
    const drawer = document.getElementById('mobile-menu');

    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle).toHaveAttribute('aria-controls', 'mobile-menu');
    expect(drawer).not.toHaveClass('is-open');

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(toggle).toHaveClass('is-active');
    expect(drawer).toHaveClass('is-open');
    expect(document.body.classList.contains('nav-open')).toBe(true);

    await user.keyboard('{Escape}');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(drawer).not.toHaveClass('is-open');
    expect(document.body.classList.contains('nav-open')).toBe(false);
  });
});

describe('SiteFooter', () => {
  const HEADINGS: Record<FooterVariant, string[]> = {
    home: ['Resources', 'Company', 'Solutions', 'Tools'],
    company: ['Company', 'Services', 'Resources', 'Legal'],
    products: ['Resources', 'Company', 'Solutions', 'Products'],
    contact: ['Resources', 'Company', 'Solutions', 'Tools'],
  };

  for (const [variant, headings] of Object.entries(HEADINGS) as [FooterVariant, string[]][]) {
    it(`renders the ${variant} variant's column headings and the copyright`, () => {
      render(<SiteFooter variant={variant} />);
      for (const heading of headings) {
        expect(screen.getByRole('heading', { level: 4, name: heading })).toBeInTheDocument();
      }
      expect(screen.getByText('© 2026 VUNVAULT. All rights reserved.')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Top' })).toHaveAttribute('href', '/');
      expect(screen.getByRole('button', { name: 'Scroll to top' })).toBeInTheDocument();
    });
  }

  it('derives the variant from the route when none is passed', () => {
    routeState.pathname = '/contact';
    render(<SiteFooter />);
    const footer = document.querySelector('footer');
    expect(footer).toHaveClass('bg-dark', 'text-white', 'border-white/10');
  });

  it('maps footer labels onto published routes, anchors and coming-soon paths', () => {
    render(<SiteFooter variant="home" />);
    expect(screen.getByRole('link', { name: 'News' })).toHaveAttribute('href', '/blog');
    expect(screen.getByRole('link', { name: 'About Us' })).toHaveAttribute('href', '/about');
    expect(screen.getByRole('link', { name: 'Contact' })).toHaveAttribute('href', '/contact');
    expect(screen.getByRole('link', { name: 'Pricing & Plans' })).toHaveAttribute(
      'href',
      '/services#pricing',
    );
    expect(screen.getByRole('link', { name: 'Request a Report' })).toHaveAttribute(
      'href',
      '/contact#contact-form',
    );
    // Published legal and section anchors.
    expect(screen.getByRole('link', { name: 'Support' })).toHaveAttribute('href', '/contact');
    expect(screen.getByRole('link', { name: 'Small Business' })).toHaveAttribute(
      'href',
      '/services#core-services',
    );
    // Not built yet: the path still renders, and the unknown-route flow
    // answers it with the coming-soon banner + waitlist.
    for (const [label, href] of [
      ['Careers', '/careers'],
      ['Templates', '/templates'],
      ['Breach Watch', '/breach-watch'],
    ] as const) {
      expect(screen.getByRole('link', { name: label })).toHaveAttribute('href', href);
    }
  });

  it('links the legal column to the published policy pages', () => {
    render(<SiteFooter variant="company" />);
    expect(screen.getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute(
      'href',
      '/privacy',
    );
    expect(screen.getByRole('link', { name: 'Terms of Service' })).toHaveAttribute(
      'href',
      '/terms',
    );
    expect(screen.getByRole('link', { name: 'Cookie Policy' })).toHaveAttribute(
      'href',
      '/cookie-policy',
    );
    expect(screen.getByRole('link', { name: 'Responsible Disclosure' })).toHaveAttribute(
      'href',
      '/responsible-disclosure',
    );
    expect(screen.getByRole('link', { name: 'Press Office' })).toHaveAttribute(
      'href',
      'mailto:press@vunvault.com',
    );
  });

  it(`dispatches ${OPEN_SCANNER_EVENT} from Free Security Scan`, async () => {
    const spy = vi.fn();
    window.addEventListener(OPEN_SCANNER_EVENT, spy);
    render(<SiteFooter variant="home" />);
    await userEvent.click(screen.getByRole('button', { name: 'Free Security Scan' }));
    expect(spy).toHaveBeenCalledTimes(1);
    window.removeEventListener(OPEN_SCANNER_EVENT, spy);
  });
});
