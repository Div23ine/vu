'use client';

import { Suspense, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Inbox, RotateCcw, Users } from 'lucide-react';
import type { ContactMessageView, ContactStatus } from '@vunvault/contracts';
import { CONTACT_CATEGORY_LABELS } from '@vunvault/contracts';
import { toast } from '@vunvault/ui';
import { can } from '../../../../lib/permissions';
import { useSession } from '../../../../lib/session';
import { AdminPageHead } from '../_components/admin-page-head';
import { ClientDirectory } from './_components/client-directory';
import { InboxTable } from './_components/inbox-table';
import { MessageDialog } from './_components/message-dialog';
import {
  CONTACT_PAGE_SIZE,
  CONTACT_STATUSES,
  CONTACT_STATUS_LABELS,
  useAssignableStaff,
  useClientDirectory,
  useContactMessages,
  type ContactFilters,
} from './_hooks/use-contact-admin';
import './_styles/contact.css';

/**
 * `/admin/contact` — the triage inbox for the public contact form
 * and the client directory the Verified-Blogger badge is granted
 * from.
 *
 * Two tabs behind one route. `Clients & Badges` requires `users:read` and is
 * HIDDEN without it, not disabled: a support engineer who cannot read the
 * client list should not see a tab that renders an empty table.
 *
 * The verification hand-off is the reason both tabs live on one page: a
 * `journalist_blogger_profile_request` cannot be answered from the message
 * itself, so its dialog offers `Find client`, which switches tabs and pre-fills
 * the directory search with the sender's email. The applicant is matched by
 * email because the directory has no contact-message foreign key.
 *
 * Filters are URL-driven (the an earlier iteration/79/83 precedent) so a triage view is
 * linkable; the directory search is local state, because it is set by the
 * hand-off rather than typed into a shareable view.
 *
 * Client page inside a Suspense boundary: it reads `useSearchParams`.
 */

type ContactTab = 'messages' | 'clients';

const CATEGORY_OPTIONS = Object.keys(
  CONTACT_CATEGORY_LABELS,
) as (keyof typeof CONTACT_CATEGORY_LABELS)[];

export default function AdminContactPage() {
  return (
    <Suspense fallback={null}>
      <ContactView />
    </Suspense>
  );
}

function ContactView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useSession();
  const canReadUsers = can(user, 'users:read');
  const canManageUsers = can(user, 'users:manage');

  const [tab, setTab] = useState<ContactTab>('messages');
  const [openMessage, setOpenMessage] = useState<ContactMessageView | null>(null);
  const [directorySearch, setDirectorySearch] = useState('');
  const [handoffEmail, setHandoffEmail] = useState<string | null>(null);

  const filters: ContactFilters = {
    q: searchParams.get('q') ?? '',
    status: (searchParams.get('status') ?? '') as ContactFilters['status'],
    category: searchParams.get('category') ?? '',
    page: Number(searchParams.get('page') ?? '1'),
    pageSize: CONTACT_PAGE_SIZE,
  };

  const list = useContactMessages(filters);
  // An unfiltered read, so the summary chips count the WHOLE queue rather than
  // whatever the current filter happens to show.
  const unfiltered = useContactMessages({
    q: '',
    status: '',
    category: '',
    page: 1,
    pageSize: 100,
  });
  const staff = useAssignableStaff();
  const directory = useClientDirectory({ q: directorySearch, verifiedBlogger: '' });

  const messages = useMemo(() => list.data?.data ?? [], [list.data]);

  const counts = useMemo(() => {
    const rows = unfiltered.data?.data ?? [];
    return {
      new: rows.filter((row) => row.status === 'new').length,
      triaged: rows.filter((row) => row.status === 'triaged').length,
      closed: rows.filter((row) => row.status === 'closed').length,
    };
  }, [unfiltered.data]);

  const updateParams = (patch: Record<string, string>): void => {
    const params = new URLSearchParams();
    const merged = { q: filters.q, status: filters.status, category: filters.category, ...patch };
    for (const [key, value] of Object.entries(merged)) {
      if (value !== '') params.set(key, value);
    }
    const qs = params.toString();
    router.replace(qs === '' ? '/admin/contact' : `/admin/contact?${qs}`);
  };

  const resetFilters = (): void => {
    router.replace('/admin/contact');
    toast({
      kind: 'info',
      title: 'Filters cleared',
      message: 'Showing the full contact queue.',
    });
  };

  const onFindClient = (email: string): void => {
    setDirectorySearch(email);
    setHandoffEmail(email);
    setTab('clients');
  };

  return (
    <div className="adm-shell">
      <AdminPageHead
        eyebrow="Support & Verification"
        title="Contact Inbox"
        description="Public contact requests, vulnerability reports and Verified Blogger verification requests."
      />

      <div className="ct-tabs" role="tablist" aria-label="Contact inbox sections">
        <button
          type="button"
          className="ct-tab"
          role="tab"
          id="ct-tab-messages"
          aria-controls="ct-panel-messages"
          aria-selected={tab === 'messages'}
          tabIndex={tab === 'messages' ? 0 : -1}
          onClick={() => setTab('messages')}
        >
          <Inbox size={14} aria-hidden="true" />
          Messages
        </button>
        {canReadUsers ? (
          <button
            type="button"
            className="ct-tab"
            role="tab"
            id="ct-tab-clients"
            aria-controls="ct-panel-clients"
            aria-selected={tab === 'clients'}
            tabIndex={tab === 'clients' ? 0 : -1}
            onClick={() => setTab('clients')}
          >
            <Users size={14} aria-hidden="true" />
            Clients &amp; Badges
          </button>
        ) : null}
      </div>

      <div
        id="ct-panel-messages"
        role="tabpanel"
        aria-labelledby="ct-tab-messages"
        hidden={tab !== 'messages'}
      >
        <div className="ct-chips" role="status" aria-label="Contact queue summary">
          {CONTACT_STATUSES.map((status) => (
            <span className={`ct-chip ct-chip--${status}`} key={status}>
              <span className="ct-chip-label">{CONTACT_STATUS_LABELS[status]}</span>
              <span className="ct-chip-value">{counts[status as ContactStatus]}</span>
            </span>
          ))}
        </div>

        <div className="ct-filters">
          <div className="ct-field">
            <label className="ct-field-label" htmlFor="ct-search">
              Search
            </label>
            <input
              id="ct-search"
              className="ct-input"
              type="search"
              placeholder="Name, email, organisation or subject…"
              autoComplete="off"
              value={filters.q}
              onChange={(event) => updateParams({ q: event.target.value })}
            />
          </div>
          <div className="ct-field">
            <label className="ct-field-label" htmlFor="ct-filter-status">
              Status
            </label>
            <select
              id="ct-filter-status"
              className="ct-select"
              value={filters.status}
              onChange={(event) => updateParams({ status: event.target.value })}
            >
              <option value="">All statuses</option>
              {CONTACT_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {CONTACT_STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </div>
          <div className="ct-field">
            <label className="ct-field-label" htmlFor="ct-filter-category">
              Category
            </label>
            <select
              id="ct-filter-category"
              className="ct-select"
              value={filters.category}
              onChange={(event) => updateParams({ category: event.target.value })}
            >
              <option value="">All categories</option>
              {CATEGORY_OPTIONS.map((category) => (
                <option key={category} value={category}>
                  {CONTACT_CATEGORY_LABELS[category]}
                </option>
              ))}
            </select>
          </div>
          <div className="ct-filter-actions">
            <button
              type="button"
              className="ct-clear-btn"
              id="ct-clear-filters"
              onClick={resetFilters}
            >
              <RotateCcw size={13} aria-hidden="true" />
              <span>Reset</span>
            </button>
          </div>
        </div>

        <InboxTable
          messages={messages}
          isLoading={list.isLoading}
          onOpen={setOpenMessage}
          onResetFilters={resetFilters}
        />
      </div>

      {canReadUsers ? (
        <div
          id="ct-panel-clients"
          role="tabpanel"
          aria-labelledby="ct-tab-clients"
          hidden={tab !== 'clients'}
        >
          <div className="ct-filters">
            <div className="ct-field">
              <label className="ct-field-label" htmlFor="ct-client-search">
                Search clients
              </label>
              <input
                id="ct-client-search"
                className="ct-input"
                type="search"
                placeholder="Name, email, company or client code…"
                autoComplete="off"
                value={directorySearch}
                onChange={(event) => {
                  setDirectorySearch(event.target.value);
                  setHandoffEmail(null);
                }}
              />
            </div>
          </div>
          <ClientDirectory
            clients={directory.data ?? []}
            isLoading={directory.isLoading}
            canManage={canManageUsers}
            searchEmail={handoffEmail}
          />
        </div>
      ) : null}

      <MessageDialog
        message={openMessage}
        staff={staff.data ?? []}
        open={openMessage !== null}
        onOpenChange={(next) => {
          if (!next) setOpenMessage(null);
        }}
        onFindClient={onFindClient}
      />
    </div>
  );
}
