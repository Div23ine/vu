// Registers the jest-dom matchers and their Vitest type augmentation.
import '@testing-library/jest-dom/vitest';
import type { QueryClient } from '@tanstack/react-query';
import { QueryClientProvider } from '@tanstack/react-query';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
  type RenderResult,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { StudioItem } from '@vunvault/contracts';
import { createQueryClient } from '@vunvault/lib';
import { useToastStore } from '@vunvault/ui';
import { resetStudioDrafts, studioSeed } from '../../../../mocks/handlers/studio';
import { server } from '../../../../mocks/server';
import StudioEditorPage from './edit/[id]/page';

/**
 * Content Studio B tests — the spec's list: autosave fires ONCE
 * after the 1.5 s debounce and only for titles ≥ 4 chars; the slug follows
 * the title until locked; the tag limit + duplicate messages; image type/
 * size rejections; the upload flow order (url → PUT → state); readiness
 * gating of Submit; a 422 highlights the failing items; and NO localStorage
 * anywhere (spy). Plus the editor smoke, the read-only submitted state, the
 * toolbar and the preview dialog.
 */

const routerMock = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
const notFoundMock = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({
  useRouter: () => routerMock,
  notFound: notFoundMock,
}));

vi.mock('../../../../lib/session', () => ({
  useSession: () => ({
    user: {
      id: 'c1000000-0000-4000-8000-000000000001',
      email: 'jane@acmefintech.example',
      fullName: 'Jane Wanjiru',
      role: 'client',
      orgId: 'c1000000-0000-4000-8000-0000000000aa',
      permissions: [],
      mfaEnrolled: false,
    },
    isLoading: false,
    isAuthenticated: true,
    isStaff: false,
    can: () => false,
    refetch: () => undefined,
  }),
}));

function seedById(id: string): StudioItem {
  const found = studioSeed.find((item) => item.id === id);
  if (found === undefined) throw new Error(`The studio seed has no item ${id}.`);
  return found;
}

const CHANGES = seedById('570d1000-0000-4000-8000-000000000003');
const PUBLISHED = seedById('570d1000-0000-4000-8000-000000000006');
const DRAFT_TEMPLATE = seedById('570d1000-0000-4000-8000-000000000001');

let queryClient: QueryClient;

// `use(params)` suspends, so the mount must flush inside `act` .
async function renderEditor(id: string): Promise<RenderResult> {
  queryClient = createQueryClient();
  let view: RenderResult | undefined;
  await act(async () => {
    view = render(
      <QueryClientProvider client={queryClient}>
        <StudioEditorPage params={Promise.resolve({ id })} />
      </QueryClientProvider>,
    );
  });
  if (view === undefined) throw new Error('renderEditor: the render did not complete.');
  return view;
}

function toastTitles(): string[] {
  return useToastStore.getState().toasts.map((entry) => entry.title);
}

function fillRequiredFields(): void {
  fireEvent.change(screen.getByLabelText(/Post Title/), {
    target: { value: 'A long enough title' },
  });
  fireEvent.change(screen.getByLabelText(/Category/), { target: { value: 'news' } });
  fireEvent.change(screen.getByLabelText(/Main Body/), {
    target: { value: 'word '.repeat(160) },
  });
}

beforeEach(() => {
  useToastStore.setState({ toasts: [] });
  resetStudioDrafts();
  routerMock.push.mockReset();
  routerMock.replace.mockReset();
  notFoundMock.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('/portal/studio/edit/[id] — shell', () => {
  it('loads an existing draft into every field and renders the cards', async () => {
    await renderEditor(CHANGES.id);

    // The verbatim page head.
    expect(
      await screen.findByRole('heading', { name: 'Write & submit an article' }),
    ).toBeInTheDocument();
    expect(screen.getByText('User Content Creation Studio')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Draft your story, attach media and preview it exactly as readers will see it. Publishing submits the article to the admin moderation queue — nothing goes live until an editor approves it.',
      ),
    ).toBeInTheDocument();

    // Every card head.
    for (const title of [
      'Article Content',
      'Featured Image',
      'Hashtags / Tags',
      'Author',
      'Publication Readiness',
    ]) {
      expect(screen.getByRole('heading', { name: title })).toBeInTheDocument();
    }

    // The server copy lands in the fields.
    expect(screen.getByLabelText(/Post Title/)).toHaveValue(CHANGES.title ?? '');
    expect(screen.getByLabelText(/URL Slug/)).toHaveValue(CHANGES.slugPath ?? '');
    expect(screen.getByLabelText(/Category/)).toHaveValue('news');
    expect(screen.getByLabelText(/Excerpt/)).toHaveValue(CHANGES.excerpt ?? '');
    expect(screen.getByLabelText(/Main Body/)).toHaveValue(CHANGES.bodyMd ?? '');
    expect(screen.getByText(`${(CHANGES.title ?? '').length} / 120`)).toBeInTheDocument();

    // Tags + suggestions + the counter pill. (The seed item's own tags
    // overlap the suggestions, so scope the chips to the attached list.)
    const tagList = screen.getByRole('list', { name: 'Attached tags' });
    expect(within(tagList).getByText('#compliance')).toBeInTheDocument();
    expect(within(tagList).getByText('#fintech')).toBeInTheDocument();
    expect(screen.getByText('2 tags')).toBeInTheDocument();
    expect(screen.getByText('#security')).toBeInTheDocument();
    expect(
      screen.getByText('Maximum 8 tags. Tags drive related-article feeds and topic pages.'),
    ).toBeInTheDocument();

    // The author card is the session identity.
    expect(screen.getByText('Jane Wanjiru')).toBeInTheDocument();
    expect(screen.getByText('Verified Blogger')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Verified VUNVAULT contributor. Your byline, avatar and role are attached to every post you submit.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Edit profile & byline' })).toHaveAttribute(
      'href',
      '/portal/profile',
    );

    // The readiness checklist: six verbatim labels, three Required marks.
    for (const label of [
      'Title added',
      'Category selected',
      'Body ≥ 150 words',
      'Excerpt written',
      'Featured image attached',
      'At least 2 tags',
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(screen.getAllByText('Required')).toHaveLength(3);

    // changes_requested stays editable.
    expect(screen.getByLabelText(/Post Title/)).toBeEnabled();
  });

  it('renders read-only once the item is past the editable statuses', async () => {
    await renderEditor(PUBLISHED.id);
    expect(await screen.findByLabelText(/Post Title/)).toBeDisabled();
    expect(screen.getByLabelText(/Main Body/)).toBeDisabled();
    expect(screen.getByLabelText('Add a tag')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Save Draft' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Submit for Review' })).toBeDisabled();
    expect(screen.getByText('Published')).toBeInTheDocument();
  });

  it('renders the standard not-found page for an unknown id', async () => {
    await renderEditor('570d1000-0000-4000-8000-000000000099');
    await waitFor(() => expect(notFoundMock).toHaveBeenCalled());
  });
});

describe('/portal/studio/edit/[id] — autosave', () => {
  it('fires once after the 1.5 s debounce and only for titles ≥ 4 characters', async () => {
    vi.useFakeTimers();
    const posts: Array<Record<string, unknown>> = [];
    let created = 0;
    server.use(
      http.post('*/api/v1/studio/drafts', async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        posts.push(body);
        created += 1;
        return HttpResponse.json(
          {
            data: {
              ...DRAFT_TEMPLATE,
              id: `570d1000-0000-4000-8000-0000000f${(0x2000 + created).toString(16)}`,
              title: (body.title as string | undefined) ?? null,
              slugPath: (body.slug as string | undefined) ?? null,
              updatedAt: new Date().toISOString(),
            },
          },
          { status: 201 },
        );
      }),
    );

    await renderEditor('new');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.getByText('Saved')).toBeInTheDocument();

    // Three characters: below the rule, nothing is sent even after the debounce.
    const title = screen.getByLabelText(/Post Title/);
    fireEvent.change(title, { target: { value: 'abc' } });
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1600);
    });
    expect(posts).toHaveLength(0);

    // The fourth character arms the debounce — which RESTARTS on every change.
    fireEvent.change(title, { target: { value: 'abcd' } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(posts).toHaveLength(0);
    fireEvent.change(title, { target: { value: 'abcde' } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1600);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });

    // Exactly one create, with the derived slug; the indicator settles on Saved.
    expect(posts).toHaveLength(1);
    expect(posts[0]).toMatchObject({ title: 'abcde', slug: 'abcde', bodyMd: '', tags: [] });
    expect(screen.getByText('Saved')).toBeInTheDocument();
    expect(routerMock.replace).toHaveBeenCalledWith(
      '/portal/studio/edit/570d1000-0000-4000-8000-0000000f2001',
    );
  });

  it('never touches browser storage', async () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem');
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    await renderEditor('new');
    fireEvent.change(await screen.findByLabelText(/Post Title/), {
      target: { value: 'Storage probe title' },
    });
    fireEvent.change(screen.getByLabelText(/Main Body/), {
      target: { value: 'some body words' },
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 60));
    });
    expect(getItem).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
    getItem.mockRestore();
    setItem.mockRestore();
  });
});

describe('/portal/studio/edit/[id] — slug, tags, toolbar', () => {
  it('the slug follows the title until locked, with the verbatim toasts', async () => {
    await renderEditor('new');
    const title = await screen.findByLabelText(/Post Title/);
    const slug = screen.getByLabelText(/URL Slug/);

    fireEvent.change(title, { target: { value: 'My First Story!' } });
    expect(slug).toHaveValue('my-first-story');
    expect(screen.getByText('Public URL: /blog/my-first-story')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Lock slug to stop auto-updates' }));
    expect(toastTitles()).toContain('The URL will no longer follow the title.');
    fireEvent.change(title, { target: { value: 'Another Headline' } });
    expect(slug).toHaveValue('my-first-story');

    fireEvent.click(
      screen.getByRole('button', { name: 'Slug locked — click to resume auto-updates' }),
    );
    expect(toastTitles()).toContain('The URL will now follow the title again.');
    expect(slug).toHaveValue('another-headline');
  });

  it('enforces the tag limit and the duplicate message', async () => {
    await renderEditor('new');
    const input = await screen.findByLabelText('Add a tag');
    const tags = ['alpha', 'beta', 'gamma', 'delta', 'echo', 'foxtrot', 'golf', 'hotel'];
    for (const tag of tags) {
      fireEvent.change(input, { target: { value: tag } });
      fireEvent.keyDown(input, { key: 'Enter' });
    }
    expect(screen.getByText('8 tags')).toBeInTheDocument();

    // The ninth is refused with the verbatim toast.
    fireEvent.change(input, { target: { value: 'indra' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(toastTitles()).toContain('Tag limit reached');
    expect(screen.queryByText('#indra')).not.toBeInTheDocument();

    // A duplicate of an attached tag is refused with its verbatim message.
    fireEvent.change(input, { target: { value: 'alpha' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(toastTitles()).toContain('alpha is already attached to this post.');

    // Backspace on the empty input removes the last chip.
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.keyDown(input, { key: 'Backspace' });
    expect(screen.queryByText('#hotel')).not.toBeInTheDocument();
    expect(screen.getByText('7 tags')).toBeInTheDocument();
  });

  it('the toolbar wraps the selection, prefixes lines and guards clear-formatting', async () => {
    await renderEditor('new');
    const body = (await screen.findByLabelText(/Main Body/)) as HTMLTextAreaElement;

    fireEvent.change(body, { target: { value: 'plain text here' } });
    body.setSelectionRange(0, 5);
    fireEvent.click(screen.getByRole('button', { name: 'Bold' }));
    expect(body).toHaveValue('**plain** text here');

    body.setSelectionRange(0, 0);
    fireEvent.click(screen.getByRole('button', { name: 'Clear formatting' }));
    expect(toastTitles()).toContain('Nothing selected');
    expect(useToastStore.getState().toasts[0]?.message).toBe(
      'Highlight some text first, then clear its formatting.',
    );

    fireEvent.change(body, { target: { value: 'heading line' } });
    body.setSelectionRange(0, 0);
    fireEvent.click(screen.getByRole('button', { name: 'Heading 2' }));
    expect(body).toHaveValue('## heading line');

    // The subheading outline picks the new H2 up.
    expect(screen.getByText('Subheadings')).toBeInTheDocument();
    expect(screen.getByText('heading line')).toBeInTheDocument();
  });
});

describe('/portal/studio/edit/[id] — featured image', () => {
  function fileInputOf(container: HTMLElement): HTMLInputElement {
    const input = container.querySelector<HTMLInputElement>('input[type="file"]');
    if (input === null) throw new Error('The featured-image file input is missing.');
    return input;
  }

  it('rejects unsupported and oversized files with the verbatim toasts', async () => {
    const { container } = await renderEditor('new');
    const input = fileInputOf(container);

    const pdf = new File(['%PDF-1.4'], 'notes.pdf', { type: 'application/pdf' });
    fireEvent.change(input, { target: { files: [pdf] } });
    expect(
      useToastStore
        .getState()
        .toasts.some(
          (entry) =>
            entry.title === 'Unsupported file' &&
            entry.message === 'Please choose a JPG, PNG, WebP or GIF image.',
        ),
    ).toBe(true);

    const huge = new File(['x'], 'huge.png', { type: 'image/png' });
    Object.defineProperty(huge, 'size', { value: 6 * 1024 * 1024 });
    fireEvent.change(input, { target: { files: [huge] } });
    expect(
      useToastStore
        .getState()
        .toasts.some(
          (entry) =>
            entry.title === 'File too large' &&
            entry.message === 'Images must be 5 MB or smaller. This one is 6.0 MB.',
        ),
    ).toBe(true);

    // Neither rejection reached the preview state.
    expect(screen.getByLabelText('Image URL')).toHaveValue('');
  });

  it('runs upload-url → PUT → state, in order', async () => {
    const order: string[] = [];
    server.use(
      http.post('*/api/v1/studio/images/upload-url', async ({ request }) => {
        order.push('upload-url');
        const body = (await request.json()) as Record<string, unknown>;
        expect(body).toMatchObject({ contentType: 'image/png' });
        return HttpResponse.json({
          data: {
            uploadUrl: 'https://r2.vunvault.test/signed/studio/cover-9.png',
            objectKey: 'studio/cover-9.png',
            publicUrl: 'https://cdn.vunvault.test/studio/cover-9.png',
            expiresAt: new Date(Date.now() + 60_000).toISOString(),
          },
        });
      }),
      http.put('https://r2.vunvault.test/signed/*', ({ request }) => {
        order.push('put');
        expect(request.headers.get('content-type')).toBe('image/png');
        return new HttpResponse(null, { status: 200 });
      }),
    );
    const { container } = await renderEditor('new');
    const png = new File(['png-bytes'], 'cover.png', { type: 'image/png' });
    fireEvent.change(fileInputOf(container), { target: { files: [png] } });

    await waitFor(() => expect(order).toEqual(['upload-url', 'put']));
    await waitFor(() =>
      expect(screen.getByLabelText('Image URL')).toHaveValue(
        'https://cdn.vunvault.test/studio/cover-9.png',
      ),
    );
    expect(
      useToastStore
        .getState()
        .toasts.some(
          (entry) =>
            entry.title === 'Image attached' &&
            entry.message === 'cover.png is now the featured image.',
        ),
    ).toBe(true);

    // The preview shows the hosted image and the remove button clears it.
    expect(screen.getByRole('img')).toHaveAttribute(
      'src',
      'https://cdn.vunvault.test/studio/cover-9.png',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Remove featured image' }));
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(toastTitles()).toContain('Featured image removed');
  });
});

describe('/portal/studio/edit/[id] — submit', () => {
  it('gates Submit on the required readiness, then submits and locks the editor', async () => {
    const user = userEvent.setup();
    await renderEditor('new');
    const submit = await screen.findByRole('button', { name: 'Submit for Review' });
    expect(submit).toBeDisabled();
    expect(screen.getByText(/Target ≥/)).toBeInTheDocument();

    fillRequiredFields();

    // The checklist and the target indicator react live.
    const wordsItem = screen.getByText('Body ≥ 150 words').closest('li');
    expect(wordsItem?.className).toContain('is-done');
    expect(screen.getByText('met')).toBeInTheDocument();
    expect(submit).toBeEnabled();

    await user.click(submit);
    await waitFor(() =>
      expect(
        useToastStore
          .getState()
          .toasts.some(
            (entry) =>
              entry.title === 'Submitted for review' &&
              entry.message === 'An editor will review your article before it is published.',
          ),
      ).toBe(true),
    );
    expect(routerMock.push).toHaveBeenCalledWith('/portal/studio');

    // Read-only after submit, with the new status pill.
    expect(screen.getByLabelText(/Post Title/)).toBeDisabled();
    expect(screen.getByText('Pending Review')).toBeInTheDocument();
  });

  it('a 422 not_ready highlights the failing checklist items', async () => {
    const user = userEvent.setup();
    server.use(
      http.post('*/api/v1/studio/drafts/:id/submit', () =>
        HttpResponse.json(
          {
            error: 'not_ready',
            details: [
              {
                title: true,
                category: false,
                bodyWords: false,
                excerpt: false,
                featuredImage: false,
                tags: false,
              },
            ],
          },
          { status: 422 },
        ),
      ),
    );
    await renderEditor('new');
    fillRequiredFields();

    await user.click(await screen.findByRole('button', { name: 'Submit for Review' }));

    await waitFor(() => expect(toastTitles()).toContain('Cannot publish yet'));
    expect(useToastStore.getState().toasts[0]?.message).toBe(
      'You need article body content and a category before submitting.',
    );
    expect(screen.getByText('Category selected').closest('li')?.className).toContain('is-failed');
    expect(screen.getByText('Body ≥ 150 words').closest('li')?.className).toContain('is-failed');
    expect(screen.getByText('Title added').closest('li')?.className).not.toContain('is-failed');
  });

  it('previews through SafeMarkdown and guards the empty preview', async () => {
    await renderEditor('new');
    const preview = await screen.findByRole('button', { name: 'Preview Article' });

    // Nothing written yet → the verbatim guard toast, no dialog.
    fireEvent.click(preview);
    expect(toastTitles()).toContain('Nothing to preview');
    expect(useToastStore.getState().toasts[0]?.message).toBe(
      'Write a title or some body content first.',
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Post Title/), { target: { value: 'Preview me' } });
    fireEvent.change(screen.getByLabelText(/Main Body/), {
      target: { value: '## Section one\n\nBody **bold** text.' },
    });
    fireEvent.click(preview);

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Reader Preview')).toBeInTheDocument();
    expect(within(dialog).getByRole('heading', { name: 'Preview me' })).toBeInTheDocument();
    expect(within(dialog).getByText('/blog/preview-me')).toBeInTheDocument();
    // SafeMarkdown rendered the body structurally…
    expect(within(dialog).getByRole('heading', { name: 'Section one' })).toBeInTheDocument();
    const bold = within(dialog).getByText('bold');
    expect(bold.tagName).toBe('STRONG');
    expect(bold.parentElement?.textContent).toBe('Body bold text.');
    expect(
      within(dialog).getByText(
        'This is a local preview rendered from your device only. Nothing has been published or submitted yet.',
      ),
    ).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});
