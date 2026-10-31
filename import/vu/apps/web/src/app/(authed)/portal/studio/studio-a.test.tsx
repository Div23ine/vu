// Registers the jest-dom matchers and their Vitest type augmentation.
import '@testing-library/jest-dom/vitest';
import type { QueryClient } from '@tanstack/react-query';
import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import type { ContentStatus } from '@vunvault/contracts';
import { createQueryClient } from '@vunvault/lib';
import { studioSeed } from '../../../../mocks/handlers/studio';
import { server } from '../../../../mocks/server';
import StudioPage from './page';

/**
 * Content Studio A tests — the spec's list: the unverified user
 * sees the denied copy and NO demo button, the verified user sees the table,
 * the reviewer note shows for `changes_requested` (and `rejected`), and New
 * article navigates to the editor. Plus the verbatim empty state.
 */

function seedByStatus(status: ContentStatus) {
  const found = studioSeed.find((item) => item.status === status);
  if (found === undefined) throw new Error(`The studio seed has no ${status} item.`);
  return found;
}

let queryClient: QueryClient;

function renderStudio() {
  queryClient = createQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <StudioPage />
    </QueryClientProvider>,
  );
}

describe('/portal/studio — badge gate', () => {
  it('shows the denied card verbatim, and no demo control, to an unverified user', async () => {
    server.use(
      http.get('*/api/v1/studio/status', () =>
        HttpResponse.json({
          data: { verified: false, verifiedAt: null, displayName: 'Jane Wanjiru' },
        }),
      ),
    );
    renderStudio();

    expect(
      await screen.findByRole('heading', {
        name: 'Verified Journalist / Blogger badge required',
      }),
    ).toBeInTheDocument();
    expect(screen.getByText('Access Restricted')).toBeInTheDocument();
    expect(screen.getByText('Verified Journalist / Blogger Badge')).toBeInTheDocument();

    const text = screen.getByRole('paragraph');
    expect(text).toHaveTextContent(
      'You need a Verified Journalist / Blogger Badge to publish content on VUNVAULT.',
    );
    expect(text).toHaveTextContent(
      'This studio lets approved writers draft articles, attach media and submit posts into the pre-publication moderation queue.',
    );
    expect(text).toHaveTextContent('Unverified accounts cannot open it.');

    const items = within(screen.getByRole('list')).getAllByRole('listitem');
    expect(items).toHaveLength(3);
    expect(items[0]?.textContent).toBe(
      'Submit a verification request through the Contact page using the Journalist / Blogger Profile Request category.',
    );
    expect(items[1]?.textContent).toBe(
      'Our editorial team verifies your identity and publication history manually.',
    );
    expect(items[2]?.textContent).toBe(
      'Once approved, this studio unlocks and your posts enter admin moderation before publishing.',
    );

    // The call-to-action goes to the Contact page's verification category.
    expect(screen.getByRole('link', { name: 'Request Verification' })).toHaveAttribute(
      'href',
      '/contact?category=journalist_blogger_profile_request#contact-form',
    );
    expect(screen.getByRole('link', { name: 'Back to Home' })).toHaveAttribute('href', '/');

    // The design's demo-grant control and its localStorage note are GONE.
    expect(screen.queryByText('Enable demo verification')).not.toBeInTheDocument();
    expect(screen.queryByText(/localStorage/)).not.toBeInTheDocument();
    expect(screen.queryByText(/isVerifiedBlogger/)).not.toBeInTheDocument();

    // And the studio itself is not rendered behind the gate.
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Content Studio' })).not.toBeInTheDocument();
  });

  it('renders the header chip and the submissions table for a verified user', async () => {
    renderStudio();
    expect(await screen.findByRole('heading', { name: 'Content Studio' })).toBeInTheDocument();

    // The chip + its verbatim tooltip and contributor line.
    expect(screen.getByText('Verified Blogger')).toHaveAttribute(
      'title',
      'Verified VUNVAULT contributor — Journalist / Blogger access granted by the editorial team.',
    );
    expect(
      screen.getByText(
        'Verified VUNVAULT contributor. Your byline, avatar and role are attached to every post you submit.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('Jane Wanjiru')).toBeInTheDocument();

    // Every seed row renders — the null-title draft through its fallback.
    // (The `DataTable` shows a skeleton `<table>` first, so wait for DATA.)
    await screen.findByText('Untitled article');
    for (const item of studioSeed) {
      expect(screen.getByText(item.title ?? 'Untitled article')).toBeInTheDocument();
    }

    // Categories and status chips use the contract labels.
    expect(screen.getByText('Threat Intel')).toBeInTheDocument();
    expect(screen.getByText('Industry Updates')).toBeInTheDocument();
    expect(screen.getByText('Draft')).toBeInTheDocument();
    expect(screen.getByText('Pending Review')).toBeInTheDocument();
    expect(screen.getByText('Changes Requested')).toBeInTheDocument();
    expect(screen.getByText('Rejected')).toBeInTheDocument();
    expect(screen.getByText('Approved')).toBeInTheDocument();
    expect(screen.getByText('Published')).toBeInTheDocument();
    expect(screen.getByText('Scheduled')).toBeInTheDocument();

    // The Updated column formats the seed's first row (2026-10-06T10:12Z).
    expect(screen.getByText('6 Oct 2026')).toBeInTheDocument();
  });
});

describe('/portal/studio — submissions', () => {
  it('shows the reviewer note under changes_requested and rejected titles only', async () => {
    renderStudio();
    const changes = seedByStatus('changes_requested');
    const rejected = seedByStatus('rejected');
    expect(changes.reviewerNote).not.toBeNull();
    expect(rejected.reviewerNote).not.toBeNull();
    // The first findBy waits out the table's skeleton phase.
    expect(await screen.findByText(`Reviewer note: ${changes.reviewerNote}`)).toBeInTheDocument();
    expect(screen.getByText(`Reviewer note: ${rejected.reviewerNote}`)).toBeInTheDocument();
    expect(screen.getAllByText(/^Reviewer note:/)).toHaveLength(2);
  });

  it('links New article to the editor and gates Edit vs View by status', async () => {
    renderStudio();

    // New article navigates to the editor.
    expect(await screen.findByRole('link', { name: 'New article' })).toHaveAttribute(
      'href',
      '/portal/studio/edit/new',
    );

    // Edit for draft + changes_requested; View for everything else.
    const draft = seedByStatus('draft');
    const changes = seedByStatus('changes_requested');
    const published = seedByStatus('published');

    // findAllBy waits out the table's skeleton phase.
    const editHrefs = (await screen.findAllByRole('link', { name: 'Edit' }))
      .map((link) => link.getAttribute('href'))
      .sort();
    expect(editHrefs).toEqual(
      [`/portal/studio/edit/${draft.id}`, `/portal/studio/edit/${changes.id}`].sort(),
    );

    const viewLinks = screen.getAllByRole('link', { name: 'View' });
    expect(viewLinks).toHaveLength(studioSeed.length - 2);
    expect(viewLinks.map((link) => link.getAttribute('href'))).toContain(
      `/portal/studio/edit/${published.id}`,
    );
  });

  it('shows the verbatim empty state when the author has no articles', async () => {
    server.use(
      http.get('*/api/v1/studio/submissions', () => HttpResponse.json({ data: [], total: 0 })),
    );
    renderStudio();
    expect(await screen.findByText('No articles yet')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Start a draft — it is saved to your account and reviewed before publication.',
      ),
    ).toBeInTheDocument();
  });
});
