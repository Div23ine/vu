// Registers the jest-dom matchers and their Vitest type augmentation.
import '@testing-library/jest-dom/vitest';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CONTRIBUTORS, Contributors } from './contributors';
import { ContactStrip } from './contact-strip';
import { PressMedia } from './press-media';

/**
 * Home end-section tests (Task 52) — press band, contributors and the
 * contact strip. All three are static server components; the suites pin the
 * verbatim copy and every destination.
 */

describe('PressMedia', () => {
  it('renders the verbatim press copy and quote', () => {
    render(<PressMedia />);
    expect(screen.getByText('PRESS & MEDIA')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'For journalists and partners' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'VUNVAULT is an Africa-rooted cybersecurity firm headquartered in Nairobi, Kenya, providing penetration testing, vulnerability assessments and security education to organizations of every size, across Africa and worldwide.',
      ),
    ).toBeInTheDocument();
    const quote = screen.getByRole('blockquote');
    expect(quote).toHaveTextContent(
      'The Minnesota attacks were not sophisticated, and that is exactly what makes them dangerous.',
    );
    expect(quote).toHaveTextContent(
      'Every utility should treat perimeter security as mission critical.',
    );
    expect(screen.getByText('— VUNVAULT Threat Intelligence Commentary')).toBeInTheDocument();
    expect(screen.getByText('Featured in Global Tech Press')).toBeInTheDocument();
  });

  it('wires the press office mailto and the report request route', () => {
    render(<PressMedia />);
    expect(screen.getByText('Media Inquiries & Interview Requests')).toBeInTheDocument();
    expect(screen.getByText('press@vunvault.com')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Contact Press Office' })).toHaveAttribute(
      'href',
      'mailto:press@vunvault.com',
    );
    expect(screen.getByRole('link', { name: 'Request a Report' })).toHaveAttribute(
      'href',
      '/contact?category=penetration_testing_request#contact-form',
    );
  });
});

describe('Contributors', () => {
  it('renders the six photo cards in order with names and roles', () => {
    render(<Contributors />);
    expect(screen.getByText('CONTRIBUTORS')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'The people behind the defense' }),
    ).toBeInTheDocument();
    expect(CONTRIBUTORS).toHaveLength(6);

    const cards = document.querySelectorAll('article.contributor-card');
    expect(cards).toHaveLength(6);
    expect(
      Array.from(cards).map((card) => within(card as HTMLElement).getByRole('heading').textContent),
    ).toEqual(CONTRIBUTORS.map((contributor) => contributor.name));

    for (const contributor of CONTRIBUTORS) {
      expect(screen.getByText(contributor.role)).toBeInTheDocument();
      const photo = document.querySelector(`img[src="${contributor.photo}"]`);
      expect(photo).not.toBeNull();
      expect(photo).toHaveClass('contributor-avatar');
      expect(photo).toHaveAccessibleDescription('');
    }
    expect(
      screen.getByText(
        'Ethical hackers, security engineers and threat researchers building VUNVAULT’s detection, automation and education stack.',
      ),
    ).toBeInTheDocument();
  });

  it('labels every photograph with an accessible name', () => {
    render(<Contributors />);
    for (const contributor of CONTRIBUTORS) {
      const photo = document.querySelector(`img[src="${contributor.photo}"]`);
      expect(photo?.getAttribute('alt')).toBeTruthy();
    }
  });
});

describe('ContactStrip', () => {
  it('renders the three contact rows verbatim', () => {
    render(<ContactStrip />);
    expect(screen.getByText('Contact & Partnerships')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Get in Touch with VUNVAULT' })).toBeInTheDocument();
    expect(
      screen.getByText(
        'Reach the team directly to discuss an assessment, ask a question or become a partner.',
      ),
    ).toBeInTheDocument();

    expect(screen.getByText('WHATSAPP')).toBeInTheDocument();
    expect(screen.getByText('+254 705 998 032')).toBeInTheDocument();
    expect(screen.getByText('EMAIL')).toBeInTheDocument();
    expect(screen.getByText('info@vunvault.com')).toBeInTheDocument();
    expect(screen.getByText('BASED IN')).toBeInTheDocument();
    expect(
      screen.getByText('Nairobi, Kenya — serving clients across Africa and worldwide.'),
    ).toBeInTheDocument();
  });

  it('wires the WhatsApp deep link, the mailto and the social profiles', () => {
    render(<ContactStrip />);
    const whatsapp = screen.getByRole('link', { name: /WHATSAPP/ });
    expect(whatsapp).toHaveAttribute('href', 'https://wa.me/254705998032');
    expect(whatsapp).toHaveAttribute('target', '_blank');
    expect(whatsapp).toHaveAttribute('rel', 'noopener noreferrer');

    expect(screen.getByRole('link', { name: /EMAIL/ })).toHaveAttribute(
      'href',
      'mailto:support@vunvault.com',
    );

    const x = screen.getByRole('link', { name: 'VUNVAULT on X (Twitter)' });
    expect(x).toHaveAttribute('href', 'https://x.com/vunvault');
    expect(screen.getByRole('link', { name: 'VUNVAULT on GitHub' })).toHaveAttribute(
      'href',
      'https://github.com/vunvault',
    );
    expect(screen.getByRole('link', { name: 'VUNVAULT on LinkedIn' })).toHaveAttribute(
      'href',
      'https://www.linkedin.com/company/vunvault',
    );
  });
});
