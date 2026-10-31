import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { server } from '../../../../mocks/server';
import { ZuraWidget } from './zura-widget';

/**
 * Zura widget behaviour — the floating assistant on every marketing page.
 *
 * Without an LLM endpoint (the default build) Zura is knowledge-base only:
 * buyer questions get the published answer verbatim, unknown questions get
 * an honest "I don't have a published answer" and a pointer to the contact
 * form — never a guess. With `NEXT_PUBLIC_ZURA_LLM_URL` set, questions the
 * KB cannot answer go to the endpoint; a broken endpoint degrades to the
 * same honest fallback.
 */

const GREETING_FRAGMENT = 'I’m Zura, VUNVAULT’s assistant.';
const FALLBACK_FRAGMENT = 'I don’t have a published answer for that yet';

async function openZura(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Zura' }));
  return screen.getByRole('dialog', { name: /Zura, the VUNVAULT assistant/ });
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('Zura — knowledge-base mode', () => {
  it('stays closed until the launcher is pressed, then greets', async () => {
    const user = userEvent.setup();
    render(<ZuraWidget />);

    expect(screen.queryByRole('dialog')).toBeNull();
    const launcher = screen.getByRole('button', { name: 'Zura' });
    expect(launcher).toHaveAttribute('aria-expanded', 'false');

    await user.click(launcher);
    const dialog = screen.getByRole('dialog', { name: /Zura, the VUNVAULT assistant/ });
    expect(within(dialog).getByText(new RegExp(GREETING_FRAGMENT))).toBeInTheDocument();
    expect(launcher).toHaveAttribute('aria-expanded', 'true');
  });

  it('answers a buyer question verbatim from the knowledge base', async () => {
    const user = userEvent.setup();
    render(<ZuraWidget />);
    const dialog = await openZura(user);

    await user.click(
      within(dialog).getByRole('button', { name: 'Which currency am I charged in?' }),
    );

    expect(await within(dialog).findByText(/Charges settle in USD — always/)).toBeInTheDocument();
  });

  it('answers a typed question about engagements', async () => {
    const user = userEvent.setup();
    render(<ZuraWidget />);
    const dialog = await openZura(user);

    await user.type(
      within(dialog).getByLabelText('Your question for Zura'),
      'what happens after payment?',
    );
    await user.click(within(dialog).getByRole('button', { name: 'Send' }));

    expect(
      await within(dialog).findByText(/You receive a receipt immediately/),
    ).toBeInTheDocument();
  });

  it('admits ignorance for unknown questions instead of guessing', async () => {
    const user = userEvent.setup();
    render(<ZuraWidget />);
    const dialog = await openZura(user);

    await user.type(
      within(dialog).getByLabelText('Your question for Zura'),
      'what is the weather in nairobi?',
    );
    await user.click(within(dialog).getByRole('button', { name: 'Send' }));

    expect(await within(dialog).findByText(new RegExp(FALLBACK_FRAGMENT))).toBeInTheDocument();
  });

  it('closes on Escape and returns focus to the launcher', async () => {
    const user = userEvent.setup();
    render(<ZuraWidget />);
    await openZura(user);

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('button', { name: 'Zura' })).toHaveFocus();
  });
});

describe('Zura — optional LLM endpoint', () => {
  async function renderWithLlm() {
    vi.stubEnv('NEXT_PUBLIC_ZURA_LLM_URL', 'https://llm.vunvault.test/chat');
    vi.resetModules();
    const loaded = await import('./zura-widget');
    return render(<loaded.ZuraWidget />);
  }

  it('routes unanswered questions to the endpoint when configured', async () => {
    server.use(
      http.post('https://llm.vunvault.test/chat', () =>
        HttpResponse.json({
          answer: 'The endpoint answers: retainer onboarding runs in week one.',
        }),
      ),
    );
    const user = userEvent.setup();
    await renderWithLlm();
    const dialog = await openZura(user);

    await user.type(
      within(dialog).getByLabelText('Your question for Zura'),
      'what is the weather in nairobi?',
    );
    await user.click(within(dialog).getByRole('button', { name: 'Send' }));

    expect(
      await within(dialog).findByText(/The endpoint answers: retainer onboarding runs in week one/),
    ).toBeInTheDocument();
  });

  it('falls back to the honest refusal when the endpoint fails', async () => {
    server.use(
      http.post('https://llm.vunvault.test/chat', () =>
        HttpResponse.json({ error: 'boom' }, { status: 500 }),
      ),
    );
    const user = userEvent.setup();
    await renderWithLlm();
    const dialog = await openZura(user);

    await user.type(
      within(dialog).getByLabelText('Your question for Zura'),
      'what is the weather in nairobi?',
    );
    await user.click(within(dialog).getByRole('button', { name: 'Send' }));

    expect(await within(dialog).findByText(new RegExp(FALLBACK_FRAGMENT))).toBeInTheDocument();
  });

  it('still prefers the knowledge base when the endpoint exists', async () => {
    const llm = vi.fn(() => HttpResponse.json({ answer: 'LLM should not answer this.' }));
    server.use(http.post('https://llm.vunvault.test/chat', llm));
    const user = userEvent.setup();
    await renderWithLlm();
    const dialog = await openZura(user);

    await user.click(within(dialog).getByRole('button', { name: 'What happens after payment?' }));

    expect(
      await within(dialog).findByText(/You receive a receipt immediately/),
    ).toBeInTheDocument();
    expect(llm).not.toHaveBeenCalled();
  });
});
