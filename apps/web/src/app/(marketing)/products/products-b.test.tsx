// Registers the jest-dom matchers and their Vitest type augmentation.
import '@testing-library/jest-dom/vitest';
import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createQueryClient } from '@vunvault/lib';
import type { OpenTool } from '@vunvault/contracts';
import { FreeResourcesGrid, loadOpenTools } from './_components/free-resources';

function renderWithProviders(element: React.ReactElement) {
  return render(<QueryClientProvider client={createQueryClient()}>{element}</QueryClientProvider>);
}

/**
 * Open tooling tests — the grid is database-driven: the server component
 * fetches `GET /api/v1/tools`, so the suite stubs `fetch` and asserts
 * both branches of the artifact rule (download when `fileUrl` exists,
 * waitlist when it does not).
 */

const TOOLS: OpenTool[] = [
  {
    id: 'cve-tracker',
    name: 'CVE Tracker CLI',
    summary: 'Prioritised patch queue pulled from the NVD feed.',
    tags: ['CLI', 'Python'],
    sizeLabel: '2.4 MB · .zip',
    fileUrl: null,
    icon: 'terminal',
  },
  {
    id: 'zero-day-watch',
    name: 'Zero-Day Watch (RSS)',
    summary: 'The zero-day bulletin as an RSS feed.',
    tags: ['RSS'],
    sizeLabel: 'External host · .xml',
    fileUrl: 'https://feeds.vunvault.com/zero-day-watch.xml',
    icon: 'rss',
  },
];

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, json: async () => ({ data: TOOLS }) })),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('FreeResources (open tooling from the API)', () => {
  it('loads the spec from the API', async () => {
    const tools = await loadOpenTools();
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/api/v1/tools'), expect.anything());
    expect(tools).toHaveLength(2);
  });

  it('renders every tool the API returns', () => {
    renderWithProviders(<FreeResourcesGrid tools={TOOLS} />);
    expect(document.querySelectorAll('article.vv-free-card')).toHaveLength(2);
    expect(screen.getByRole('heading', { name: 'CVE Tracker CLI' })).toBeInTheDocument();
    expect(screen.getByText('2.4 MB · .zip')).toBeInTheDocument();
    expect(screen.getByText('Python')).toBeInTheDocument();
  });

  it('offers the waitlist when no artifact is published, and a download when one is', () => {
    renderWithProviders(<FreeResourcesGrid tools={TOOLS} />);
    const waitlist = screen.getByRole('button', { name: 'Join the waitlist' });
    expect(waitlist).toHaveAttribute('title', 'Join the waitlist for CVE Tracker CLI');
    expect(screen.getByRole('link', { name: /Download/ })).toHaveAttribute(
      'href',
      'https://feeds.vunvault.com/zero-day-watch.xml',
    );
  });

  it('keeps the section up with a refresh note when the API is unreachable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false })),
    );
    renderWithProviders(<FreeResourcesGrid tools={await loadOpenTools()} />);
    expect(document.querySelector('#free-resources')).not.toBeNull();
    expect(screen.getByText(/catalog is being refreshed/)).toBeInTheDocument();
  });
});
