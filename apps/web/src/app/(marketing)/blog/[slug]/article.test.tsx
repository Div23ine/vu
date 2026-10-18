// Registers the jest-dom matchers and their Vitest type augmentation.
import '@testing-library/jest-dom/vitest';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { PublicContentDetail } from '@vunvault/contracts';
import { publicContent } from '@vunvault/contracts/fixtures/store';
import { ArticleReader } from '../_components/article-reader';
import { SafeMarkdown } from '../_components/safe-markdown';
import { fetchArticle } from './page';

/**
 * Article reader tests — the safe-markdown renderer (including the
 * mandated XSS probes), the edge loader's 404 behaviour against the MSW
 * detail handler, and the reader's composition of a contract-shaped
 * `PublicContentDetail`.
 */

vi.mock('next/image', () => ({
  // The stub is the point: a plain <img> stands in for the optimiser, which
  // has no Next runtime (and no configured remote host) inside Vitest.
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));

const [firstItem] = publicContent;
if (firstItem === undefined) throw new Error('publicContent fixture is empty.');

const DETAIL: PublicContentDetail = {
  ...firstItem,
  bodyMd: [
    '## Overview',
    '',
    'A **bold** claim with *italics* and `inline code`.',
    '',
    '### Findings',
    '',
    '- first point',
    '- second point',
    '',
    '> Quoted field note.',
    '',
    'Reference: [vendor advisory](https://example.com/advisory)',
  ].join('\n'),
};

describe('SafeMarkdown', () => {
  it('renders the supported block and inline set', () => {
    render(<SafeMarkdown source={DETAIL.bodyMd} />);
    expect(screen.getByRole('heading', { level: 2, name: 'Overview' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Findings' })).toBeInTheDocument();
    expect(screen.getByText('bold')).toBeInTheDocument();
    expect(screen.getByText('italics')).toBeInTheDocument();
    expect(screen.getByText('inline code')).toBeInTheDocument();
    const list = screen.getByRole('list');
    expect(within(list).getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByRole('blockquote')).toHaveTextContent('Quoted field note.');
    const link = screen.getByRole('link', { name: 'vendor advisory' });
    expect(link).toHaveAttribute('href', 'https://example.com/advisory');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer nofollow');
  });

  it('renders raw HTML inert — no script element, text escaped', () => {
    const { container } = render(
      <SafeMarkdown source={'<script>alert(1)</script>\n\n<img src=x onerror="alert(2)">'} />,
    );
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toContain('<script>alert(1)</script>');
    expect(container.textContent).toContain('<img src=x onerror="alert(2)">');
  });

  it('defuses javascript: and data: links', () => {
    const { container } = render(
      <SafeMarkdown source={'[click](javascript:alert(1)) and [dl](data:text/html,x)'} />,
    );
    expect(container.querySelector('a')).toBeNull();
    expect(container.textContent).toContain('click');
    expect(container.textContent).toContain('dl');
    expect(container.textContent).not.toContain('javascript:alert');
  });
});

describe('fetchArticle (edge loader)', () => {
  it('loads a known slug from the detail handler with a body', async () => {
    const detail = await fetchArticle(firstItem.slug);
    expect(detail.slug).toBe(firstItem.slug);
    expect(detail.title).toBe(firstItem.title);
    expect(detail.bodyMd).toContain('Mock body for');
  });

  it('calls notFound() for an unknown slug', async () => {
    await expect(fetchArticle('definitely-not-a-real-slug')).rejects.toThrow();
  });
});

describe('ArticleReader', () => {
  it('renders the header, meta, body and both back links', () => {
    render(<ArticleReader item={DETAIL} />);

    expect(screen.getByRole('heading', { level: 1, name: DETAIL.title })).toBeInTheDocument();
    expect(screen.getByText(DETAIL.author.fullName)).toBeInTheDocument();
    expect(screen.getByText(/By/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Overview' })).toBeInTheDocument();

    const backLinks = screen.getAllByRole('link', { name: /Back to News \/ All Reports/ });
    expect(backLinks).toHaveLength(2);
    for (const link of backLinks) {
      expect(link).toHaveAttribute('href', '/blog');
    }

    for (const tag of DETAIL.tags) {
      expect(screen.getByText(tag)).toBeInTheDocument();
    }
    expect(document.getElementById('vv-article-reader')).not.toBeNull();
  });
});
