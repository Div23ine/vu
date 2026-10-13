import { http, HttpResponse } from 'msw';
import type { ClientDirectoryItem, ContactMessageView } from '@vunvault/contracts';
// Imported as a value: the triage PATCH is validated with the contract's own
// `ContactTriageBody`, so the "at least one of status or assignedTo" rule the
// API enforces is the rule the mock enforces.
import { ContactTriageBody } from '@vunvault/contracts';
import { clientDirectory, contactMessages } from '@vunvault/contracts/fixtures/contact';

/**
 * Admin contact-inbox and client-directory mock handlers (Task 83e).
 *
 * Used ONLY by tests (through `mocks/server.ts`) and the opt-in dev mock mode.
 * The Task 40f fixtures ARE the queue and the directory; the list endpoints
 * apply the real filter semantics (`q` over name, email, organisation and
 * subject; exact `status` / `category`; `verifiedBlogger=true|false`; `page` /
 * `pageSize` slicing) so the URL-driven filters are exercised end to end.
 *
 * Triage and badge writes mutate module-level copies; tests reset them with
 * `resetAdminContact()`. The badge routes live under `/admin/users/:id` because
 * that is where the API puts them — a badge is a property of a user, not of a
 * directory row — so the directory entry flips only when the id matches.
 *
 * API contract mirrored here (implemented for real in `apps/api`, Task 40f):
 *   GET    /api/v1/admin/contact?…                 → 200 { data: ContactMessageView[]; total }
 *   PATCH  /api/v1/admin/contact/:id               → 200 { data: ContactMessageView } | 422
 *   GET    /api/v1/admin/clients?…                 → 200 { data: ClientDirectoryItem[]; total }
 *   POST   /api/v1/admin/users/:id/blogger-badge   → 204 | 404
 *   DELETE /api/v1/admin/users/:id/blogger-badge   → 204 | 404
 */

let messages: ContactMessageView[] = contactMessages.map((message) => ({ ...message }));
let clients: ClientDirectoryItem[] = clientDirectory.map((client) => ({ ...client }));

/** Restore both fixtures (tests call this in `beforeEach`). */
export function resetAdminContact(): void {
  messages = contactMessages.map((message) => ({ ...message }));
  clients = clientDirectory.map((client) => ({ ...client }));
}

function messageMatches(message: ContactMessageView, params: URLSearchParams): boolean {
  const q = (params.get('q') ?? '').trim().toLowerCase();
  if (q !== '') {
    const haystack = [message.name, message.email, message.organization ?? '', message.subject]
      .join(' ')
      .toLowerCase();
    if (!haystack.includes(q)) return false;
  }
  const status = params.get('status');
  if (status !== null && status !== '' && message.status !== status) return false;
  const category = params.get('category');
  if (category !== null && category !== '' && message.category !== category) return false;
  return true;
}

function clientMatches(client: ClientDirectoryItem, params: URLSearchParams): boolean {
  const q = (params.get('q') ?? '').trim().toLowerCase();
  if (q !== '') {
    const haystack = [client.fullName, client.email, client.company ?? '', client.clientCode ?? '']
      .join(' ')
      .toLowerCase();
    if (!haystack.includes(q)) return false;
  }
  const verified = params.get('verifiedBlogger');
  if (verified === 'true' && !client.verifiedBlogger) return false;
  if (verified === 'false' && client.verifiedBlogger) return false;
  return true;
}

function paginate<T>(rows: T[], params: URLSearchParams, fallbackSize: number) {
  const page = Math.max(1, Number(params.get('page') ?? '1'));
  const pageSize = Math.min(200, Math.max(1, Number(params.get('pageSize') ?? fallbackSize)));
  const start = (page - 1) * pageSize;
  return { data: rows.slice(start, start + pageSize), total: rows.length };
}

export const adminContactHandlers = [
  http.get('*/api/v1/admin/contact', ({ request }) => {
    const params = new URL(request.url).searchParams;
    const filtered = messages.filter((message) => messageMatches(message, params));
    // Newest first, so the inbox reads like a queue.
    filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return HttpResponse.json(paginate(filtered, params, 20));
  }),

  http.patch('*/api/v1/admin/contact/:id', async ({ params, request }) => {
    const id = String(params.id);
    const existing = messages.find((message) => message.id === id);
    if (existing === undefined) {
      return HttpResponse.json({ error: 'not_found' }, { status: 404 });
    }
    const body = (await request.json()) as { status?: string; assignedTo?: string | null };
    const parsed = ContactTriageBody.safeParse(body);
    if (!parsed.success) {
      return HttpResponse.json(
        { error: 'validation_failed', details: parsed.error.issues },
        { status: 422 },
      );
    }
    const updated: ContactMessageView = {
      ...existing,
      status: parsed.data.status ?? existing.status,
      assignedTo:
        parsed.data.assignedTo === undefined
          ? existing.assignedTo
          : parsed.data.assignedTo === null
            ? null
            : { id: parsed.data.assignedTo, label: parsed.data.assignedTo },
    };
    messages = messages.map((message) => (message.id === id ? updated : message));
    return HttpResponse.json({ data: updated });
  }),

  http.get('*/api/v1/admin/clients', ({ request }) => {
    const params = new URL(request.url).searchParams;
    const filtered = clients.filter((client) => clientMatches(client, params));
    return HttpResponse.json(paginate(filtered, params, 100));
  }),

  // The badge is a property of the USER, so the route sits under /admin/users.
  http.post('*/api/v1/admin/users/:id/blogger-badge', ({ params }) => {
    const id = String(params.id);
    const client = clients.find((candidate) => candidate.id === id);
    if (client === undefined) {
      return HttpResponse.json({ error: 'not_found' }, { status: 404 });
    }
    clients = clients.map((candidate) =>
      candidate.id === id ? { ...candidate, verifiedBlogger: true } : candidate,
    );
    return new HttpResponse(null, { status: 204 });
  }),

  http.delete('*/api/v1/admin/users/:id/blogger-badge', ({ params }) => {
    const id = String(params.id);
    const client = clients.find((candidate) => candidate.id === id);
    if (client === undefined) {
      return HttpResponse.json({ error: 'not_found' }, { status: 404 });
    }
    clients = clients.map((candidate) =>
      candidate.id === id ? { ...candidate, verifiedBlogger: false } : candidate,
    );
    return new HttpResponse(null, { status: 204 });
  }),
];
