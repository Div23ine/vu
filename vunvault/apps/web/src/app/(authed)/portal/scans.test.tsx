// Registers the jest-dom matchers and their Vitest type augmentation.
import '@testing-library/jest-dom/vitest';
import { Suspense } from 'react';
import type { QueryClient } from '@tanstack/react-query';
import { QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor, within, type RenderResult } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { scanJobs } from '@vunvault/contracts/fixtures/scans';
import { createQueryClient } from '@vunvault/lib';
import { useToastStore } from '@vunvault/ui';
import { server } from '../../../mocks/server';
import PortalHomePage from './page';
import ScanDetailPage from './scans/[id]/page';

/**
 * Portal scans tests (Task 69) — the spec's list: the table renders the MSW
 * rows and links to the detail, the empty state, the New-scan dialog requires
 * the PDF and runs the THREE requests in order (authorisation-url → PUT
 * upload → create), both 422 mappings, the detail renders findings sorted
 * critical → low, and the stored-XSS evidence string stays inert text.
 */

const notFoundMock = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({ notFound: notFoundMock }));

const RELEASED = scanJobs.filter((job) => job.reviewGateState === 'approved_released');
const FIRST = RELEASED[0];
if (FIRST === undefined) throw new Error('The scans fixture has no released job.');

let queryClient: QueryClient;

function renderWithClient(ui: React.ReactElement) {
  queryClient = createQueryClient();
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  useToastStore.setState({ toasts: [] });
  notFoundMock.mockReset();
});

describe('/portal — released reports', () => {
  it('renders the hero, the summary cards and the released rows with links', async () => {
    renderWithClient(<PortalHomePage />);
    expect(
      await screen.findByRole('heading', { name: 'Your Security Reports' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Client Portal')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Released penetration test and vulnerability assessment reports for your organisation.',
      ),
    ).toBeInTheDocument();

    // Summary cards: released total, the profile's open findings, next assessment.
    expect(screen.getByText('Reports released')).toBeInTheDocument();
    expect(await screen.findByText(String(RELEASED.length))).toBeInTheDocument();
    expect(screen.getByText('Open findings')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument(); // clientProfile fixture
    expect(screen.getByText('Next assessment')).toBeInTheDocument();
    expect(screen.getByText('14 days')).toBeInTheDocument();

    // The hint card + the dialog trigger.
    expect(screen.getByRole('button', { name: 'Request PenTest' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /New scan request/ })).toBeInTheDocument();

    // Released rows only, each linking to its detail.
    for (const job of RELEASED) {
      const link = await screen.findByRole('link', { name: job.jobCode });
      expect(link).toHaveAttribute('href', `/portal/scans/${job.id}`);
      expect(screen.getByText(job.targetHost)).toBeInTheDocument();
    }
    // An unreleased fixture job must NOT appear (the release lock).
    const unreleased = scanJobs.find((job) => job.reviewGateState !== 'approved_released');
    expect(unreleased).toBeDefined();
    expect(screen.queryByText(unreleased?.jobCode ?? '__none__')).not.toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /View report/ })).toHaveLength(RELEASED.length);
  });

  it('shows the empty state when nothing is released', async () => {
    server.use(http.get('*/api/v1/scans', () => HttpResponse.json({ data: [], total: 0 })));
    renderWithClient(<PortalHomePage />);
    expect(await screen.findByText('No released reports yet')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Reports appear here after the VUNVAULT team completes the mandatory review.',
      ),
    ).toBeInTheDocument();
  });
});

describe('/portal — new scan dialog', () => {
  function pdfFile() {
    return new File(['%PDF-1.4 mock authorisation'], 'authorisation.pdf', {
      type: 'application/pdf',
    });
  }

  async function openDialog(user: ReturnType<typeof userEvent.setup>) {
    await screen.findByRole('button', { name: /New scan request/ });
    await user.click(screen.getByRole('button', { name: /New scan request/ }));
    return await screen.findByRole('dialog');
  }

  it('requires the signed PDF before anything is sent', async () => {
    const user = userEvent.setup();
    renderWithClient(<PortalHomePage />);
    const dialog = await openDialog(user);
    expect(
      within(dialog).getByText('Only scan systems you own or are authorised in writing to test.'),
    ).toBeInTheDocument();

    await user.type(within(dialog).getByLabelText('Target'), 'app.example.co.ke');
    await user.click(within(dialog).getByRole('button', { name: /Request scan/ }));
    expect(
      await within(dialog).findByText('The signed authorisation PDF is required.'),
    ).toBeInTheDocument();
  });

  it('runs authorisation-url → PUT upload → create, in order, and toasts', async () => {
    const order: string[] = [];
    let createBody: Record<string, unknown> | null = null;
    server.use(
      http.post('*/api/v1/scans/authorisation-url', async ({ request }) => {
        order.push('authorisation-url');
        const body = (await request.json()) as Record<string, unknown>;
        expect(body).toMatchObject({ contentType: 'application/pdf' });
        return HttpResponse.json({
          data: {
            uploadUrl: 'https://r2.vunvault.test/signed/authorisations/test.pdf',
            objectKey: 'authorisations/test.pdf',
            expiresAt: new Date(Date.now() + 60_000).toISOString(),
          },
        });
      }),
      http.put('https://r2.vunvault.test/signed/*', ({ request }) => {
        order.push('upload');
        expect(request.headers.get('content-type')).toBe('application/pdf');
        return new HttpResponse(null, { status: 200 });
      }),
      http.post('*/api/v1/scans', async ({ request }) => {
        order.push('create');
        createBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(
          {
            data: {
              ...FIRST,
              id: 'c5000000-0000-4000-8000-000000004999',
              jobCode: 'JOB-4999',
              status: 'queued',
              reviewGateState: 'not_eligible',
            },
          },
          { status: 201 },
        );
      }),
    );
    const user = userEvent.setup();
    renderWithClient(<PortalHomePage />);
    const dialog = await openDialog(user);

    await user.type(within(dialog).getByLabelText('Target'), 'app.example.co.ke');
    await user.selectOptions(within(dialog).getByLabelText('Scan type'), 'api');
    await user.selectOptions(within(dialog).getByLabelText('Priority'), 'high');
    await user.upload(within(dialog).getByLabelText(/Signed authorisation/), pdfFile());
    await user.click(within(dialog).getByRole('button', { name: /Request scan/ }));

    await waitFor(() => expect(order).toEqual(['authorisation-url', 'upload', 'create']));
    expect(createBody).toMatchObject({
      targetHost: 'app.example.co.ke',
      scanType: 'api',
      priority: 'high',
      environment: 'production',
      authorisationDocKey: 'authorisations/test.pdf',
    });
    await waitFor(() =>
      expect(useToastStore.getState().toasts[0]).toMatchObject({
        kind: 'ok',
        title: 'Scan requested',
        message: 'Job JOB-4999 is queued. You will be notified when the report is released.',
      }),
    );
  });

  it('maps 422 authorisation_missing to the verbatim inline message', async () => {
    server.use(
      http.post('*/api/v1/scans', () =>
        HttpResponse.json({ error: 'authorisation_missing' }, { status: 422 }),
      ),
    );
    const user = userEvent.setup();
    renderWithClient(<PortalHomePage />);
    const dialog = await openDialog(user);
    await user.type(within(dialog).getByLabelText('Target'), 'app.example.co.ke');
    await user.upload(within(dialog).getByLabelText(/Signed authorisation/), pdfFile());
    await user.click(within(dialog).getByRole('button', { name: /Request scan/ }));
    expect(
      await within(dialog).findByText(
        'The signed authorisation could not be verified. Upload it again.',
      ),
    ).toBeInTheDocument();
  });

  it('maps 422 target_not_allowed to the verbatim inline message', async () => {
    const user = userEvent.setup();
    renderWithClient(<PortalHomePage />);
    const dialog = await openDialog(user);
    // The standing mock enforces the private-range guard itself.
    await user.type(within(dialog).getByLabelText('Target'), '192.168.1.10');
    await user.upload(within(dialog).getByLabelText(/Signed authorisation/), pdfFile());
    await user.click(within(dialog).getByRole('button', { name: /Request scan/ }));
    expect(
      await within(dialog).findByText(
        'That target cannot be scanned. Internal and private addresses require an engagement lead.',
      ),
    ).toBeInTheDocument();
  });
});

describe('/portal/scans/[id] — released report', () => {
  // `use(params)` suspends on the first render, so the mount must flush
  // inside `act` — otherwise React parks the tree and the body stays empty.
  async function renderDetail(id: string) {
    let view: RenderResult | undefined;
    await act(async () => {
      view = renderWithClient(
        <Suspense fallback={null}>
          <ScanDetailPage params={Promise.resolve({ id })} />
        </Suspense>,
      );
    });
    if (view === undefined) throw new Error('renderDetail: the render did not complete.');
    return view;
  }

  it('renders the header, the severity summary and findings sorted critical → low', async () => {
    await renderDetail(FIRST.id);
    expect(
      await screen.findByRole('heading', {
        name: `${FIRST.jobCode} · ${FIRST.targetHost}`,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText('Released report')).toBeInTheDocument();

    // Severity summary badges.
    const summary = screen.getByLabelText('Findings by severity');
    expect(within(summary).getByText('Critical 1')).toBeInTheDocument();
    expect(within(summary).getByText('High 1')).toBeInTheDocument();
    expect(within(summary).getByText('Medium 1')).toBeInTheDocument();
    expect(within(summary).getByText('Low 1')).toBeInTheDocument();

    // Findings order: the <details> titles arrive critical → low.
    await waitFor(() => expect(screen.getAllByRole('group')).toHaveLength(4));
    const titles = screen
      .getAllByText(
        (_content, element) => element?.classList.contains('vps-finding-title') === true,
      )
      .map((element) => element.textContent);
    expect(titles).toEqual([
      'SQL injection in the reporting export',
      'Stored XSS renders attacker markup in the evidence view',
      'Session cookie missing the __Host- prefix',
      'Verbose server header on static assets',
    ]);
  });

  it('renders stored-XSS evidence as inert text', async () => {
    const user = userEvent.setup();
    const { container } = await renderDetail(FIRST.id);
    const xssSummary = await screen.findByText(
      'Stored XSS renders attacker markup in the evidence view',
    );
    await user.click(xssSummary);
    const xssFinding = xssSummary.closest('details');
    if (xssFinding === null) throw new Error('The XSS finding is not a <details> block.');
    expect(
      await within(xssFinding).findByText('<img src=x onerror=alert(document.domain)>'),
    ).toBeInTheDocument();
    expect(within(xssFinding).getByText('Evidence (redacted)')).toBeInTheDocument();
    // The payload never became an element — no <img> anywhere in the page.
    expect(container.querySelector('img')).toBeNull();
    expect(document.querySelector('img')).toBeNull();
  });

  it('a 404 renders the standard not-found page', async () => {
    await renderDetail('c5000000-0000-4000-8000-00000000dead');
    await waitFor(() => expect(notFoundMock).toHaveBeenCalled());
  });
});
