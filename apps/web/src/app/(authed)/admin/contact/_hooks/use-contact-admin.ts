import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ClientDirectoryItem,
  ContactMessageView,
  ContactStatus,
  ContactTriageBody,
  StaffMember,
} from '@vunvault/contracts';
import { queryKeys } from '@vunvault/lib';
import { apiDelete, apiGet, apiPatch, apiPost } from '../../../../../lib/api';

/**
 * Contact-inbox hooks — the admin surface over the public contact
 * form : the triage queue, the per-message write, the client
 * directory and the Verified-Blogger badge grant/revoke.
 *
 * The assignee roster reuses an earlier iteration's `GET /admin/users?status=active` rather
 * than a new endpoint: an assignee must be an active staff profile, and that
 * route already filters exactly that way.
 *
 * Keys: `queryKeys.users` for the roster and the badge writes (a badge changes
 * a user, so the roster must refresh), and a local `contact-admin` namespace for
 * the inbox and directory — packages/lib has neither and this task must not add
 * them (the an earlier iteration `SECURITY_STATUS_KEY` precedent).
 *
 * No `'use client'` directive (the `use-login.ts` pattern).
 */

export const CONTACT_ADMIN_KEY = ['contact-admin'] as const;
export const CONTACT_MESSAGES_KEY = [...CONTACT_ADMIN_KEY, 'messages'] as const;
export const CLIENT_DIRECTORY_KEY = [...CONTACT_ADMIN_KEY, 'clients'] as const;

export const CONTACT_PAGE_SIZE = 20;

/** The three triage states, in the order the summary chips count them. */
export const CONTACT_STATUSES: readonly ContactStatus[] = ['new', 'triaged', 'closed'] as const;

/**
 * The contract has no `CONTACT_STATUS_LABELS` record (unlike the category one),
 * so the chip labels live here — capitalised exactly as the spec's summary
 * chips read.
 */
export const CONTACT_STATUS_LABELS: Record<ContactStatus, string> = {
  new: 'New',
  triaged: 'Triaged',
  closed: 'Closed',
};

export interface ContactFilters {
  q: string;
  status: ContactStatus | '';
  category: string;
  page: number;
  pageSize: number;
}

function contactSearchOf(filters: ContactFilters): string {
  const params = new URLSearchParams();
  if (filters.q !== '') params.set('q', filters.q);
  if (filters.status !== '') params.set('status', filters.status);
  if (filters.category !== '') params.set('category', filters.category);
  params.set('page', String(filters.page));
  params.set('pageSize', String(filters.pageSize));
  return params.toString();
}

export function useContactMessages(filters: ContactFilters) {
  return useQuery({
    // TODO(backend-contract): GET /api/v1/admin/contact?status=&category=&q=&page=&pageSize=
    //  → 200 { data: ContactMessageView[]; total }
    queryKey: [...CONTACT_MESSAGES_KEY, filters],
    queryFn: () =>
      apiGet<{ data: ContactMessageView[]; total: number }>(
        `/api/v1/admin/contact?${contactSearchOf(filters)}`,
      ),
  });
}

export interface TriageInput {
  id: string;
  body: ContactTriageBody;
}

export function useTriageMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    // TODO(backend-contract): PATCH /api/v1/admin/contact/:id body { status?; assignedTo? }
    //  → 200 { data: ContactMessageView } | 422 validation_failed
    mutationFn: ({ id, body }: TriageInput) =>
      apiPatch<{ data: ContactMessageView }>(`/api/v1/admin/contact/${id}`, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CONTACT_MESSAGES_KEY });
    },
  });
}

/** Active staff, for the assignee select. */
export function useAssignableStaff() {
  return useQuery({
    // TODO(backend-contract): GET /api/v1/admin/users?status=active&pageSize=100
    //  → 200 { data: StaffMember[]; total }
    queryKey: [...queryKeys.users.all(), 'assignable'],
    queryFn: () =>
      apiGet<{ data: StaffMember[]; total: number }>(
        '/api/v1/admin/users?status=active&pageSize=100',
      ).then((response) => response.data),
  });
}

export interface DirectoryFilters {
  q: string;
  verifiedBlogger: '' | 'true' | 'false';
}

export function useClientDirectory(filters: DirectoryFilters) {
  const params = new URLSearchParams();
  if (filters.q !== '') params.set('q', filters.q);
  if (filters.verifiedBlogger !== '') params.set('verifiedBlogger', filters.verifiedBlogger);
  params.set('pageSize', '100');
  const search = params.toString();
  return useQuery({
    // TODO(backend-contract): GET /api/v1/admin/clients?q=&verifiedBlogger=&page=&pageSize=
    //  → 200 { data: ClientDirectoryItem[]; total }
    queryKey: [...CLIENT_DIRECTORY_KEY, search],
    queryFn: () =>
      apiGet<{ data: ClientDirectoryItem[]; total: number }>(
        `/api/v1/admin/clients?${search}`,
      ).then((response) => response.data),
  });
}

function useBloggerBadge(method: 'post' | 'delete') {
  const queryClient = useQueryClient();
  return useMutation({
    // TODO(backend-contract): POST | DELETE /api/v1/admin/users/:id/blogger-badge → 204
    mutationFn: (id: string) =>
      method === 'post'
        ? apiPost<void>(`/api/v1/admin/users/${id}/blogger-badge`)
        : apiDelete<void>(`/api/v1/admin/users/${id}/blogger-badge`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CLIENT_DIRECTORY_KEY });
      void queryClient.invalidateQueries({ queryKey: queryKeys.users.all() });
    },
  });
}

export function useGrantBloggerBadge() {
  return useBloggerBadge('post');
}

export function useRevokeBloggerBadge() {
  return useBloggerBadge('delete');
}
