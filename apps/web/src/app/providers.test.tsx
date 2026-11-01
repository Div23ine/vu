import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Providers } from './providers';

/**
 * The root client tree.
 *
 * The reason this file exists is Task 1b: `ZuraWidget` was written, tested in
 * isolation (13 tests, all green) and shipped — but nothing in the repository
 * ever rendered it, so the assistant was absent from every page. A component
 * suite cannot catch "nobody mounts this"; only a test on the tree that mounts
 * it can. That is the regression pinned below.
 */

vi.mock('../lib/csrf', () => ({ ensureCsrf: vi.fn(async () => undefined) }));

describe('Providers — site-wide chrome', () => {
  it('mounts the Zura launcher exactly once, on the root tree', () => {
    render(
      <Providers>
        <main>page content</main>
      </Providers>,
    );

    const launchers = screen.getAllByRole('button', { name: 'Zura' });
    expect(launchers).toHaveLength(1);
    expect(screen.getByText('page content')).toBeInTheDocument();
  });

  it('renders the operator headset avatar, not third-party branding', () => {
    render(<Providers>{null}</Providers>);
    expect(screen.getByTestId('zura-headset-avatar')).toBeInTheDocument();
    // The icon is decorative; the accessible name comes from the button label.
    expect(screen.getByTestId('zura-headset-avatar')).toHaveAttribute('aria-hidden', 'true');
  });

  it('carries no Gemini branding anywhere in the rendered tree', () => {
    const { container } = render(<Providers>{null}</Providers>);
    expect(container.innerHTML.toLowerCase()).not.toContain('gemini');
    expect(container.innerHTML.toLowerCase()).not.toContain('powered by google');
  });

  it('opens the assistant as a labelled dialog', async () => {
    const user = userEvent.setup();
    render(<Providers>{null}</Providers>);

    expect(screen.queryByRole('dialog')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Zura' }));

    expect(screen.getByRole('dialog', { name: /VUNVAULT security assistant/ })).toBeInTheDocument();
  });

  it('keeps the launcher below modal chrome so it cannot block another page', () => {
    render(<Providers>{null}</Providers>);
    const launcher = screen.getByRole('button', { name: 'Zura' });
    // Sticky headers are z-50, every dialog z-60, toasts z-400 — Zura is z-40.
    expect(launcher.className).toContain('z-40');
    expect(launcher.className).toContain('fixed');
  });
});
