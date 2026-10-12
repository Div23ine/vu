// Registers the jest-dom matchers and their Vitest type augmentation.
import '@testing-library/jest-dom/vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Button } from './button';
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './dialog';
import { Toaster } from './toast';

/** The Radix viewport (`role="region"`) holds the visible toasts only. */
function viewport(): HTMLElement {
  const region = document.querySelector<HTMLElement>('[role="region"]');
  if (region === null) throw new Error('Toast viewport is not mounted.');
  return region;
}
import { useToastStore, toast, MAX_VISIBLE_TOASTS } from '../lib/toast-store';
import { Tooltip, TooltipProvider } from './tooltip';

/** jsdom lacks the resize/scroll APIs Radix positioning relies on. */
beforeAll(() => {
  class ResizeObserverStub {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  vi.stubGlobal('ResizeObserver', ResizeObserverStub);
  HTMLElement.prototype.scrollIntoView = vi.fn();
  HTMLElement.prototype.setPointerCapture = vi.fn();
  HTMLElement.prototype.releasePointerCapture = vi.fn();
  HTMLElement.prototype.hasPointerCapture = vi.fn(() => false);
});

const DIALOG_TITLE = 'Provision New Team Member';
const DIALOG_DESCRIPTION =
  'Issue a scoped invitation to a security analyst, operator or auditor. Permissions are applied only after the invitee completes MFA enrolment and accepts the invitation.';

function ProvisionDialog({ dismissible = true }: { dismissible?: boolean }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>Provision New Member</Button>
      </DialogTrigger>
      <DialogContent dismissible={dismissible}>
        <DialogHeader>
          <div>
            <DialogTitle>{DIALOG_TITLE}</DialogTitle>
            <DialogDescription>{DIALOG_DESCRIPTION}</DialogDescription>
          </div>
        </DialogHeader>
        <DialogBody>
          <p>Invitation form</p>
        </DialogBody>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">Save Draft</Button>
          </DialogClose>
          <Button variant="primary">Send Secure Invitation</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

let consoleError: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  useToastStore.getState().clear();
  document.body.className = '';
});

afterEach(() => {
  expect(consoleError).not.toHaveBeenCalled();
  consoleError.mockRestore();
  useToastStore.getState().clear();
});

describe('Dialog', () => {
  it('opens from its trigger with full modal semantics', async () => {
    const user = userEvent.setup();
    render(<ProvisionDialog />);
    const trigger = screen.getByRole('button', { name: 'Provision New Member' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.click(trigger);

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveTextContent(DIALOG_TITLE);
    expect(dialog).toHaveTextContent(DIALOG_DESCRIPTION);
    // aria-labelledby / aria-describedby are wired to the title and description.
    const labelId = dialog.getAttribute('aria-labelledby');
    const describedId = dialog.getAttribute('aria-describedby');
    expect(labelId).not.toBeNull();
    expect(document.getElementById(labelId as string)).toHaveTextContent(DIALOG_TITLE);
    expect(describedId).not.toBeNull();
    expect(document.getElementById(describedId as string)).toHaveTextContent(DIALOG_DESCRIPTION);
    expect(screen.getByRole('button', { name: 'Save Draft' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send Secure Invitation' })).toBeInTheDocument();
  });

  it('moves focus into the dialog and freezes background scrolling', async () => {
    const user = userEvent.setup();
    render(<ProvisionDialog />);
    await user.click(screen.getByRole('button', { name: 'Provision New Member' }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toContainElement(document.activeElement as HTMLElement | null);
    expect(document.body).toHaveClass('nav-open');
  });

  it('closes on Escape, restores focus to the trigger and unfreezes the body', async () => {
    const user = userEvent.setup();
    render(<ProvisionDialog />);
    const trigger = screen.getByRole('button', { name: 'Provision New Member' });
    await user.click(trigger);
    await screen.findByRole('dialog');

    await user.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
    expect(document.body).not.toHaveClass('nav-open');
  });

  it('closes from the labelled close button', async () => {
    const user = userEvent.setup();
    render(<ProvisionDialog />);
    await user.click(screen.getByRole('button', { name: 'Provision New Member' }));
    await screen.findByRole('dialog');
    await user.click(screen.getByRole('button', { name: 'Close dialog' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('stays open when dismissible is false', async () => {
    const user = userEvent.setup();
    render(<ProvisionDialog dismissible={false} />);
    await user.click(screen.getByRole('button', { name: 'Provision New Member' }));
    await screen.findByRole('dialog');

    await user.keyboard('{Escape}');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('renders at the requested size', async () => {
    const user = userEvent.setup();
    render(
      <Dialog>
        <DialogTrigger asChild>
          <Button>Open</Button>
        </DialogTrigger>
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>Scan Console</DialogTitle>
          </DialogHeader>
        </DialogContent>
      </Dialog>,
    );
    await user.click(screen.getByRole('button', { name: 'Open' }));
    expect(await screen.findByRole('dialog')).toHaveClass('max-w-[56rem]');
  });
});

describe('Toaster', () => {
  it('renders a critical toast as an assertive alert', async () => {
    render(<Toaster />);
    toast({ kind: 'crit', title: 'Release locked', message: 'Complete the review gate first.' });

    const alert = await within(viewport()).findByRole('alert');
    expect(within(alert).getByText('Release locked')).toHaveClass('text-white', 'font-extrabold');
    expect(within(alert).getByText('Complete the review gate first.')).toHaveClass(
      'text-slate-text',
    );
    expect(alert).toHaveClass('border-critical/40');
    expect(within(alert).getByRole('button', { name: 'Dismiss notification' })).toBeInTheDocument();
  });

  it('renders an ok toast as a polite status', async () => {
    render(<Toaster />);
    toast({ kind: 'ok', title: 'Invitation sent', message: 'Secure invitation issued.' });

    const status = await within(viewport()).findByRole('status');
    expect(within(status).getByText('Invitation sent')).toBeInTheDocument();
    expect(status).toHaveClass('border-ok/40');
    expect(status).not.toHaveAttribute('role', 'alert');
  });

  it('renders warn and info kinds with their accents', async () => {
    render(<Toaster />);
    toast({ kind: 'warn', title: 'Payment overdue', message: '14 days past due.' });
    toast({ kind: 'info', title: 'FX quote locked', message: 'KES rate held for 15 minutes.' });

    const alert = await within(viewport()).findByRole('alert');
    expect(alert).toHaveClass('border-high/40');
    const status = await within(viewport()).findByRole('status');
    expect(status).toHaveClass('border-brand/32');
  });

  it('keeps at most four toasts visible and dismisses the oldest first', async () => {
    render(<Toaster />);
    for (let index = 1; index <= MAX_VISIBLE_TOASTS + 2; index += 1) {
      toast({ kind: 'info', title: `Toast ${index}`, durationMs: 60_000 });
    }

    await waitFor(() => {
      const open = useToastStore.getState().toasts.filter((item) => item.open);
      expect(open).toHaveLength(MAX_VISIBLE_TOASTS);
      expect(open.map((item) => item.title)).toEqual(['Toast 3', 'Toast 4', 'Toast 5', 'Toast 6']);
    });
    await waitFor(() =>
      expect(within(viewport()).getAllByRole('status')).toHaveLength(MAX_VISIBLE_TOASTS),
    );
  });

  it('removes a toast when its close button is clicked', async () => {
    const user = userEvent.setup();
    render(<Toaster />);
    toast({ kind: 'ok', title: 'Invitation sent', message: 'Secure invitation issued.' });

    await user.click(await screen.findByRole('button', { name: 'Dismiss notification' }));
    await waitFor(() => expect(useToastStore.getState().toasts).toHaveLength(0));
  });

  it('returns an id that can dismiss the toast programmatically', async () => {
    render(<Toaster />);
    const id = toast({ kind: 'ok', title: 'Invitation sent' });
    expect(typeof id).toBe('string');
    await within(viewport()).findByRole('status');

    useToastStore.getState().dismiss(id);
    await waitFor(() =>
      expect(useToastStore.getState().toasts.find((item) => item.id === id)?.open).toBe(false),
    );
  });
});

describe('Tooltip', () => {
  it('reveals its content on focus and keeps the trigger keyboard reachable', async () => {
    const user = userEvent.setup();
    render(
      <TooltipProvider delayDuration={0}>
        <Tooltip content="Abort the running scan">
          <Button size="icon" variant="ghost" aria-label="Abort scan">
            ✕
          </Button>
        </Tooltip>
      </TooltipProvider>,
    );

    const trigger = screen.getByRole('button', { name: 'Abort scan' });
    expect(screen.queryByText('Abort the running scan')).not.toBeInTheDocument();

    trigger.focus();
    expect(await screen.findByText('Abort the running scan')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    await waitFor(() =>
      expect(screen.queryByText('Abort the running scan')).not.toBeInTheDocument(),
    );
  });
});
