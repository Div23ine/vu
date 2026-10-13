// Registers the jest-dom matchers and their Vitest type augmentation.
import '@testing-library/jest-dom/vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ScanJob } from '@vunvault/contracts';
import { ScanClientMessage } from '@vunvault/contracts';
import { scanJobs } from '@vunvault/contracts/fixtures/scans';
import { useToastStore } from '@vunvault/ui';
import { FakeWebSocket } from '../../../../test/fake-websocket';
import {
  ScanTerminalDialog,
  PAUSE_UNSUPPORTED_TOOLTIP,
  logFileName,
} from './_components/scan-terminal-dialog';

/**
 * The staff scan terminal (Task 96).
 *
 * The socket is the shared `FakeWebSocket`: the assertions are about the URL a
 * reconnect asks for, the exact bytes that ever leave the browser (every
 * outbound frame must parse with the contract's whitelist), and the fact that
 * a hostile log line is drawn as TEXT. Timers are fake only where the backoff
 * schedule is under test.
 */

const sessionState = vi.hoisted(() => ({
  role: 'super_admin' as string,
  permissions: ['scans:read', 'scans:review', 'scans:execute'] as string[],
}));
vi.mock('../../../../lib/session', () => ({
  useSession: () => ({
    user: {
      id: 'c0000000-0000-4000-8000-000000000001',
      email: 'e.reed@vunvault.com',
      fullName: 'Dr. Evelyn Reed',
      role: sessionState.role,
      orgId: null,
      permissions: sessionState.permissions,
      mfaEnrolled: true,
    },
    isLoading: false,
    isAuthenticated: true,
    isStaff: true,
    can: (permission: string) => sessionState.permissions.includes(permission),
    refetch: () => undefined,
  }),
}));

const RUNNING_JOB = scanJobs.find((job) => job.status === 'running') as ScanJob;

function renderTerminal(job: ScanJob = RUNNING_JOB) {
  return render(<ScanTerminalDialog job={job} open onOpenChange={() => undefined} />);
}

function lineFrame(seq: number, msg: string, kind = 'info') {
  return { type: 'line', seq, ts: '2026-10-08T12:00:00.000Z', kind, msg };
}

function toasts() {
  return useToastStore.getState().toasts;
}

/** Open the dialog, complete the handshake and put the job in `running`. */
async function openRunning(): Promise<FakeWebSocket> {
  renderTerminal();
  const socket = FakeWebSocket.latest();
  act(() => socket.emitOpen());
  act(() => socket.emitMessage({ type: 'status', status: 'running' }));
  await waitFor(() => expect(screen.getByText('Running')).toBeInTheDocument());
  return socket;
}

const clipboardWrite = vi.hoisted(() =>
  vi.fn<(text: string) => Promise<void>>(async () => undefined),
);
const createObjectURL = vi.hoisted(() => vi.fn(() => 'blob:mock'));
const revokeObjectURL = vi.hoisted(() => vi.fn());

function installClipboard(): void {
  Object.defineProperty(globalThis.navigator, 'clipboard', {
    value: { writeText: clipboardWrite },
    configurable: true,
    writable: true,
  });
}

class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

beforeEach(() => {
  FakeWebSocket.reset();
  vi.stubGlobal('WebSocket', FakeWebSocket);
  // Radix's tooltip popper measures with ResizeObserver, which jsdom lacks.
  vi.stubGlobal('ResizeObserver', ResizeObserverStub);
  useToastStore.setState({ toasts: [] });
  sessionState.role = 'super_admin';
  sessionState.permissions = ['scans:read', 'scans:review', 'scans:execute'];
  clipboardWrite.mockClear();
  clipboardWrite.mockResolvedValue(undefined);
  createObjectURL.mockClear();
  revokeObjectURL.mockClear();
  URL.createObjectURL = createObjectURL;
  URL.revokeObjectURL = revokeObjectURL;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('scan terminal — connection and rendering', () => {
  it('opens the relay stream for the job and shows the waiting state', async () => {
    renderTerminal();
    const socket = FakeWebSocket.latest();
    expect(socket.url).toBe(`wss://api.vunvault.test/api/v1/scans/${RUNNING_JOB.id}/stream`);
    expect(screen.getByText('Connecting')).toBeInTheDocument();
    expect(screen.getByText('Waiting for output…')).toBeInTheDocument();

    act(() => socket.emitOpen());
    act(() => socket.emitMessage({ type: 'status', status: 'running' }));
    await waitFor(() => expect(screen.getByText('Running')).toBeInTheDocument());
  });

  it('renders log lines with their clock stamp, and hostile markup as TEXT', async () => {
    const socket = await openRunning();
    const hostile = '<img src=x onerror=alert(1)>';
    act(() => socket.emitMessage(lineFrame(1, hostile, 'warn')));

    await waitFor(() => expect(screen.getByText(hostile)).toBeInTheDocument());
    expect(screen.getByText('[12:00:00]')).toBeInTheDocument();
    // The structural guarantee: no element was created from the message.
    expect(document.querySelector('img[src="x"]')).toBeNull();
    const body = document.getElementById('vv-term-body');
    expect(body?.querySelectorAll('img')).toHaveLength(0);
    expect(body).toHaveAttribute('role', 'log');
    expect(body).toHaveAttribute('aria-live', 'off');
  });

  it('ignores frames that fail the contract', async () => {
    const socket = await openRunning();
    act(() => socket.emitRaw('{truncated'));
    act(() => socket.emitMessage({ type: 'line', seq: 'nope' }));
    act(() => socket.emitMessage(lineFrame(1, 'real output')));

    await waitFor(() => expect(screen.getByText('real output')).toBeInTheDocument());
    expect(screen.queryByText('nope')).not.toBeInTheDocument();
  });

  it('phase and progress frames move the header meta', async () => {
    const socket = await openRunning();
    act(() => socket.emitMessage({ type: 'phase', name: 'enumeration' }));
    act(() => socket.emitMessage({ type: 'progress', progress: 42, etaSeconds: 125 }));

    await waitFor(() => expect(screen.getByText('enumeration')).toBeInTheDocument());
    expect(screen.getByText('42% · 2m 05s left')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '42');
  });
});

describe('scan terminal — the control whitelist', () => {
  it('Abort confirms with the verbatim copy and sends exactly { type }', async () => {
    const socket = await openRunning();

    fireEvent.click(screen.getByRole('button', { name: 'Abort' }));
    expect(await screen.findByText(`Abort ${RUNNING_JOB.jobCode}?`)).toBeInTheDocument();
    expect(screen.getByText('The scan stops and partial results are kept.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Abort scan' }));
    expect(socket.sent).toEqual([JSON.stringify({ type: 'abort' })]);

    // The ack becomes the verbatim toast.
    act(() => socket.emitMessage({ type: 'control_ack', control: 'abort' }));
    await waitFor(() =>
      expect(toasts()[0]).toMatchObject({
        kind: 'ok',
        title: 'Command sent',
        message: `abort sent to ${RUNNING_JOB.jobCode}.`,
      }),
    );
  });

  it('every outbound frame parses with the client whitelist', async () => {
    const socket = await openRunning();
    fireEvent.click(screen.getByRole('button', { name: 'Kill' }));
    expect(await screen.findByText(`Kill ${RUNNING_JOB.jobCode} immediately?`)).toBeInTheDocument();
    expect(screen.getByText('The scan pod is terminated without cleanup.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Kill scan' }));

    for (const payload of socket.sent) {
      expect(ScanClientMessage.safeParse(JSON.parse(payload)).success).toBe(true);
    }
    expect(socket.sentFrames()).toEqual([{ type: 'kill' }]);
  });

  it('Kill is hidden for analysts and present for administrators', async () => {
    sessionState.role = 'security_analyst';
    renderTerminal();
    const socket = FakeWebSocket.latest();
    act(() => socket.emitOpen());
    act(() => socket.emitMessage({ type: 'status', status: 'running' }));
    await waitFor(() => expect(screen.getByText('Running')).toBeInTheDocument());

    expect(screen.queryByRole('button', { name: 'Kill' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Abort' })).toBeEnabled();
  });

  it('a forbidden error frame toasts the verbatim refusal', async () => {
    const socket = await openRunning();
    act(() => socket.emitMessage({ type: 'error', code: 'forbidden' }));

    await waitFor(() =>
      expect(toasts()[0]).toMatchObject({
        kind: 'warn',
        title: 'Command refused',
        message: 'Your role cannot send this command.',
      }),
    );
  });

  it('Pause and Resume are disabled with the verbatim tooltip', async () => {
    await openRunning();

    const pause = screen.getByRole('button', { name: 'Pause' });
    const resume = screen.getByRole('button', { name: 'Resume' });
    expect(pause).toBeDisabled();
    expect(resume).toBeDisabled();
    // The native title carries the explanation (the WORM-snapshot precedent):
    // a disabled button cannot host a hover tooltip or take focus.
    expect(pause).toHaveAttribute('title', PAUSE_UNSUPPORTED_TOOLTIP);
    expect(resume).toHaveAttribute('title', PAUSE_UNSUPPORTED_TOOLTIP);
  });

  it('controls are disabled unless the job is running with scans:execute', async () => {
    sessionState.permissions = ['scans:read', 'scans:review'];
    renderTerminal();
    const socket = FakeWebSocket.latest();
    act(() => socket.emitOpen());
    act(() => socket.emitMessage({ type: 'status', status: 'running' }));
    await waitFor(() => expect(screen.getByText('Running')).toBeInTheDocument());

    expect(screen.getByRole('button', { name: 'Abort' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Kill' })).toBeDisabled();
  });
});

describe('scan terminal — reconnection and endings', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('an abnormal close reconnects after 1 s with after=<lastSeq>', async () => {
    renderTerminal();
    const first = FakeWebSocket.latest();
    act(() => first.emitOpen());
    act(() => first.emitMessage({ type: 'status', status: 'running' }));
    for (let seq = 1; seq <= 7; seq += 1) {
      act(() => first.emitMessage(lineFrame(seq, `step ${seq}`)));
    }

    act(() => first.emitClose(1_006));
    expect(screen.getByText('Reconnecting…')).toBeInTheDocument();
    // The log survives the drop.
    expect(screen.getByText('step 7')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(FakeWebSocket.instances).toHaveLength(2);
    expect(FakeWebSocket.latest().afterParam()).toBe('7');
  });

  it('the backoff doubles to 30 s and resets after a successful open', () => {
    renderTerminal();
    const socket = FakeWebSocket.latest();
    act(() => socket.emitOpen());

    act(() => socket.emitClose(1_006));
    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    const second = FakeWebSocket.latest();
    act(() => second.emitClose(1_006));
    act(() => {
      vi.advanceTimersByTime(1_999);
    });
    expect(FakeWebSocket.instances).toHaveLength(2);
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(FakeWebSocket.instances).toHaveLength(3);

    // A good open resets the streak: the next failure waits 1 s again.
    const third = FakeWebSocket.latest();
    act(() => third.emitOpen());
    act(() => third.emitClose(1_006));
    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(FakeWebSocket.instances).toHaveLength(4);
  });

  it('a terminal status ends the stream: no reconnect, verbatim copy, bar at 100', () => {
    renderTerminal();
    const socket = FakeWebSocket.latest();
    act(() => socket.emitOpen());
    act(() => socket.emitMessage({ type: 'status', status: 'running' }));
    act(() => socket.emitMessage({ type: 'status', status: 'completed' }));

    expect(screen.getByText('Completed')).toBeInTheDocument();
    expect(
      screen.getByText('Scan finished. Results are awaiting the review gate.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');

    act(() => socket.emitClose(1_000));
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(FakeWebSocket.instances).toHaveLength(1);
  });

  it('4401 shows the session-ended notice and stops', () => {
    renderTerminal();
    const socket = FakeWebSocket.latest();
    act(() => socket.emitOpen());
    act(() => socket.emitClose(4_401));

    expect(screen.getByText('Your session ended — sign in again.')).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(FakeWebSocket.instances).toHaveLength(1);
  });
});

describe('scan terminal — log tools', () => {
  it('Copy log puts the plain text on the clipboard and toasts the count', async () => {
    installClipboard();
    const socket = await openRunning();
    act(() => socket.emitMessage(lineFrame(1, 'alpha')));
    act(() => socket.emitMessage(lineFrame(2, 'beta')));
    await waitFor(() => expect(screen.getByText('beta')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Copy log' }));
    await waitFor(() => expect(clipboardWrite).toHaveBeenCalledTimes(1));
    const text = clipboardWrite.mock.calls[0]?.[0] ?? '';
    expect(text.split('\n')).toHaveLength(2);
    expect(text).toContain('alpha');
    await waitFor(() =>
      expect(toasts()[0]).toMatchObject({
        kind: 'ok',
        title: 'Log copied',
        message: '2 lines copied to the clipboard.',
      }),
    );
  });

  it('Download .txt saves <JOB-code>.log', async () => {
    const socket = await openRunning();
    act(() => socket.emitMessage(lineFrame(1, 'alpha')));
    await waitFor(() => expect(screen.getByText('alpha')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Download .txt' }));
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock');
    expect(logFileName(RUNNING_JOB.jobCode)).toBe(`${RUNNING_JOB.jobCode}.log`);
  });

  it('the copy fallback toasts the blocked-clipboard pair', async () => {
    installClipboard();
    clipboardWrite.mockRejectedValue(new Error('denied'));
    await openRunning();

    fireEvent.click(screen.getByRole('button', { name: 'Copy log' }));
    await waitFor(() =>
      expect(toasts()[0]).toMatchObject({ kind: 'warn', title: 'Clipboard blocked' }),
    );
  });

  it('the dialog carries the accessible chrome', async () => {
    await openRunning();
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby', 'vv-term-title');
    expect(within(dialog).getByText(new RegExp(RUNNING_JOB.jobCode))).toBeInTheDocument();
  });
});
